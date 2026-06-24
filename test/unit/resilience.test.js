'use strict';

const { withTimeout } = require('../../src/services/withTimeout');
const { retry } = require('../../src/services/retry');
const { CircuitBreaker, State } = require('../../src/services/CircuitBreaker');
const {
  TimeoutError, InfrastructureError, ValidationError, CircuitOpenError,
} = require('../../src/errors');

describe('withTimeout (RN04)', () => {
  test('resolve quando a promise responde dentro do limite', async () => {
    const fast = new Promise((res) => setTimeout(() => res('ok'), 5));
    await expect(withTimeout(fast, 50)).resolves.toBe('ok');
  });

  test('rejeita com TimeoutError quando excede o limite', async () => {
    const slow = new Promise((res) => setTimeout(() => res('tarde'), 50));
    await expect(withTimeout(slow, 10)).rejects.toThrow(TimeoutError);
  });

  test('propaga a rejeicao original se a promise falhar antes do timeout', async () => {
    const boom = Promise.reject(new Error('boom'));
    await expect(withTimeout(boom, 50)).rejects.toThrow('boom');
  });

  test('limpa o timer apos resolver (nao vaza handles)', async () => {
    const clearSpy = jest.spyOn(global, 'clearTimeout');
    await withTimeout(Promise.resolve('ok'), 1000);
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});

describe('retry (RN05/RN06)', () => {
  const opts = { maxRetries: 3, backoffMs: 1, jitter: 0, random: () => 0 };

  test('retorna no primeiro sucesso sem reexecutar', async () => {
    const op = jest.fn().mockResolvedValue('ok');
    await expect(retry(op, opts)).resolves.toBe('ok');
    expect(op).toHaveBeenCalledTimes(1);
  });

  test('reexecuta ate maxRetries+1 vezes em falha de infra', async () => {
    const op = jest.fn().mockRejectedValue(new InfrastructureError('down'));
    await expect(retry(op, opts)).rejects.toThrow(InfrastructureError);
    expect(op).toHaveBeenCalledTimes(4); // 1 + 3 retries
  });

  test('para assim que uma tentativa tem sucesso', async () => {
    const op = jest.fn()
      .mockRejectedValueOnce(new InfrastructureError('down'))
      .mockResolvedValue('ok');
    await expect(retry(op, opts)).resolves.toBe('ok');
    expect(op).toHaveBeenCalledTimes(2);
  });

  test('NAO reexecuta erros nao-retryable (ValidationError)', async () => {
    const op = jest.fn().mockRejectedValue(new ValidationError('invalido', 'campo'));
    await expect(retry(op, opts)).rejects.toThrow(ValidationError);
    expect(op).toHaveBeenCalledTimes(1);
  });

  test('aguarda o backoff entre tentativas', async () => {
    const sleeps = [];
    const realSetTimeout = global.setTimeout;
    jest.spyOn(global, 'setTimeout').mockImplementation((fn, ms) => {
      sleeps.push(ms);
      return realSetTimeout(fn, 0);
    });
    const op = jest.fn()
      .mockRejectedValueOnce(new InfrastructureError('down'))
      .mockResolvedValue('ok');

    await retry(op, { maxRetries: 3, backoffMs: 500, jitter: 0, random: () => 0 });
    expect(sleeps).toContain(500);
    global.setTimeout.mockRestore();
  });
});

describe('CircuitBreaker (RN07)', () => {
  test('inicia fechado e executa normalmente', async () => {
    const cb = new CircuitBreaker();
    await expect(cb.execute(async () => 'ok')).resolves.toBe('ok');
    expect(cb.state).toBe(State.CLOSED);
  });

  test('abre quando a taxa de falha excede o threshold', async () => {
    const cb = new CircuitBreaker({ minimumCalls: 5, window: 10, errorThreshold: 0.5 });
    const falha = async () => { throw new InfrastructureError('x'); };

    for (let i = 0; i < 6; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await cb.execute(falha).catch(() => {});
    }
    expect(cb.state).toBe(State.OPEN);
  });

  test('falha rapido com CircuitOpenError enquanto aberto', async () => {
    let clock = 0;
    const cb = new CircuitBreaker({ minimumCalls: 5, errorThreshold: 0.5, cooldownMs: 1000, now: () => clock });
    const falha = async () => { throw new InfrastructureError('x'); };
    for (let i = 0; i < 6; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await cb.execute(falha).catch(() => {});
    }
    const gatewaySpy = jest.fn();
    await expect(cb.execute(gatewaySpy)).rejects.toThrow(CircuitOpenError);
    expect(gatewaySpy).not.toHaveBeenCalled(); // protege o gateway
  });

  test('fecha novamente apos sucesso em HALF_OPEN', async () => {
    let clock = 0;
    const cb = new CircuitBreaker({ minimumCalls: 5, errorThreshold: 0.5, cooldownMs: 1000, now: () => clock });
    const falha = async () => { throw new InfrastructureError('x'); };
    for (let i = 0; i < 6; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await cb.execute(falha).catch(() => {});
    }
    expect(cb.state).toBe(State.OPEN);

    clock = 2000; // passa o cooldown
    await cb.execute(async () => 'ok');
    expect(cb.state).toBe(State.CLOSED);
  });
});
