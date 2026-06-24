# FASE 1 — Análise Estrutural, Complexidade e Métricas de Estimativa

**Componente Auditado:** `src/services/CheckoutService.js`  
**Método Principal:** `processar(pedido)`  

---

## 1. Mapeamento de Fluxo — Grafo de Fluxo de Controle (CFG)

### 1.1 Identificação dos Nós

| Nó | Linha(s) | Descrição |
|---|---|---|
| **N1** | — | ENTRADA — início de `processar(pedido)` |
| **N2** | 11 | `gatewayPagamento.cobrar(valor, cartao)` — chamada ao gateway (ponto de possível exceção) |
| **N3** | 13 | **DECISÃO** — `if (resposta.status === 'APROVADO')` |
| **N4** | 14–20 | Bloco APROVADO: `status='PROCESSADO'` → `salvar` → `enviarConfirmacao` → `return pedidoSalvo` |
| **N5** | 22–25 | Bloco ELSE (RECUSADO): `status='FALHOU'` → `salvar` → `return null` |
| **N6** | 27–34 | Bloco CATCH: `console.error` → `status='ERRO_GATEWAY'` → `salvar` → `return null` |
| **N7** | — | SAÍDA — fim do método |

### 1.2 Identificação das Arestas

| Aresta | De → Para | Condição / Gatilho |
|---|---|---|
| E1 | N1 → N2 | Fluxo sequencial de entrada |
| E2 | N2 → N3 | `await` resolvido sem exceção |
| E3 | N2 → N6 | `await` lança exceção (timeout, erro de rede, etc.) |
| E4 | N3 → N4 | `resposta.status === 'APROVADO'` (true) |
| E5 | N3 → N5 | `resposta.status !== 'APROVADO'` (false / RECUSADO) |
| E6 | N4 → N7 | Sequência após bloco APROVADO |
| E7 | N5 → N7 | Sequência após bloco ELSE |
| E8 | N6 → N7 | Sequência após bloco CATCH |

### 1.3 Diagrama do CFG

```
        ┌─────────┐
        │  N1     │  ENTRADA
        │ processar│
        └────┬────┘
             │ E1
        ┌────▼────┐
        │  N2     │  cobrar(valor, cartao)
        │ [await] │◄──── ponto de exceção
        └────┬────┘
         E2  │  E3 (exceção)
    ┌────────┘   └───────────────────────┐
    │                                    │
┌───▼────┐                          ┌───▼────┐
│   N3   │  DECISÃO                 │   N6   │  CATCH
│  [if]  │  status === 'APROVADO'?  │        │  ERRO_GATEWAY
└───┬────┘                          └───┬────┘
 E4 │ true    E5 false                  │ E8
    │          │                        │
┌───▼────┐ ┌──▼─────┐                  │
│   N4   │ │   N5   │                  │
│APROVADO│ │RECUSADO│                  │
│PROCESSADO│ │FALHOU  │                │
└───┬────┘ └──┬─────┘                  │
    │ E6       │ E7                    │
    └────┬─────┘                       │
         │         ┌───────────────────┘
    ┌────▼────┐
    │  N7     │  SAÍDA
    │ [return]│
    └─────────┘
```

### 1.4 Contagem de Elementos

```
Nós  (N) = 7
Arestas (E) = 8
Componentes conectados (P) = 1
```

---

## 2. Complexidade Ciclomática — V(G)

### 2.1 Cálculo Matemático

**Fórmula de McCabe:**

```
V(G) = E − N + 2P
V(G) = 8 − 7 + 2(1)
V(G) = 3
```

**Verificação por contagem de predicados:**

| Predicado (decisão binária) | Nó |
|---|---|
| `if (resposta.status === 'APROVADO')` | N3 |
| Bloco `try/catch` — desvio de fluxo por exceção | E3: N2 → N6 |

```
V(G) = número de predicados + 1
V(G) = 2 + 1 = 3  ✓
```

### 2.2 Caminhos Independentes Mínimos (Base Path Set)

V(G) = **3** determina o número mínimo de caminhos independentes que a suíte de testes precisa cobrir:

| Caminho | Sequência de Nós | Condição de Ativação | Status do Pedido | Resposta HTTP |
|---|---|---|---|---|
| **P1** — Pagamento Aprovado | N1 → N2 → N3 → N4 → N7 | Gateway retorna `APROVADO` | `PROCESSADO` | 200 OK |
| **P2** — Pagamento Recusado | N1 → N2 → N3 → N5 → N7 | Gateway retorna `RECUSADO` | `FALHOU` | 500 Error |
| **P3** — Falha de Infraestrutura | N1 → N2 → N6 → N7 | `await` lança exceção | `ERRO_GATEWAY` | 500 Error |

> V(G) = 3 indica complexidade baixa. Contudo, o risco real do componente não é estrutural — é a ausência de mecanismos de resiliência (timeout, retry, circuit breaker) que serão implementados na Fase 2.

---

## 3. Métricas e Estimativas de Teste — TPA (Test Point Analysis)

### 3.1 Técnica Utilizada

