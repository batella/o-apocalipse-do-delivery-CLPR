'use strict';

const http = require('http');

const server = http.createServer((req, res) => {
  // Simula 100ms de latência natural do gateway externo
  setTimeout(() => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'APROVADO' }));
  }, 100);
});

const PORT = 9000;
if (require.main === module) {
  server.listen(PORT, () => console.log(`Mock Gateway externo rodando na porta ${PORT}`));
}

module.exports = server;
