'use strict';

const express = require('express');
const { CheckoutService } = require('./services/CheckoutService');
const { ValidationError } = require('./errors');
const { GatewayStatus } = require('./domain/OrderStatus');

const app = express();
app.use(express.json());

// Mocks de infraestrutura para rodar localmente antes do Toxiproxy (Fase 4).
// O gateway chama a porta 8666 (Toxiproxy) → 9000 (mockGatewayServer).
// Assim a latência injetada pelo Toxiproxy afeta de verdade o processamento.
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:8666';

const gatewayPagamentoMock = {
  cobrar: async (valor, cartao) => {
    const res = await fetch(`${GATEWAY_URL}/cobrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valor, cartao }),
    });
    return res.json();
  },
};

const pedidoRepositoryMock = {
  salvar: async (pedido) => ({ ...pedido, id: Math.floor(Math.random() * 10000) }),
};

const emailServiceMock = {
  enviarConfirmacao: async (email) => console.log(`E-mail enviado para ${email}`),
};

const checkoutService = new CheckoutService(
  gatewayPagamentoMock,
  pedidoRepositoryMock,
  emailServiceMock,
);

// ENDPOINT CRITICO: rota que recebera a carga massiva da Black Friday.
app.post('/api/v1/checkout', async (req, res) => {
  const { clienteEmail, valor, cartao } = req.body;
  const pedido = { clienteEmail, valor, cartao, status: 'PENDENTE' };

  try {
    const resultado = await checkoutService.processar(pedido);

    if (resultado.success) {
      return res.status(200).json({ mensagem: 'Pedido finalizado com sucesso!', pedido: resultado.order });
    }
    // RN03 / RN07: recusa de negocio ou fallback de infraestrutura.
    return res.status(500).json({ erro: 'Nao foi possivel processar seu pagamento. Tente mais tarde.', motivo: resultado.reason });
  } catch (error) {
    if (error instanceof ValidationError) {
      // RN01: aborta antes de tocar gateway/banco.
      return res.status(400).json({ erro: 'Dados incompletos para checkout', campo: error.field });
    }
    // Rede de seguranca: nunca deixa uma excecao nao tratada derrubar o Node.
    console.error('Erro inesperado no checkout:', error.message);
    return res.status(500).json({ erro: 'Erro interno inesperado.' });
  }
});

// Endpoint auxiliar para simular Thundering Herd (Fase 4).
app.post('/api/v1/cache/flush', (req, res) => {
  console.log('CACHE LIMPO ABRUPTAMENTE!');
  res.json({ status: 'cache_invalidated' });
});

const PORT = 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Servidor da EntregasJa rodando na porta ${PORT}`));
}

module.exports = { app };