**Test Point Analysis (TPA)** — estimativa estruturada baseada em Pontos de Função ajustados por fatores de complexidade de teste, conforme técnica apresentada em sala. A fórmula base é:

```
Pontos de Teste (PT) = Σ (FP_i × Fator_Complexidade_i)
Esforço (horas) = PT × Produtividade × Fator Ambiental × Fator de Controle
```

### 3.2 Passo 1 — Tamanho Funcional (Pontos de Função — NESMA Simplificada)

| Tipo | Funcionalidade | DETs | FTRs | Complexidade | FP |
|---|---|---|---|---|---|
| EI — Entrada Externa | Payload de checkout (`clienteEmail`, `valor`, `cartao`) | 3 | 1 | Simples | 3 |
| EO — Saída de Sucesso | Resposta 200 OK (mensagem + pedido com `id`) | 5 | 1 | Simples | 4 |
| EO — Saída de Erro | Respostas 400 / 500 (mensagem de erro) | 2 | 0 | Simples | 4 |
| EIF — Interface Externa | Gateway de Pagamento (`cobrar`: 3 cenários de resposta) | 4 | — | Simples | 5 |
| EIF — Interface Externa | Email Service (`enviarConfirmacao`: disparo condicional) | 2 | — | Simples | 5 |
| ILF — Arquivo Lógico Interno | PedidoRepository (4 status possíveis, 5 campos) | 5 | 1 | Simples | 7 |

```
Total de Pontos de Função (FP) = 3 + 4 + 4 + 5 + 5 + 7 = 28 FP
```

### 3.3 Passo 2 — Estratégia e Níveis de Teste

| Nível | Objetivo | Ferramentas Planejadas |
|---|---|---|
| Unitário | Testar `processar()` em isolamento com Stubs/Mocks | Jest |
| Integração | Validar a integração service ↔ repository e service ↔ gateway | Jest |
| BDD / Aceitação | Cobrir os cenários de negócio descritos no DER | Cucumber.js |
| Performance / Caos | Testar comportamento sob carga massiva e falhas injetadas | k6 + Toxiproxy |

### 3.4 Passo 3 — Pontos de Teste por Funcionalidade

| Funcionalidade | FP | Complexidade de Teste | Peso | Pontos de Teste (PT) |
|---|---|---|---|---|
| Gateway de Pagamento (3 caminhos + exceções) | 10 | Alta — integração externa, múltiplos cenários | 1,3 | **13,0 PT** |
| PedidoRepository (4 estados distintos) | 7 | Média — efeitos colaterais no banco | 1,1 | **7,7 PT** |
| Email Service (disparo condicional) | 5 | Média — comportamento observável via mock | 1,1 | **5,5 PT** |
| Validação de entrada (3 campos obrigatórios) | 3 | Baixa — lógica simples de presença | 1,0 | **3,0 PT** |
| Saídas HTTP (200 / 400 / 500) | 3 | Baixa — mapeamento direto de status | 1,0 | **3,0 PT** |
| **TOTAL** | **28 FP** | — | — | **32,2 PT** |

```
PT = Σ(FP_i × Peso_i)
PT = 13,0 + 7,7 + 5,5 + 3,0 + 3,0 = 32,2 Pontos de Teste
```

### 3.5 Passo 4 — Conversão em Esforço (Horas/Homem)

| Fator | Valor | Justificativa |
|---|---|---|
| Produtividade base | 2 h/PT | Referência de sala para projetos JavaScript/Node.js |
| Fator Ambiental | 1,1 | Time novo no projeto, ambiente sem histórico prévio |
| Fator de Controle | 0,9 | Componente isolado com especificação formal disponível |

```
Horas Primárias = 32,2 PT × 2 h/PT = 64,4 h

Esforço Total = 64,4 × 1,1 × 0,9 = 63,8 h ≈ 64 horas/homem
```

### 3.6 Passo 5 — Distribuição do Esforço e Recursos Necessários

**Por tipo de teste:**

| Tipo de Teste | % | Horas Estimadas |
|---|---|---|
| Testes Unitários — Jest + Stubs/Mocks | 45% | ≈ 29 h |
| Testes de Integração | 20% | ≈ 13 h |
| BDD — Cenários Gherkin | 15% | ≈ 10 h |
| Testes de Mutação — Stryker.js | 10% | ≈ 6 h |
| Performance e Caos — k6 + Toxiproxy | 10% | ≈ 6 h |
| **TOTAL** | **100%** | **≈ 64 h** |

**Alocação de recursos:**

| Recurso | Quantidade | Carga |
|---|---|---|
| Desenvolvedores/Testadores | 4 membros | ≈ 16 h por pessoa |
| Ambiente de testes (Docker + Toxiproxy) | 1 setup | ≈ 4 h (única vez) |
| Ferramentas (Jest, Stryker, k6) | 1 setup | ≈ 3 h (única vez) |
| **Duração estimada** | Sprint de 2 semanas | 10 dias úteis |

> **Conclusão:** A estimativa TPA aponta **~64 horas/homem** para cobertura completa do `CheckoutService`, o que representa **~16 horas por integrante** em um sprint de 2 semanas — viável em paralelo ao desenvolvimento das demais fases.

---
