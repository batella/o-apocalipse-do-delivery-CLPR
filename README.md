# O Apocalipse do Delivery

Integrantes: Caio Batella, Lucas de Carvalho, Pedro Silva, Rodrigo Diniz

Blindagem do microsserviço de Processamento de Pedidos e Checkout da plataforma EntregasJá, garantindo resiliência contra falhas de dependências externas (gateway, cache) e alta volumetria.

## Status das Fases

| Fase | Descrição | Status |
|------|-----------|--------|
| 1 | Análise Estrutural e Métricas | Concluída |
| 2 | Redesenho com TDD, BDD e Padrões | Concluída |
| 3 | Teste de Mutação (Stryker) | Concluída |
| 4 | Caos e Testes de Desempenho (k6 + Toxiproxy) | Pendente |

## Documentação

- [fase1-analise-estrutural.md](docs/fase1-analise-estrutural.md)
- [fase2-redesenho.md](docs/fase2-redesenho.md)
- [fase3-mutacao.md](docs/fase3-mutacao.md)

## Estrutura do Projeto

```
src/
  server.js                    # Express com endpoints de checkout
  services/
    CheckoutService.js         # Lógica principal (redesenhada)
    OrderValidator.js          # Validação de pedidos
    CircuitBreaker.js          # Proteção contra falhas em cascata
    retry.js                   # Retry com Backoff e Jitter
    withTimeout.js             # Wrapper de Timeout
  domain/
    OrderStatus.js             # Estados de pedido
  errors/
    index.js                   # Erros customizados

test/
  unit/                        # Testes unitários com Mocks/Stubs
  integration/                 # Testes BDD (Cucumber)
  builders/
    PedidoBuilder.js           # Data Builder
    PedidoMother.js            # Object Mother
    doubles.js                 # Mocks e Stubs

features/
  checkout.feature             # Cenários BDD (Gherkin)

reports/
  mutation/
    mutation.html              # Relatório visual de mutação
    mutation.json              # Dados brutos

docs/
  CheckoutService.legacy.js.txt  # Componente original
  especificacao.md               # Especificação funcional
  fase1-analise-estrutural.md    # Análise de complexidade
  fase2-redesenho.md             # Padrões aplicados
  fase3-mutacao.md               # Resultados de mutação
```

## Fase 1: Análise Estrutural, Complexidade e Métricas

- Grafo de Fluxo de Controle do método processar(pedido)
- Complexidade Ciclomática V(G) calculada
- Estimativas de esforço em horas/homem

## Fase 2: Redesenho com TDD, BDD e Padrões

- BDD com Gherkin em features/checkout.feature
- Cenários: pagamento aprovado, cartão recusado, timeout do gateway, erros de infraestrutura
- Padrões aplicados: Circuit Breaker, Retry com Backoff, Timeout Wrapper
- Data Builder e Object Mother para fabricação de testes
- Refatoração: Extract Method, eliminação de if/else excessivos

## Fase 3: Teste de Mutação

- Stryker.js configurado
- Mutation Score: 80% alcançado
- Relatório em reports/mutation/mutation.html
- Validação de que cobertura de linhas != eficácia

## Como Executar

```bash
npm install
npm test                              # Testes unitários
npm run test:bdd                      # Testes BDD
npm run test:mutation                 # Teste de mutação
node gerar-relatorio.js               # Gera relatório
```

## Tecnologias

Node.js, Express, Jest, Cucumber (Gherkin), Stryker.js, k6 (próximo), Toxiproxy (próximo)
