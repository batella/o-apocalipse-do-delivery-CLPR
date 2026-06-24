# language: pt
Funcionalidade: Processamento de Checkout da EntregasJá
  Como plataforma de delivery operando na Black Friday
  Quero processar pagamentos de forma resiliente
  Para que falhas de infraestrutura não derrubem o serviço

  Contexto:
    Dado um cliente com um pedido válido de R$ 250,00

  Cenário: Pagamento aprovado dispara confirmação (Fluxo 1)
    Dado que o gateway de pagamento responde "APROVADO"
    Quando o checkout é processado
    Então o pedido deve ter status "PROCESSADO"
    E o e-mail de confirmação deve ser enviado
    E a resposta deve indicar sucesso

  Cenário: Cartão recusado não dispara e-mail (Fluxo 2)
    Dado que o gateway de pagamento responde "RECUSADO"
    Quando o checkout é processado
    Então o pedido deve ter status "FALHOU"
    E o e-mail de confirmação não deve ser enviado
    E a resposta deve indicar insucesso

  Cenário: Gateway instável se recupera na retentativa (Fluxo 3)
    Dado que o gateway falha 1 vez e depois responde "APROVADO"
    Quando o checkout é processado
    Então o pedido deve ter status "PROCESSADO"
    E o gateway deve ter sido chamado 2 vezes

  Cenário: Queda total do gateway aciona fallback (Fluxo 4)
    Dado que o gateway falha em todas as tentativas
    Quando o checkout é processado
    Então o pedido deve ter status "ERRO_GATEWAY"
    E o e-mail de confirmação não deve ser enviado
    E a resposta deve indicar insucesso

  Cenário: Payload incompleto é rejeitado sem tocar a infraestrutura (Fluxo 5)
    Dado um pedido sem os dados do cartão
    Quando o checkout é processado
    Então uma falha de validação deve ser lançada
    E o gateway de pagamento não deve ser chamado
