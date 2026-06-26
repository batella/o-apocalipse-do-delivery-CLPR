# Fase 4 - Engenharia do Caos e Testes de Desempenho

## 1. Objetivo

Esta fase teve como objetivo avaliar a resiliência e o desempenho do microsserviço de checkout da plataforma EntregasJá em cenários próximos aos de Black Friday, considerando carga elevada, estresse e injeção de falhas controladas.

## 2. Ferramentas utilizadas

- Node.js
- Express
- k6
- PowerShell
- Visual Studio Code

## 3. Endpoints avaliados

- POST `/api/v1/checkout`
- POST `/api/v1/cache/flush`

## 4. SLI e SLO definidos

| Métrica | SLO definido |
|---|---|
| Latência p95 | Menor que 5000 ms |
| Taxa de erro em carga normal | Menor que 5% |
| Taxa de erro em caos | Menor que 10% |
| Disponibilidade funcional | Sem queda total do serviço |

## 5. Teste Black Friday Load

O teste `blackfriday-load.js` simulou uma carga de 10 usuários virtuais durante 30 segundos, acessando o endpoint crítico de checkout.

### Resultado observado

- Requisições: 230
- Checks: 460
- Sucesso: 100%
- Taxa de erro: 0.00%
- p95: 318.63 ms
- SLO mantido: Sim

### Análise

O sistema respondeu corretamente durante toda a execução do teste. A latência p95 ficou muito abaixo do limite definido de 5000 ms e não houve falhas nas requisições.

## 6. Teste de Caos - Thundering Herd

O teste `chaos-injection.js` executou dois cenários simultâneos: carga no checkout e chamadas ao endpoint de limpeza de cache `/api/v1/cache/flush`, simulando uma invalidação abrupta de cache durante alta demanda.

### Resultado observado

- Requisições: 2877
- Checks: 5654
- Sucesso: 100%
- Taxa de erro: 0.00%
- p95: 315.74 ms
- Usuários virtuais máximos: 55
- SLO mantido: Sim

### Análise

Mesmo durante a simulação de Thundering Herd, a aplicação continuou respondendo sem queda total, mantendo os thresholds definidos. O endpoint de checkout respondeu corretamente e o endpoint de cache flush também se manteve operacional.

## 7. MTTR

Como a aplicação não apresentou falha total durante os testes executados, não houve necessidade de recuperação operacional. Assim, para o cenário testado, o MTTR observado foi considerado igual a 0 segundos.

## 8. Conclusão

Os testes de desempenho e caos demonstraram que o microsserviço de checkout apresentou comportamento estável sob carga controlada e durante a injeção de falha simulada de cache. A aplicação manteve 100% de sucesso nos checks, taxa de erro de 0% e latência p95 abaixo do SLO definido. Dessa forma, o sistema apresentou degradação graciosa e não sofreu efeito cascata durante os cenários avaliados.