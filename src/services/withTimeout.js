'use strict';

const { TimeoutError } = require('../errors');

/**
 * RN04 — wraps a promise with a hard timeout.
 * If `promise` does not settle within `timeoutMs`, rejects with TimeoutError.
 * The timer is always cleared to avoid leaking handles under load.
 */
function withTimeout(promise, timeoutMs) {
  let timer;
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(timeoutMs)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

module.exports = { withTimeout };
