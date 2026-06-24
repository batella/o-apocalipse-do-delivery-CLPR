'use strict';

const { InfrastructureError } = require('../errors');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * RN05 / RN06 — retries an async operation on retryable infrastructure failures.
 *
 *  - Up to `maxRetries` ADDITIONAL attempts after the first (total = maxRetries + 1).
 *  - Fixed backoff of `backoffMs` between attempts (RN06).
 *  - `jitter` (0..1) randomly spreads the wait to prevent the Thundering Herd
 *    of Fase 4 from re-synchronising all clients onto the same retry tick.
 *  - Non-retryable errors (ValidationError, CircuitOpenError, business declines)
 *    bubble up immediately without consuming an attempt.
 *
 * @param {() => Promise<any>} operation
 * @param {object} opts
 * @param {() => number} [opts.random] injectable RNG for deterministic tests
 */
async function retry(operation, {
  maxRetries = 3,
  backoffMs = 500,
  jitter = 0.2,
  random = Math.random,
} = {}) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;

      const isRetryable = error instanceof InfrastructureError && error.retryable;
      const hasAttemptsLeft = attempt < maxRetries;

      if (!isRetryable || !hasAttemptsLeft) {
        throw error;
      }

      const spread = backoffMs * jitter * random();
      await sleep(backoffMs + spread);
    }
  }

  throw lastError;
}

module.exports = { retry };
