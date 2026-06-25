'use strict';

const { CircuitBreaker, State } = require('../../src/services/CircuitBreaker');
const { CircuitOpenError, InfrastructureError } = require('../../src/errors');

const ok = async () => 'ok';
const fail = async () => { throw new InfrastructureError('x'); };

/** Drives `n` failing calls through the breaker, swallowing the rejections. */
async function driveFailures(cb, n) {
  for (let i = 0; i < n; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await cb.execute(fail).catch(() => {});
  }
}

describe('CircuitBreaker — abertura por limiar (RN07)', () => {
  test('NAO abre antes de atingir minimumCalls, mesmo com 100% de falha', async () => {
    const cb = new CircuitBreaker({ minimumCalls: 5, window: 10, errorThreshold: 0.5 });
    await driveFailures(cb, 4); // 4 < 5
    expect(cb.state).toBe(State.CLOSED);
  });

  test('abre exatamente ao atingir minimumCalls com falha acima do limiar', async () => {
    const cb = new CircuitBreaker({ minimumCalls: 5, window: 10, errorThreshold: 0.5 });
    await driveFailures(cb, 5); // 5 falhas => ratio 1.0 > 0.5, e length >= 5
    expect(cb.state).toBe(State.OPEN);
  });

  test('NAO abre quando a taxa de falha fica NO limiar (precisa ser estritamente maior)', async () => {
    // 5 falhas + 5 sucessos = ratio 0.5, que NAO e > 0.5 => permanece fechado
    const cb = new CircuitBreaker({ minimumCalls: 5, window: 10, errorThreshold: 0.5 });
    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await cb.execute(ok);
    }
    await driveFailures(cb, 5);
    expect(cb.state).toBe(State.CLOSED);
  });

  test('abre quando a taxa de falha fica ACIMA do limiar', async () => {
    // 6 falhas + 4 sucessos = ratio 0.6 > 0.5 => abre
    const cb = new CircuitBreaker({ minimumCalls: 5, window: 10, errorThreshold: 0.5 });
    for (let i = 0; i < 4; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await cb.execute(ok);
    }
    await driveFailures(cb, 6);
    expect(cb.state).toBe(State.OPEN);
  });
});

describe('CircuitBreaker — janela deslizante (_record)', () => {
  test('descarta resultados antigos mantendo apenas os ultimos `window`', async () => {
    // window=5: 5 falhas abrem; depois muitos sucessos devem expulsar as falhas
    let clock = 0;
    const cb = new CircuitBreaker({
      minimumCalls: 5, window: 5, errorThreshold: 0.5, cooldownMs: 100, now: () => clock,
    });
    await driveFailures(cb, 5);
    expect(cb.state).toBe(State.OPEN);

    clock = 200; // passa o cooldown -> proxima chamada e HALF_OPEN
    await cb.execute(ok); // sucesso em HALF_OPEN reseta a janela
    expect(cb.results.length).toBeLessThanOrEqual(5);
    expect(cb.state).toBe(State.CLOSED);
  });

  test('a janela nunca excede o tamanho configurado', async () => {
    const cb = new CircuitBreaker({ minimumCalls: 100, window: 3, errorThreshold: 0.99 });
    for (let i = 0; i < 10; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await cb.execute(ok);
    }
    expect(cb.results.length).toBe(3);
  });
});

