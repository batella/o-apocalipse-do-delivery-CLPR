'use strict';

const { CheckoutService } = require('../../src/services/CheckoutService');
const { OrderStatus, GatewayStatus } = require('../../src/domain/OrderStatus');
const { ValidationError } = require('../../src/errors');
const { PedidoMother } = require('../builders/PedidoMother');
const {
  gatewayAprovaStub,
  gatewayRecusaStub,
  gatewayFalhaStub,
  novoPedidoRepositoryStub,
  gatewaySequencialStub,
} = require('../builders/doubles');

const { InfrastructureError } = require('../../src/errors');

// fast retry config so resilience tests don't sleep for real seconds
const fastRetry = { maxRetries: 3, backoffMs: 1, jitter: 0, random: () => 0 };

describe('CheckoutService — Fluxo 1: Pagamento Aprovado (RN02)', () => {
  let repo;
  let emailMock;
  let service;

  beforeEach(() => {
    repo = novoPedidoRepositoryStub();
    jest.spyOn(repo, 'salvar');
    emailMock = { enviarConfirmacao: jest.fn().mockResolvedValue(undefined) };
    service = new CheckoutService(gatewayAprovaStub, repo, emailMock, { retryOptions: fastRetry });
  });

  test('marca o pedido como PROCESSADO e retorna sucesso', async () => {
    const resultado = await service.processar(PedidoMother.aprovavel());

    expect(resultado.success).toBe(true);
    expect(resultado.order.status).toBe(OrderStatus.PROCESSED);
    expect(resultado.order.id).toBeDefined();
  });

  test('persiste o pedido aprovado no repositorio', async () => {
    await service.processar(PedidoMother.aprovavel());
    expect(repo.salvar).toHaveBeenCalledTimes(1);
    expect(repo.salvar).toHaveBeenCalledWith(
      expect.objectContaining({ status: OrderStatus.PROCESSED }),
    );
  });

  test('dispara o e-mail de confirmacao (Mock de comportamento)', async () => {
    await service.processar(PedidoMother.aprovavel());
    await new Promise((r) => setImmediate(r)); // deixa o fire-and-forget resolver
    expect(emailMock.enviarConfirmacao).toHaveBeenCalledTimes(1);
    expect(emailMock.enviarConfirmacao).toHaveBeenCalledWith(
      'aprovado@entregasja.com',
      'Pagamento Aprovado',
    );
  });

  test('falha no e-mail NAO derruba o checkout (RN02 non-blocking)', async () => {
    emailMock.enviarConfirmacao.mockRejectedValue(new Error('SMTP fora do ar'));
    const resultado = await service.processar(PedidoMother.aprovavel());
    expect(resultado.success).toBe(true);
  });
});

describe('CheckoutService — Fluxo 2: Pagamento Recusado (RN03)', () => {
  let repo;
  let emailMock;
  let service;

  beforeEach(() => {
    repo = novoPedidoRepositoryStub();
    emailMock = { enviarConfirmacao: jest.fn().mockResolvedValue(undefined) };
    service = new CheckoutService(gatewayRecusaStub, repo, emailMock, { retryOptions: fastRetry });
  });

  test('marca o pedido como FALHOU e retorna insucesso', async () => {
    const resultado = await service.processar(PedidoMother.recusavel());
    expect(resultado.success).toBe(false);
    expect(resultado.order.status).toBe(OrderStatus.FAILED);
  });

  test('NUNCA dispara e-mail de confirmacao em recusa (regra critica RN03)', async () => {
    await service.processar(PedidoMother.recusavel());
    await new Promise((r) => setImmediate(r));
    expect(emailMock.enviarConfirmacao).not.toHaveBeenCalled();
  });
});

describe('CheckoutService — Fluxo 3: Resiliencia / Retry (RN05/RN06)', () => {
  test('recupera-se apos 1 falha de infra e aprova na 2a tentativa', async () => {
    const gateway = gatewaySequencialStub([
      new InfrastructureError('queda momentanea'),
      { status: GatewayStatus.APPROVED },
    ]);
    const repo = novoPedidoRepositoryStub();
    const emailMock = { enviarConfirmacao: jest.fn().mockResolvedValue(undefined) };
    const service = new CheckoutService(gateway, repo, emailMock, { retryOptions: fastRetry });

    const resultado = await service.processar(PedidoMother.altoValor());

    expect(resultado.success).toBe(true);
    expect(resultado.order.status).toBe(OrderStatus.PROCESSED);
    expect(gateway.chamadas()).toBe(2); // 1 falha + 1 sucesso
  });
});

describe('CheckoutService — Fluxo 4: Caos Total / Fallback (RN07)', () => {
  test('esgota retentativas e aciona fallback ERRO_GATEWAY', async () => {
    const repo = novoPedidoRepositoryStub();
    const emailMock = { enviarConfirmacao: jest.fn() };
    const service = new CheckoutService(gatewayFalhaStub, repo, emailMock, { retryOptions: fastRetry });

    const resultado = await service.processar(PedidoMother.altoValor());

    expect(resultado.success).toBe(false);
    expect(resultado.order.status).toBe(OrderStatus.GATEWAY_ERROR);
    expect(emailMock.enviarConfirmacao).not.toHaveBeenCalled();
  });

  test('falha de infra persiste o pedido com status de erro', async () => {
    const repo = novoPedidoRepositoryStub();
    jest.spyOn(repo, 'salvar');
    const service = new CheckoutService(gatewayFalhaStub, repo, { enviarConfirmacao: jest.fn() }, { retryOptions: fastRetry });

    await service.processar(PedidoMother.altoValor());
    expect(repo.salvar).toHaveBeenCalledWith(
      expect.objectContaining({ status: OrderStatus.GATEWAY_ERROR }),
    );
  });
});

describe('CheckoutService — Fluxo 5: Validacao de Entrada (RN01)', () => {
  let repo;
  let gatewayMock;
  let service;

  beforeEach(() => {
    repo = novoPedidoRepositoryStub();
    jest.spyOn(repo, 'salvar');
    gatewayMock = { cobrar: jest.fn() };
    service = new CheckoutService(gatewayMock, repo, { enviarConfirmacao: jest.fn() }, { retryOptions: fastRetry });
  });

  test('payload sem cartao lanca ValidationError', async () => {
    await expect(service.processar(PedidoMother.invalidoSemCartao()))
      .rejects.toThrow(ValidationError);
  });

  test('valor zero lanca ValidationError', async () => {
    await expect(service.processar(PedidoMother.invalidoValorZero()))
      .rejects.toThrow(ValidationError);
  });

  test('NAO chama gateway nem repositorio quando o payload e invalido', async () => {
    await expect(service.processar(PedidoMother.invalidoSemCartao())).rejects.toThrow();
    expect(gatewayMock.cobrar).not.toHaveBeenCalled();
    expect(repo.salvar).not.toHaveBeenCalled();
  });
});
