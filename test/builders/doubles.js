'use strict';

const { GatewayStatus } = require('../../src/domain/OrderStatus');
const { InfrastructureError } = require('../../src/errors');

/**
 * Test doubles used across the unit suite.
 *
 * Stubs answer with canned STATE (used for state verification).
 * Mocks (jest.fn) are created in the tests themselves for BEHAVIOUR verification
 * (e.g. asserting the confirmation e-mail was/was not called).
 */

/** Stub: gateway that always approves. */
const gatewayAprovaStub = {
  cobrar: async () => ({ status: GatewayStatus.APPROVED }),
};

/** Stub: gateway that always declines (business failure). */
const gatewayRecusaStub = {
  cobrar: async () => ({ status: GatewayStatus.DECLINED }),
};

/** Stub: gateway that always throws an infrastructure error. */
const gatewayFalhaStub = {
  cobrar: async () => { throw new InfrastructureError('gateway fora do ar'); },
};

/** Stub repository: echoes the saved order back with an id, no real persistence. */
function novoPedidoRepositoryStub() {
  return {
    salvar: async (pedido) => ({ ...pedido, id: 1 }),
  };
}

/**
 * Programmable gateway stub: returns/throws according to a queue of behaviours,
 * enabling the "fails then recovers" resilience scenario (Fluxo 3).
 */
function gatewaySequencialStub(behaviours) {
  let i = 0;
  return {
    cobrar: async () => {
      const behaviour = behaviours[Math.min(i, behaviours.length - 1)];
      i += 1;
      if (behaviour instanceof Error) throw behaviour;
      return behaviour;
    },
    chamadas: () => i,
  };
}

module.exports = {
  gatewayAprovaStub,
  gatewayRecusaStub,
  gatewayFalhaStub,
  novoPedidoRepositoryStub,
  gatewaySequencialStub,
};