describe('CircuitBreaker — cooldown e HALF_OPEN', () => {
  function abreBreaker(now) {
    const cb = new CircuitBreaker({
      minimumCalls: 5, window: 10, errorThreshold: 0.5, cooldownMs: 1000, now,
    });
    return cb;
  }

  test('permanece OPEN e falha rapido ANTES do cooldown expirar', async () => {
    let clock = 0;
    const cb = abreBreaker(() => clock);
    await driveFailures(cb, 5);
    expect(cb.state).toBe(State.OPEN);

    clock = 999; // ainda dentro do cooldown (999 < 1000)
    const spy = jest.fn(ok);
    await expect(cb.execute(spy)).rejects.toThrow(CircuitOpenError);
    expect(spy).not.toHaveBeenCalled();
    expect(cb.state).toBe(State.OPEN);
  });

  test('transiciona para HALF_OPEN exatamente quando cooldown expira (limite >=)', async () => {
    let clock = 0;
    const cb = abreBreaker(() => clock);
    await driveFailures(cb, 5);

    clock = 1000; // now - openedAt == cooldownMs => deve permitir a sonda
    const result = await cb.execute(ok);
    expect(result).toBe('ok');
    expect(cb.state).toBe(State.CLOSED); // sucesso na sonda fecha
  });

  test('falha na sonda HALF_OPEN reabre o circuito imediatamente', async () => {
    let clock = 0;
    const cb = abreBreaker(() => clock);
    await driveFailures(cb, 5);

    clock = 1500; // expira cooldown -> HALF_OPEN na proxima
    await cb.execute(fail).catch(() => {});
    expect(cb.state).toBe(State.OPEN); // sonda falhou => reabre
    expect(cb.openedAt).toBe(1500); // reabriu no instante atual
  });

  test('usa subtracao correta no calculo do cooldown (now - openedAt)', async () => {
    // Abre o breaker num instante NAO-zero: assim soma e subtracao divergem.
    // Se o operador fosse '+', o tempo decorrido aparente seria openedAt+now
    // (enorme), e o breaker sondaria cedo demais OU nunca, mudando o resultado.
    let clock = 5000;
    const cb = new CircuitBreaker({
      minimumCalls: 5, window: 10, errorThreshold: 0.5, cooldownMs: 1000, now: () => clock,
    });
    await driveFailures(cb, 5);
    expect(cb.openedAt).toBe(5000);

    // decorrido real = 5500 - 5000 = 500 < 1000 => ainda OPEN, falha rapido.
    clock = 5500;
    await expect(cb.execute(ok)).rejects.toThrow(CircuitOpenError);

    // decorrido real = 6000 - 5000 = 1000 >= 1000 => sonda liberada.
    clock = 6000;
    await expect(cb.execute(ok)).resolves.toBe('ok');
  });
});

describe('CircuitBreaker — caminho fechado normal', () => {
  test('sucesso consecutivo mantem o circuito fechado e registra sucesso', async () => {
    const cb = new CircuitBreaker();
    await cb.execute(ok);
    await cb.execute(ok);
    expect(cb.state).toBe(State.CLOSED);
    expect(cb._failureRatio()).toBe(0);
  });

  test('_failureRatio retorna 0 com a janela vazia', () => {
    const cb = new CircuitBreaker();
    expect(cb._failureRatio()).toBe(0);
  });

  test('_failureRatio calcula a proporcao correta de falhas', async () => {
    const cb = new CircuitBreaker({ minimumCalls: 100, window: 10, errorThreshold: 0.99 });
    await cb.execute(ok);
    await driveFailures(cb, 3); // 3 falhas em 4 chamadas
    expect(cb._failureRatio()).toBeCloseTo(3 / 4, 5);
  });
});

describe('CircuitBreaker — contrato de estados e reset', () => {
  test('valores dos estados sao estaveis e distintos', () => {
    expect(State.CLOSED).toBe('CLOSED');
    expect(State.OPEN).toBe('OPEN');
    expect(State.HALF_OPEN).toBe('HALF_OPEN');
    const vals = Object.values(State);
    expect(new Set(vals).size).toBe(vals.length);
    vals.forEach((v) => expect(v.length).toBeGreaterThan(0));
  });

  test('reset esvazia completamente a janela de resultados', async () => {
    let clock = 0;
    const cb = new CircuitBreaker({
      minimumCalls: 5, window: 10, errorThreshold: 0.5, cooldownMs: 100, now: () => clock,
    });
    await driveFailures(cb, 5); // abre, janela cheia de falhas
    expect(cb.results.length).toBeGreaterThan(0);

    clock = 200;
    await cb.execute(ok); // sonda bem-sucedida => _reset (esvazia a janela)
    expect(cb.results).toEqual([]); // _reset zera a janela apos o sucesso
    expect(cb.openedAt).toBeNull();
    expect(cb.state).toBe(State.CLOSED);
  });

  test('falha repetida em HALF_OPEN nao usa o caminho do limiar (reabre direto)', async () => {
    // Garante que o ramo HALF_OPEN de _onFailure e distinto do ramo CLOSED:
    // com apenas 1 falha (abaixo de minimumCalls) o circuito reabre porque
    // esta sondando, nao porque cruzou o limiar.
    let clock = 0;
    const cb = new CircuitBreaker({
      minimumCalls: 5, window: 10, errorThreshold: 0.5, cooldownMs: 1000, now: () => clock,
    });
    await driveFailures(cb, 5);
    clock = 1000; // HALF_OPEN na proxima
    await cb.execute(fail).catch(() => {}); // 1 unica falha na sonda
    expect(cb.state).toBe(State.OPEN); // reabriu apesar de < minimumCalls
  });
});
