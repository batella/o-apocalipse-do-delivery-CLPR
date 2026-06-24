'use strict';

const { OrderStatus } = require('../../src/domain/OrderStatus');

/**
 * Data Builder for Pedido (order).
 *
 * Provides sensible defaults so tests only declare what matters to them,
 * killing the Obscure Setup smell. Fluent API: every `comX()` returns `this`.
 *
 *   new PedidoBuilder().comValor(150).build();
 */
class PedidoBuilder {
  constructor() {
    this.pedido = {
      clienteEmail: 'cliente@entregasja.com',
      valor: 100,
      cartao: { numero: '4111111111111111', validade: '12/30', cvv: '123' },
      status: OrderStatus.PENDING,
    };
  }

  comEmail(clienteEmail) {
    this.pedido.clienteEmail = clienteEmail;
    return this;
  }

  comValor(valor) {
    this.pedido.valor = valor;
    return this;
  }

  comCartao(cartao) {
    this.pedido.cartao = cartao;
    return this;
  }

  semCartao() {
    delete this.pedido.cartao;
    return this;
  }

  comStatus(status) {
    this.pedido.status = status;
    return this;
  }

  build() {
    // shallow clone so each build() yields an independent instance
    return { ...this.pedido, cartao: this.pedido.cartao ? { ...this.pedido.cartao } : undefined };
  }
}

module.exports = { PedidoBuilder };
