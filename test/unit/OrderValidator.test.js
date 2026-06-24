'use strict';

const { OrderValidator } = require('../../src/services/OrderValidator');
const { ValidationError } = require('../../src/errors');
const { PedidoMother } = require('../builders/PedidoMother');

describe('OrderValidator (RN01)', () => {
  const validator = new OrderValidator();

  test('aceita um pedido completo e valido', () => {
    expect(validator.validate(PedidoMother.aprovavel())).toBe(true);
  });

  test('rejeita e-mail invalido', () => {
    const pedido = PedidoMother.base().comEmail('sem-arroba').build();
    expect(() => validator.validate(pedido)).toThrow(ValidationError);
  });

  test.each([
    'sem-arroba',
    'falta@dominio',
    '@semlocal.com',
    'espaco no@meio.com',
    'semtld@dominio.',
    '',
  ])('rejeita e-mail malformado: "%s"', (email) => {
    const pedido = PedidoMother.base().comEmail(email).build();
    expect(() => validator.validate(pedido)).toThrow(ValidationError);
  });

  test.each([
    'cliente@entregasja.com',
    'a.b+tag@sub.dominio.com.br',
  ])('aceita e-mail valido: "%s"', (email) => {
    const pedido = PedidoMother.base().comEmail(email).build();
    expect(validator.validate(pedido)).toBe(true);
  });

  test('rejeita valor zero ou negativo', () => {
    expect(() => validator.validate(PedidoMother.base().comValor(0).build())).toThrow(ValidationError);
    expect(() => validator.validate(PedidoMother.base().comValor(-10).build())).toThrow(ValidationError);
  });

  test('rejeita valor nao-numerico', () => {
    const pedido = PedidoMother.base().comValor('100').build();
    expect(() => validator.validate(pedido)).toThrow(ValidationError);
  });

  test('rejeita ausencia de cartao', () => {
    expect(() => validator.validate(PedidoMother.invalidoSemCartao())).toThrow(ValidationError);
  });

  test('a ValidationError aponta o campo ofensor', () => {
    try {
      validator.validate(PedidoMother.base().comValor(0).build());
    } catch (e) {
      expect(e.field).toBe('valor');
    }
  });
});
