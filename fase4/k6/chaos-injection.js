import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    checkout_black_friday: {
      executor: 'ramping-vus',
      stages: [
        { duration: '30s', target: 20 },
        { duration: '30s', target: 50 },
        { duration: '30s', target: 50 },
        { duration: '30s', target: 0 },
      ],
      exec: 'checkout',
    },

    thundering_herd_cache_flush: {
      executor: 'constant-vus',
      vus: 5,
      duration: '20s',
      startTime: '45s',
      exec: 'cacheFlush',
    },
  },

  thresholds: {
    http_req_duration: ['p(95)<5000'],
    http_req_failed: ['rate<0.10'],
  },
};

export function checkout() {
  const payload = JSON.stringify({
    clienteEmail: `caos-${__VU}-${__ITER}@email.com`,
    valor: 199.9,
    cartao: {
      numero: '4111111111111111',
      validade: '12/2030',
      cvv: '123',
    },
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(
    'http://localhost:3000/api/v1/checkout',
    payload,
    params
  );

  check(res, {
    'checkout respondeu sem queda total': (r) => r.status === 200 || r.status === 500,
    'sem timeout total': (r) => r.status !== 0,
  });

  sleep(1);
}

export function cacheFlush() {
  const res = http.post('http://localhost:3000/api/v1/cache/flush');

  check(res, {
    'cache flush respondeu': (r) => r.status === 200,
  });

  sleep(1);
}