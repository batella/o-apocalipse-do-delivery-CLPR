'use strict';

const { CircuitOpenError } = require('../errors');

const State = Object.freeze({
  CLOSED: 'CLOSED',     // normal operation
  OPEN: 'OPEN',         // failing fast, gateway calls suspended
  HALF_OPEN: 'HALF_OPEN', // probing whether the gateway recovered
});

/**
 * RN07 — Circuit Breaker.
 *
 * Tracks the rolling failure ratio over the last `window` calls. When the ratio
 * exceeds `errorThreshold` (default 50%), the circuit OPENS and every further
 * call fails fast with CircuitOpenError — protecting the Express thread pool
 * instead of piling requests onto a dying gateway.
 *
 * After `cooldownMs`, the next call is allowed through in HALF_OPEN state as a
 * probe: success closes the circuit, failure re-opens it.
 *
 * `now` is injectable so tests can advance time deterministically.
 */
class CircuitBreaker {
  constructor({
    errorThreshold = 0.5,
    window = 10,
    cooldownMs = 10000,
    minimumCalls = 5,
    now = Date.now,
  } = {}) {
    this.errorThreshold = errorThreshold;
    this.window = window;
    this.cooldownMs = cooldownMs;
    this.minimumCalls = minimumCalls;
    this.now = now;

    this.state = State.CLOSED;
    this.results = []; // rolling log of booleans: true = success
    this.openedAt = null;
  }

  async execute(operation) {
    if (this.state === State.OPEN) {
      if (this.now() - this.openedAt >= this.cooldownMs) {
        this.state = State.HALF_OPEN;
      } else {
        throw new CircuitOpenError();
      }
    }

    try {
      const result = await operation();
      this._onSuccess();
      return result;
    } catch (error) {
      this._onFailure();
      throw error;
    }
  }

  _record(success) {
    this.results.push(success);
    if (this.results.length > this.window) {
      this.results.shift();
    }
  }

  _failureRatio() {
    if (this.results.length === 0) return 0;
    const failures = this.results.filter((ok) => !ok).length;
    return failures / this.results.length;
  }

  _onSuccess() {
    this._record(true);
    if (this.state === State.HALF_OPEN) {
      this._reset();
    }
  }

  _onFailure() {
    this._record(false);

    if (this.state === State.HALF_OPEN) {
      this._open();
      return;
    }

    const enoughData = this.results.length >= this.minimumCalls;
    if (enoughData && this._failureRatio() > this.errorThreshold) {
      this._open();
    }
  }

  _open() {
    this.state = State.OPEN;
    this.openedAt = this.now();
  }

  _reset() {
    this.state = State.CLOSED;
    this.results = [];
    this.openedAt = null;
  }
}

CircuitBreaker.State = State;

module.exports = { CircuitBreaker, State };
