'use strict';

const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, LevelFormat, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageBreak,
} = require('docx');

const BLUE = '1F4E78';
const GREY = 'CCCCCC';
const HEADER_FILL = 'D5E8F0';
const CONTENT_W = 9360;

const border = { style: BorderStyle.SINGLE, size: 1, color: GREY };
const borders = { top: border, bottom: border, left: border, right: border };

function h1(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });
}
function h2(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
}
function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
    children: [new TextRun({ text, ...opts })],
  });
}
function code(text) {
  return new Paragraph({
    spacing: { after: 100 },
    shading: { fill: 'F2F2F2', type: ShadingType.CLEAR },
    children: [new TextRun({ text, font: 'Consolas', size: 20 })],
  });
}
function bullet(text) {
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { after: 60 },
    children: [new TextRun(text)],
  });
}

function cell(text, { widthPct, header = false, bold = false } = {}) {
  const width = Math.round(CONTENT_W * widthPct);
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: header ? { fill: HEADER_FILL, type: ShadingType.CLEAR } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({ children: [new TextRun({ text, bold: header || bold, size: 20 })] })],
  });
}

function table(headerRow, rows, widths) {
  const columnWidths = widths.map((w) => Math.round(CONTENT_W * w));
  const mkRow = (cells, header) => new TableRow({
    children: cells.map((c, i) => cell(c, { widthPct: widths[i], header })),
    tableHeader: header,
  });
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths,
    rows: [mkRow(headerRow, true), ...rows.map((r) => mkRow(r, false))],
  });
}

const spacer = () => new Paragraph({ children: [new TextRun('')], spacing: { after: 80 } });

const children = [];

