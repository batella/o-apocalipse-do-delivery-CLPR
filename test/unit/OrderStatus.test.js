'use strict';

const { OrderStatus, GatewayStatus } = require('../../src/domain/OrderStatus');

/**
 * These tests pin the exact wire/persistence values of the enums. They exist
 * specifically to kill string-literal mutants on the status constants: the rest
 * of the system (and the database) depends on these literals being stable, so
 * an empty-string mutation IS a real defect, not an equivalent mutant.
 */
describe('OrderStatus — contrato de persistencia', () => {
  test('valores dos status do pedido sao estaveis', () => {
    expect(OrderStatus.PENDING).toBe('PENDENTE');
    expect(OrderStatus.PROCESSED).toBe('PROCESSADO');
    expect(OrderStatus.FAILED).toBe('FALHOU');
    expect(OrderStatus.GATEWAY_ERROR).toBe('ERRO_GATEWAY');
  });

  test('valores sao todos distintos e nao-vazios', () => {
    const valores = Object.values(OrderStatus);
    valores.forEach((v) => expect(v.length).toBeGreaterThan(0));
    expect(new Set(valores).size).toBe(valores.length);
  });
});

describe('GatewayStatus — contrato de integracao', () => {
  test('codigo de aprovacao e estavel', () => {
    expect(GatewayStatus.APPROVED).toBe('APROVADO');
  });

  test('codigos de recusa sao distintos e nao-vazios', () => {
    const valores = Object.values(GatewayStatus);
    valores.forEach((v) => expect(v.length).toBeGreaterThan(0));
    expect(new Set(valores).size).toBe(valores.length);
  });
});
