'use strict';

const { loadFeature, defineFeature } = require('jest-cucumber');
const path = require('path');

const { CheckoutService } = require('../../src/services/CheckoutService');
const { OrderStatus, GatewayStatus } = require('../../src/domain/OrderStatus');
const { ValidationError, InfrastructureError } = require('../../src/errors');
const { PedidoMother } = require('../builders/PedidoMother');
const { gatewaySequencialStub } = require('../builders/doubles');

const feature = loadFeature(path.join(__dirname, '../../features/checkout.feature'));

const fastRetry = { maxRetries: 3, backoffMs: 1, jitter: 0, random: () => 0 };

defineFeature(feature, (test) => {
  let pedido;
  let gateway;
  let emailMock;
  let repo;
  let service;
  let resultado;
  let erroLancado;

  const buildService = () => {
    repo = { salvar: jest.fn(async (p) => ({ ...p, id: 1 })) };
    service = new CheckoutService(gateway, repo, emailMock, { retryOptions: fastRetry });
  };

  const processar = async () => {
    erroLancado = null;
    try {
      resultado = await service.processar(pedido);
      await new Promise((r) => setImmediate(r)); // libera o e-mail fire-and-forget
    } catch (e) {
      erroLancado = e;
    }
  };

  beforeEach(() => {
    emailMock = { enviarConfirmacao: jest.fn().mockResolvedValue(undefined) };
    pedido = PedidoMother.aprovavel();
  });

  test('Pagamento aprovado dispara confirmação (Fluxo 1)', ({ given, and, when, then }) => {
    given(/^um cliente com um pedido válido de R\$ (.*)$/, () => { pedido = PedidoMother.aprovavel(); });
    given(/^que o gateway de pagamento responde "(.*)"$/, (status) => {
      gateway = { cobrar: jest.fn().mockResolvedValue({ status }) };
      buildService();
    });
    when('o checkout é processado', processar);
    then(/^o pedido deve ter status "(.*)"$/, (status) => {
      expect(resultado.order.status).toBe(status);
    });
    and('o e-mail de confirmação deve ser enviado', () => {
      expect(emailMock.enviarConfirmacao).toHaveBeenCalledTimes(1);
    });
    and('a resposta deve indicar sucesso', () => {
      expect(resultado.success).toBe(true);
    });
  });

  test('Cartão recusado não dispara e-mail (Fluxo 2)', ({ given, and, when, then }) => {
    given(/^um cliente com um pedido válido de R\$ (.*)$/, () => { pedido = PedidoMother.recusavel(); });
    given(/^que o gateway de pagamento responde "(.*)"$/, (status) => {
      gateway = { cobrar: jest.fn().mockResolvedValue({ status }) };
      buildService();
    });
    when('o checkout é processado', processar);
    then(/^o pedido deve ter status "(.*)"$/, (status) => {
      expect(resultado.order.status).toBe(status);
    });
    and('o e-mail de confirmação não deve ser enviado', () => {
      expect(emailMock.enviarConfirmacao).not.toHaveBeenCalled();
    });
    and('a resposta deve indicar insucesso', () => {
      expect(resultado.success).toBe(false);
    });
  });

  test('Gateway instável se recupera na retentativa (Fluxo 3)', ({ given, and, when, then }) => {
    given(/^um cliente com um pedido válido de R\$ (.*)$/, () => { pedido = PedidoMother.altoValor(); });
    given(/^que o gateway falha 1 vez e depois responde "(.*)"$/, (status) => {
      gateway = gatewaySequencialStub([
        new InfrastructureError('queda momentanea'),
        { status },
      ]);
      buildService();
    });
    when('o checkout é processado', processar);
    then(/^o pedido deve ter status "(.*)"$/, (status) => {
      expect(resultado.order.status).toBe(status);
    });
    and(/^o gateway deve ter sido chamado (\d+) vezes$/, (n) => {
      expect(gateway.chamadas()).toBe(Number(n));
    });
  });

  test('Queda total do gateway aciona fallback (Fluxo 4)', ({ given, and, when, then }) => {
    given(/^um cliente com um pedido válido de R\$ (.*)$/, () => { pedido = PedidoMother.altoValor(); });
    given('que o gateway falha em todas as tentativas', () => {
      gateway = { cobrar: jest.fn().mockRejectedValue(new InfrastructureError('fora do ar')) };
      buildService();
    });
    when('o checkout é processado', processar);
    then(/^o pedido deve ter status "(.*)"$/, (status) => {
      expect(resultado.order.status).toBe(status);
    });
    and('o e-mail de confirmação não deve ser enviado', () => {
      expect(emailMock.enviarConfirmacao).not.toHaveBeenCalled();
    });
    and('a resposta deve indicar insucesso', () => {
      expect(resultado.success).toBe(false);
    });
  });

  test('Payload incompleto é rejeitado sem tocar a infraestrutura (Fluxo 5)', ({ given, and, when, then }) => {
    given(/^um cliente com um pedido válido de R\$ (.*)$/, () => {});
    given('um pedido sem os dados do cartão', () => {
      pedido = PedidoMother.invalidoSemCartao();
      gateway = { cobrar: jest.fn() };
      buildService();
    });
    when('o checkout é processado', processar);
    then('uma falha de validação deve ser lançada', () => {
      expect(erroLancado).toBeInstanceOf(ValidationError);
    });
    and('o gateway de pagamento não deve ser chamado', () => {
      expect(gateway.cobrar).not.toHaveBeenCalled();
    });
  });
});