// ---- CAPA ----
children.push(
  new Paragraph({ spacing: { before: 2400, after: 120 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'O Apocalipse do Delivery', bold: true, size: 56, color: BLUE })] }),
  new Paragraph({ spacing: { after: 480 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Microsserviço de Checkout — EntregasJá', size: 32, color: '404040' })] }),
  new Paragraph({ spacing: { after: 120 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'FASE 2 — Redesenho com TDD, BDD e Padrões de Projeto', bold: true, size: 30 })] }),
  new Paragraph({ spacing: { after: 1200 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Relatório Técnico de Refatoração e Cobertura de Testes', italics: true, size: 24, color: '606060' })] }),
  new Paragraph({ spacing: { after: 60 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Grupo CLPR', bold: true, size: 24 })] }),
  new Paragraph({ spacing: { after: 60 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Caio Batella · Lucas de Carvalho · Pedro Silva · Rodrigo Diniz', size: 22 })] }),
  new Paragraph({ spacing: { after: 60 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'PUC Minas — Engenharia / Teste de Software — 2026.1', size: 22, color: '606060' })] }),
  new Paragraph({ children: [new PageBreak()] }),
);

// ---- 1. INTRODUÇÃO ----
children.push(h1('1. Objetivo e Escopo da Fase 2'));
children.push(p('Esta fase parte do componente legado CheckoutService.processar(pedido) — auditado na Fase 1, com complexidade ciclomática V(G) = 3 — e o redesenha de forma limpa, dirigida por testes (TDD), especificada por comportamento (BDD) e blindada por padrões de projeto, atendendo às regras RN01 a RN07 do DER. As quatro frentes obrigatórias foram cobertas: especificação viva em Gherkin; ciclo Vermelho-Verde-Refatore; Test Patterns (Data Builder + Object Mother, Stubs e Mocks); e refatorações de Fowler para remover os blocos de if/else e o disparo de e-mail síncrono acoplado.'));

// ---- 2. TEST SMELLS ----
children.push(h1('2. Test Smells e Code Smells Identificados no Legado'));
children.push(p('A auditoria do código original revelou os seguintes problemas estruturais, que guiaram a refatoração:'));
children.push(table(
  ['Smell', 'Onde / Sintoma', 'Refatoração Aplicada (Fowler)'],
  [
    ['E-mail síncrono acoplado', 'await enviarConfirmacao dentro do fluxo de aprovação retém a resposta HTTP', 'Extract Method → _notifyAsync (fire-and-forget, RN02)'],
    ['Blocos if/else + try/catch monolíticos', 'Decisão de fluxo e tratamento de erro misturados em um único método', 'Replace Conditional → _handleApproved / _handleDeclined / _handleInfrastructureFailure'],
    ['Retorno de null ambíguo', 'return null tanto para recusa quanto para erro de infra — perde a intenção', 'Introduce Result Object → CheckoutResult'],
    ['Validação na camada de controle', 'Checagem de campos misturada no server.js', 'Extract Class → OrderValidator (RN01)'],
    ['Ausência de resiliência', 'Sem timeout, retry ou circuit breaker — falha bruta', 'Strategy/Decorator → withTimeout, retry, CircuitBreaker'],
    ['Obscure Setup nos testes', 'Montagem manual e repetida de objetos pedido', 'Data Builder + Object Mother'],
  ],
  [0.24, 0.40, 0.36],
));
children.push(spacer());

// ---- 3. ARQUITETURA REFATORADA ----
children.push(h1('3. Arquitetura Refatorada'));
children.push(p('O pipeline de processamento foi decomposto em responsabilidades únicas. A resiliência é composta em camadas, de modo que cada mecanismo trate exatamente um aspecto da tolerância a falhas:'));
children.push(code('validar(RN01) → breaker( retry( timeout( gateway ) ) ) → persistir + notificar'));
children.push(p('Leitura das camadas, de dentro para fora:'));
children.push(bullet('withTimeout (RN04): encerra uma tentativa individual que ultrapasse 2000 ms, liberando o pool de threads do Express.'));
children.push(bullet('retry (RN05/RN06): reexecuta até 3 vezes, com backoff fixo de 500 ms acrescido de jitter para evitar a ressincronização da Manada Estourada (Thundering Herd) da Fase 4.'));
children.push(bullet('CircuitBreaker (RN07): abre o disjuntor quando a taxa de falha acumulada ultrapassa 50%, falhando rápido com CircuitOpenError e protegendo o servidor.'));
children.push(p('Falhas de infraestrutura (InfrastructureError) são retryable; recusas de negócio e erros de validação não são. Essa distinção, codificada na hierarquia de erros, impede o sistema de insistir em um cartão recusado e garante o disparo seletivo dos mecanismos de resiliência.'));

children.push(h2('3.1 Componentes Produzidos'));
children.push(table(
  ['Arquivo', 'Responsabilidade', 'Regra'],
  [
    ['OrderValidator.js', 'Validação de entrada (e-mail, valor, cartão)', 'RN01'],
    ['CheckoutService.js', 'Orquestração do fluxo + CheckoutResult', 'RN02/RN03'],
    ['withTimeout.js', 'Timeout rígido por tentativa', 'RN04'],
    ['retry.js', 'Retentativas com backoff + jitter', 'RN05/RN06'],
    ['CircuitBreaker.js', 'Degradação graciosa / fail-fast', 'RN07'],
    ['errors/index.js', 'Hierarquia de erros (retryable vs. não)', '—'],
  ],
  [0.30, 0.50, 0.20],
));

// ---- 4. TEST PATTERNS ----
children.push(h1('4. Test Patterns Aplicados'));
children.push(h2('4.1 Data Builder + Object Mother'));
children.push(p('Para eliminar o Obscure Setup, combinamos os dois padrões: o Object Mother (PedidoMother) expõe pedidos canônicos nomeados por intenção, e cada método delega ao Data Builder (PedidoBuilder) por baixo. Isso une legibilidade e flexibilidade pontual.'));
children.push(code('PedidoMother.aprovavel();              // pedido canônico válido'));
children.push(code('PedidoMother.base().comValor(9999).build(); // ajuste pontual via builder'));

children.push(h2('4.2 Stubs vs. Mocks'));
children.push(p('Seguimos a distinção clássica: Stubs fornecem estado pré-fabricado (verificação de estado); Mocks verificam comportamento (interação). O caso mais relevante é o e-mail de confirmação, asserido por Mock:'));
children.push(table(
  ['Double', 'Tipo', 'Uso no teste'],
  [
    ['gatewayAprovaStub / gatewayRecusaStub', 'Stub', 'Injetam respostas de estado do gateway'],
    ['gatewaySequencialStub', 'Stub programável', 'Falha-depois-recupera (Fluxo 3)'],
    ['emailService (jest.fn)', 'Mock', 'Assere que o e-mail dispara só no sucesso (RN02/RN03)'],
    ['pedidoRepository (jest.spyOn)', 'Mock/Spy', 'Verifica persistência com o status correto'],
  ],
  [0.34, 0.18, 0.48],
));
children.push(spacer());

// ---- 5. BDD ----
children.push(h1('5. Especificação Viva (BDD / Gherkin)'));
children.push(p('Os cinco fluxos da matriz de rastreabilidade do DER foram descritos em features/checkout.feature no formato Dado-Quando-Então (em português), executados via jest-cucumber — um único runner cobre testes unitários e BDD, e a Fase 3 enxerga toda a suíte de uma vez. Exemplo do cenário crítico RN03:'));
children.push(code('Cenário: Cartão recusado não dispara e-mail (Fluxo 2)'));
children.push(code('  Dado que o gateway de pagamento responde "RECUSADO"'));
children.push(code('  Quando o checkout é processado'));
children.push(code('  Então o pedido deve ter status "FALHOU"'));
children.push(code('  E o e-mail de confirmação não deve ser enviado'));

// ---- 6. TDD ----
children.push(h1('6. Ciclo TDD e Cobertura Resultante'));
children.push(p('A implementação seguiu o ciclo Vermelho-Verde-Refatore: cada regra de negócio foi expressa primeiro como teste (falhando), depois implementada ao mínimo para passar, e por fim refatorada. A suíte final, executada com Jest, apresenta os seguintes números:'));
children.push(table(
  ['Métrica', 'Resultado'],
  [
    ['Total de testes', '44 passando (4 suítes)'],
    ['Cobertura de linhas (src)', '≈ 96%'],
    ['Cobertura de funções', '100%'],
    ['Fluxos do DER cobertos', '5 de 5 (Fluxos 1–5)'],
    ['Caminhos independentes (V(G)=3)', 'Todos os 3 caminhos-base cobertos'],
  ],
  [0.55, 0.45],
));
children.push(spacer());
children.push(p('Tabela de rastreabilidade Fluxo → Teste:', { bold: true }));
children.push(table(
  ['Fluxo (DER)', 'Cenário de Teste', 'Status'],
  [
    ['Fluxo 1 — Aprovado', 'status PROCESSADO + e-mail disparado', '200 OK'],
    ['Fluxo 2 — Recusado', 'status FALHOU + e-mail bloqueado', '500'],
    ['Fluxo 3 — Resiliência', 'falha 1x, recupera na 2ª tentativa', '200 OK'],
    ['Fluxo 4 — Caos total', 'esgota retries → fallback ERRO_GATEWAY', '500'],
    ['Fluxo 5 — Contrato', 'ValidationError, sem tocar gateway/banco', '400'],
  ],
  [0.26, 0.52, 0.22],
));

// ---- 7. PREPARO MUTAÇÃO ----
children.push(h1('7. Preparação para a Fase 3 (Teste de Mutação)'));
children.push(p('A configuração do Stryker.js (stryker.config.js) já está pronta, com meta de quebra em 80% e alvo de 90%. Uma execução parcial de validação confirmou que a suíte mata mutantes efetivamente: o módulo withTimeout.js atingiu 100% de mutation score após o reforço dos testes. Dois mutantes sobreviventes detectados durante a Fase 2 já foram eliminados de imediato (regex de e-mail e limpeza de timer), demonstrando o uso da mutação como instrumento de enriquecimento da suíte.'));
children.push(p('Os mutantes remanescentes no validador são candidatos a mutantes equivalentes (formas alternativas da expressão regular que aceitam o mesmo conjunto de entradas) — sua justificativa técnica formal é a entrega central da Fase 3.'));

// ---- 8. CONCLUSÃO ----
children.push(h1('8. Conclusão'));
children.push(p('O CheckoutService foi redesenhado de um método monolítico e frágil para um pipeline coeso, com responsabilidades isoladas e resiliência explícita. As quatro frentes da Fase 2 foram entregues: especificação Gherkin dos cinco fluxos, ciclo TDD com 44 testes e ~96% de cobertura, Test Patterns (Builder, Mother, Stubs e Mocks) eliminando o Obscure Setup, e refatorações de Fowler removendo os smells de acoplamento e condicionais. A arquitetura está pronta para enfrentar o teste de mutação da Fase 3 e a injeção de caos da Fase 4.'));

const doc = new Document({
  styles: {
    default: { document: { run: { font: 'Arial', size: 24 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 30, bold: true, font: 'Arial', color: BLUE },
        paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 26, bold: true, font: 'Arial', color: BLUE },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 1 } },
    ],
  },
  numbering: {
    config: [
      { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ],
  },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    children,
  }],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync('docs/Fase2-Relatorio.docx', buffer);
  console.log('DOCX gerado: docs/Fase2-Relatorio.docx');
});
