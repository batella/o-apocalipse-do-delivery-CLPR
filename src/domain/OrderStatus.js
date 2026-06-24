'use strict';

/** Persisted order states (RN02, RN03, RN07). */
const OrderStatus = Object.freeze({
  PENDING: 'PENDENTE',
  PROCESSED: 'PROCESSADO',
  FAILED: 'FALHOU',
  GATEWAY_ERROR: 'ERRO_GATEWAY',
});

/** Gateway response codes. Anything not APPROVED is a business decline (RN03). */
const GatewayStatus = Object.freeze({
  APPROVED: 'APROVADO',
  DECLINED: 'RECUSADO',
  INSUFFICIENT_FUNDS: 'SALDO_INSUFICIENTE',
  EXPIRED_CARD: 'CARTAO_EXPIRADO',
});

module.exports = { OrderStatus, GatewayStatus };
