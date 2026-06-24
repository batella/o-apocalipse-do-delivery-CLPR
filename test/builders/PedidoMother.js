'use strict';

const { PedidoBuilder } = require('./PedidoBuilder');

/**
 * Object Mother for Pedido.
 *
 * Exposes intention-revealing canonical orders, each delegating to the
 * PedidoBuilder underneath. This combines the readability of an Object Mother
 * (`PedidoMother.recusavel()`) with the flexibility of a Builder for one-off
 * tweaks (`PedidoMother.base().comValor(9999).build()`).
 */
const PedidoMother = {
  /** Returns the underlying builder for ad-hoc customisation. */
  base() {
    return new PedidoBuilder();
  },

  /** Valid order, expected to be APPROVED by the gateway (Fluxo 1). */
  aprovavel() {
    return new PedidoBuilder()
      .comEmail('aprovado@entregasja.com')
      .comValor(250)
      .build();
  },

  /** Valid order whose card the gateway will DECLINE (Fluxo 2). */
  recusavel() {
    return new PedidoBuilder()
      .comEmail('recusado@entregasja.com')
      .comValor(80)
      .build();
  },

  /** High-value order used in resilience / chaos scenarios (Fluxo 3 & 4). */
  altoValor() {
    return new PedidoBuilder()
      .comEmail('vip@entregasja.com')
      .comValor(9999)
      .build();
  },

  /** Payload missing the card object — fails RN01 validation (Fluxo 5). */
  invalidoSemCartao() {
    return new PedidoBuilder().semCartao().build();
  },

  /** Payload with a non-positive amount — fails RN01 (Fluxo 5). */
  invalidoValorZero() {
    return new PedidoBuilder().comValor(0).build();
  },
};

module.exports = { PedidoMother };
