import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<5000'],
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  const payload = JSON.stringify({
    clienteEmail: `cliente-${__VU}-${__ITER}@email.com`,
    valor: 149.9,
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
    'status 200': (r) => r.status === 200,
    'p95 abaixo de 5s': (r) => r.timings.duration < 5000,
  });

  sleep(1);
}