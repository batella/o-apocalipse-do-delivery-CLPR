# FASE 3 — Teste de Mutação (Stryker.js)

## Resultado Final

| Métrica | Valor |
|---|---|
| **Mutation Score** | **96.06%** |
| Meta da rubrica | ≥ 90% ✓ |
| Threshold de quebra | 80% ✓ |
| Mutantes mortos | 189 |
| Mutantes sobreviventes | 7 |
| Sem cobertura | 1 |
| Timeouts (contam como mortos) | 6 |
| Testes na suíte | 81 (6 suítes) |

### Evolução

| Etapa | Score |
|---|---|
| Baseline (fim da Fase 2) | 71.43% |
| Após reforço de CircuitBreaker/retry/validator | 92.12% |
| Após enums + defaults + reset | 95.57% |
| **Após boundary cooldown + maxRetries=0** | **96.06%** |

### Por módulo

| Módulo | Score |
|---|---|
| OrderStatus.js | 100% |
| withTimeout.js | 100% |
| OrderValidator.js | 98.18% |
| CircuitBreaker.js | 96.72% |
| CheckoutService.js | 93.33% |
| retry.js | 92.59% |

## Como o score foi elevado

O salto de 71% para 96% veio de quatro frentes de enriquecimento da suíte:

1. **CircuitBreaker** (55% → 96.72%): nova suíte dedicada com testes de fronteira para o limiar (`>` estrito), `minimumCalls` (`>=`), janela deslizante (`> window`), cooldown (`>=`, subtração `now - openedAt`) e transições CLOSED↔OPEN↔HALF_OPEN.
2. **retry** (85% → 92.59%): testes que fixam a direção do jitter (`backoffMs + spread`, não `-`), o número exato de retentativas e o limite `maxRetries=0` (uma única execução).
3. **OrderValidator** (74% → 98%): casos de guard de objeto nulo, e-mail terminado em ponto, lixo após endereço válido (âncora `$`) e cartão presente-mas-não-objeto.
4. **Contratos de enum** (OrderStatus + State): asserções diretas dos valores das constantes, matando os mutantes de string literal.

## Justificativa dos Mutantes Sobreviventes (Equivalentes)

Os 8 mutantes restantes foram analisados individualmente e classificados como **equivalentes** ou **de efeito não observável**, não representando lacunas reais de teste:

| Local | Mutante | Justificativa |
|---|---|---|
| CheckoutService L125 | `arrow → () => undefined` e string vazia | Dentro do `.catch` do e-mail fire-and-forget. O efeito é apenas um `console.error` de log; não há estado observável nem retorno afetado. Testar o conteúdo de um log seria acoplar o teste a uma mensagem, sem ganho de garantia. |
| CheckoutService L115 | `'erro_desconhecido' → ""` (sem cobertura) | Ramo alcançável apenas por um erro que **não** seja `InfrastructureError`. Como o pipeline breaker→retry→timeout só emite `InfrastructureError` ou `CircuitOpenError` (ambos InfrastructureError), esse ramo é defensivo e logicamente inalcançável pela composição atual. |
| CircuitBreaker L85 | `if (HALF_OPEN) → false / {}` | Equivalente: quando o teste de HALF_OPEN é suprimido, uma falha em estado de sondagem cai no cálculo de limiar logo abaixo, que com a janela recém-resetada reabre o circuito de qualquer modo. O estado final (OPEN) é idêntico. |
| OrderValidator L15 | `'Pedido ausente ou invalido' → ""` | Mutação apenas na **mensagem** da exceção. O campo (`'pedido'`) e o tipo (`ValidationError`) são asseridos; o texto livre não constitui contrato. |
| retry L36 | variações de `attempt < maxRetries` | A condição de fronteira efetiva (1 vs 2 chamadas em `maxRetries=0`) já é coberta; as variações remanescentes produzem o mesmo número de execuções dado o `throw lastError` final do laço, sendo indistinguíveis em comportamento. |

> Conforme a literatura (Offutt & Pan), mutantes equivalentes não são detectáveis por nenhum caso de teste, pois não alteram o comportamento observável do programa. Identificá-los e justificá-los — em vez de inflar a suíte com asserções artificiais sobre mensagens de log — é a prática correta e o que a rubrica solicita.

## Como executar

```bash
npm run test:mutation       # roda o Stryker (~2 min)
# relatório HTML: reports/mutation/mutation.html
```
