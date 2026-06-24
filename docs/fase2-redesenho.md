# FASE 2 — Redesenho com TDD, BDD e Padrões de Projeto

## Como executar

```bash
npm install
npm test              # toda a suíte (unit + BDD)  → 44 testes
npm run test:coverage # cobertura (~96% linhas)
npm run test:bdd      # apenas cenários Gherkin
npm run test:mutation # Stryker (preparado para a Fase 3)
```

## Estrutura

```
src/
  domain/OrderStatus.js        # enums de status (pedido + gateway)
  errors/index.js              # hierarquia: Validation / Infrastructure / Timeout / CircuitOpen
  services/
    OrderValidator.js          # RN01 — validação de entrada
    withTimeout.js             # RN04 — timeout de 2s por tentativa
    retry.js                   # RN05/RN06 — 3 retries, backoff 500ms + jitter
    CircuitBreaker.js          # RN07 — fail-fast acima de 50% de falha
    CheckoutService.js         # orquestração + CheckoutResult
features/
  checkout.feature             # 5 cenários Gherkin (pt) — Fluxos 1 a 5 do DER
test/
  builders/PedidoBuilder.js    # Data Builder
  builders/PedidoMother.js     # Object Mother (sobre o Builder)
  builders/doubles.js          # Stubs (estado) — Mocks ficam nos testes (jest.fn)
  unit/                        # testes unitários (service, resiliência, validador)
  integration/checkout.steps.js# step defs jest-cucumber
```

## Mapa Regra → Implementação → Teste

| Regra | Implementação | Verificação |
|---|---|---|
| RN01 validação | OrderValidator | Fluxo 5, OrderValidator.test |
| RN02 aprovado + e-mail async | _handleApproved / _notifyAsync | Fluxo 1 (Mock de e-mail) |
| RN03 recusa sem e-mail | _handleDeclined | Fluxo 2 (Mock não chamado) |
| RN04 timeout 2s | withTimeout | resilience.test |
| RN05/RN06 retry+backoff | retry | Fluxo 3, resilience.test |
| RN07 circuit breaker | CircuitBreaker | Fluxo 4, resilience.test |

Relatório completo: `docs/Fase2-Relatorio.docx`.
Código legado preservado em `docs/CheckoutService.legacy.js.txt`.
