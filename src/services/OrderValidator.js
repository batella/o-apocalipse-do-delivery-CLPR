'use strict';

const { ValidationError } = require('../errors');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * RN01 — validates the checkout payload BEFORE any gateway/DB interaction.
 * Throws ValidationError on the first offending field. Extracted out of the
 * Express handler so the rule is unit-testable and reusable.
 */
class OrderValidator {
  validate(pedido) {
    if (!pedido || typeof pedido !== 'object') {
      throw new ValidationError('Pedido ausente ou invalido', 'pedido');
    }

    const { clienteEmail, valor, cartao } = pedido;

    if (!clienteEmail || !EMAIL_PATTERN.test(clienteEmail)) {
      throw new ValidationError('E-mail do cliente invalido', 'clienteEmail');
    }

    if (typeof valor !== 'number' || Number.isNaN(valor) || valor <= 0) {
      throw new ValidationError('Valor deve ser numerico e maior que zero', 'valor');
    }

    if (!cartao || typeof cartao !== 'object') {
      throw new ValidationError('Dados do cartao ausentes', 'cartao');
    }

    return true;
  }
}

module.exports = { OrderValidator };
