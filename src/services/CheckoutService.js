'use strict';

const { OrderStatus, GatewayStatus } = require('../domain/OrderStatus');
const { OrderValidator } = require('./OrderValidator');
const { CircuitBreaker } = require('./CircuitBreaker');
const { withTimeout } = require('./withTimeout');
const { retry } = require('./retry');
const { InfrastructureError } = require('../errors');

/**
 * Result object returned to the controller. Replaces the ambiguous
 * "return pedidoSalvo | null" of the legacy code (Replace Return-of-null).
 */
class CheckoutResult {
  constructor({ success, order, reason = null }) {
    this.success = success;
    this.order = order;
    this.reason = reason;
  }

  static approved(order) {
    return new CheckoutResult({ success: true, order });
  }

  static rejected(order, reason) {
    return new CheckoutResult({ success: false, order, reason });
  }
}

/**
 * Refactored Checkout orchestrator.
 *
 * Pipeline: validate (RN01) -> resilient charge (RN04/05/06/07)
 *           -> persist + (optionally) notify (RN02/RN03).
 *
 * Resilience is layered breaker( retry( timeout( gateway ) ) ) so that:
 *   - timeout caps a single attempt (RN04),
 *   - retry re-issues attempts with backoff+jitter (RN05/RN06),
 *   - breaker trips when the rolling failure ratio is too high (RN07).
 *
 * Dependencies are injected (Dependency Inversion) which is what makes the
 * Stubs (state) and Mocks (behaviour) of Fase 2 possible.
 */
class CheckoutService {
  constructor(gatewayPagamento, pedidoRepository, emailService, options = {}) {
    this.gatewayPagamento = gatewayPagamento;
    this.pedidoRepository = pedidoRepository;
    this.emailService = emailService;

    this.validator = options.validator || new OrderValidator();
    this.breaker = options.circuitBreaker || new CircuitBreaker(options.breakerOptions);
    this.timeoutMs = options.timeoutMs ?? 2000;
    this.retryOptions = options.retryOptions || { maxRetries: 3, backoffMs: 500, jitter: 0.2 };
  }

  /**
   * @returns {Promise<CheckoutResult>}
   */
  async processar(pedido) {
    this.validator.validate(pedido); // RN01 — throws ValidationError, never persists

    let gatewayResponse;
    try {
      gatewayResponse = await this._chargeWithResilience(pedido);
    } catch (error) {
      return this._handleInfrastructureFailure(pedido, error);
    }

    if (this._isApproved(gatewayResponse)) {
      return this._handleApproved(pedido);
    }
    return this._handleDeclined(pedido);
  }

  // --- resilience composition (RN04/05/06/07) ---------------------------

  _chargeWithResilience(pedido) {
    return this.breaker.execute(() =>
      retry(
        () => withTimeout(
          this.gatewayPagamento.cobrar(pedido.valor, pedido.cartao),
          this.timeoutMs,
        ),
        this.retryOptions,
      ),
    );
  }

  _isApproved(response) {
    return Boolean(response) && response.status === GatewayStatus.APPROVED;
  }

  // --- outcome handlers (Replace Conditional with explicit methods) ------

  async _handleApproved(pedido) {
    pedido.status = OrderStatus.PROCESSED; // RN02
    const saved = await this.pedidoRepository.salvar(pedido);
    // RN02: e-mail is fire-and-forget (non-blocking) — must NOT hold the response.
    this._notifyAsync(pedido.clienteEmail, 'Pagamento Aprovado');
    return CheckoutResult.approved(saved);
  }

  async _handleDeclined(pedido) {
    pedido.status = OrderStatus.FAILED; // RN03
    const saved = await this.pedidoRepository.salvar(pedido);
    // RN03 critical rule: NO confirmation e-mail on decline.
    return CheckoutResult.rejected(saved, 'pagamento_recusado');
  }

  async _handleInfrastructureFailure(pedido, error) {
    pedido.status = OrderStatus.GATEWAY_ERROR; // RN07 fallback
    const saved = await this.pedidoRepository.salvar(pedido);
    return CheckoutResult.rejected(saved, error instanceof InfrastructureError
      ? error.name
      : 'erro_desconhecido');
  }

  /**
   * Fire-and-forget notification (RN02). Failures are swallowed and logged so a
   * flaky SMTP provider can never break or delay a successful checkout.
   */
  _notifyAsync(email, message) {
    Promise.resolve()
      .then(() => this.emailService.enviarConfirmacao(email, message))
      .catch((err) => console.error('Falha ao enviar e-mail de confirmacao:', err.message));
  }
}

module.exports = { CheckoutService, CheckoutResult };
