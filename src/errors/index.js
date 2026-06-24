'use strict';

/**
 * Domain error hierarchy.
 *
 * Distinguishing *infrastructure* failures (retryable) from *business*
 * failures (not retryable) is the cornerstone of the resilience design:
 * only InfrastructureError triggers retry / circuit-breaker logic.
 */

class DomainError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}

/** Payload failed RN01 validation. Never reaches gateway or repository. */
class ValidationError extends DomainError {
  constructor(message, field) {
    super(message);
    this.field = field;
  }
}

/**
 * Network / gateway-level failure (timeout, 5xx, connection refused).
 * This is the ONLY error class that is considered retryable (RN05).
 */
class InfrastructureError extends DomainError {
  constructor(message, { retryable = true } = {}) {
    super(message);
    this.retryable = retryable;
  }
}

/** The 2000ms hard timeout of RN04 elapsed before the gateway answered. */
class TimeoutError extends InfrastructureError {
  constructor(timeoutMs) {
    super(`Gateway nao respondeu dentro de ${timeoutMs}ms`, { retryable: true });
    this.timeoutMs = timeoutMs;
  }
}

/** Circuit breaker is OPEN (RN07): calls are short-circuited without hitting the gateway. */
class CircuitOpenError extends InfrastructureError {
  constructor() {
    super('Circuit breaker aberto: chamadas ao gateway suspensas', { retryable: false });
  }
}

module.exports = {
  DomainError,
  ValidationError,
  InfrastructureError,
  TimeoutError,
  CircuitOpenError,
};
