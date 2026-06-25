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

  test.each([
    [null, 'pedido'],
    [undefined, 'pedido'],
    ['nao-e-objeto', 'pedido'],
    [42, 'pedido'],
  ])('rejeita pedido nao-objeto: %s', (entrada, campo) => {
    try {
      validator.validate(entrada);
      throw new Error('deveria ter lancado');
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect(e.field).toBe(campo);
    }
  });

  test('rejeita e-mail terminado em ponto (sem TLD)', () => {
    const pedido = PedidoMother.base().comEmail('cliente@dominio.').build();
    expect(() => validator.validate(pedido)).toThrow(ValidationError);
  });

  test('rejeita e-mail com lixo apos um endereco valido (ancora $)', () => {
    // Sem a ancora final, a regex casaria o prefixo valido e deixaria passar.
    const pedido = PedidoMother.base().comEmail('cliente@dominio.com@malicioso').build();
    expect(() => validator.validate(pedido)).toThrow(ValidationError);
  });

  test('rejeita cartao que existe mas nao e objeto (string/numero)', () => {
    // Cobre o ramo "|| typeof cartao !== object": cartao presente, porem invalido.
    // Construido inline pois o builder normaliza o cartao em objeto.
    const base = { clienteEmail: 'x@y.com', valor: 100 };
    expect(() => validator.validate({ ...base, cartao: '4111' })).toThrow(ValidationError);
    expect(() => validator.validate({ ...base, cartao: 123 })).toThrow(ValidationError);
  });

  test('cada falha expoe o campo correto e uma mensagem nao-vazia', () => {
    const casos = [
      [PedidoMother.base().comEmail('x').build(), 'clienteEmail'],
      [PedidoMother.base().comValor(-1).build(), 'valor'],
      [PedidoMother.invalidoSemCartao(), 'cartao'],
    ];
    casos.forEach(([pedido, campo]) => {
      try {
        validator.validate(pedido);
        throw new Error('deveria ter lancado');
      } catch (e) {
        expect(e.field).toBe(campo);
        expect(e.message.length).toBeGreaterThan(0);
      }
    });
  });
});
