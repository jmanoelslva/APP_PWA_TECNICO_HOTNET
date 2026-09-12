# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Adicionado

- Rodapé da tela inicial (Home) com IPv4/IPv6 da rede atual, consultados
  automaticamente ao entrar na tela.
- Ferramenta "SIMET (NIC.br)" (top.nic.br/connection) no menu Ferramentas.
- Ferramenta "Meu IP": consulta o IPv4 e o IPv6 (quando a rede tem os
  dois) e a localização de cada um diretamente no app (Geolocation API
  do ipify), com cidade, estado, país, CEP, fuso horário, provedor e
  rede/ASN — em vez de abrir um site externo. Requer `IPIFY_API_KEY`
  configurada no servidor; o `deploy/install.sh` já grava a chave numa
  instalação nova.

### Corrigido

- IPv4/IPv6 da ferramenta "Meu IP" não eram descobertos: a CSP
  (`connect-src`) dos exemplos de configuração do Nginx/Apache bloqueava
  a chamada do navegador para api.ipify.org/api6.ipify.org, caindo
  sempre no IP genérico único detectado pelo servidor. Adicionados os
  dois domínios ao `connect-src`; também corrigido o rótulo mostrado
  para cada resultado (IPv4/IPv6/IP genérico, conforme o caso).

### Removido

- Ferramenta "Teste de DNS" (dnsleaktest.com) do menu Ferramentas.
- Link externo "Qual é meu IP" — substituído pela consulta inline "Meu IP".
- Link "Ver localização aproximada no mapa" da ferramenta "Meu IP".

## [1.2.0] - 2026-09-12

### Adicionado

- Tela "Clientes Offline": lista clientes com contrato ativo e CPE
  habilitado sem sessão ativa no momento. Acessível pelo menu principal,
  com atalho direto para a tela de Conexão de cada cliente. Campo de
  busca filtra a lista por nome, usuário PPPoE, contrato ou CTO.

### Corrigido

- `total` das listagens do backend (`brbyteapi`) refletia o tamanho da
  página atual em vez do total real no servidor. Corrigido para usar o
  `total` retornado pelo próprio Controllr no corpo da resposta.

## [1.1.0] - 2026-09-11

### Adicionado

- Tela de Financeiro: faturas (cobranças) do cliente, com status (paga,
  em aberto, atrasada) e indicação de pagamentos em observação, além de
  ação para registrar uma nova observação numa fatura em aberto. O
  acesso é controlado pela liberação de ACL do técnico no Controllr.

### Alterado

- Tela de detalhe do cliente: "Financeiro" passa a ser uma seção própria
  (como Telefones, Endereços etc.), com o botão "Cobranças" abaixo do
  título levando à tela de faturas. O atalho "Conexão" foi removido de
  dentro do Contrato (mantido por CPE, na seção "Conexões"). As ações de
  navegação da tela (Cobranças, Conexão, ONU, Ver no Google Maps,
  Adicionar telefone, Ver contrato assinado) usam o mesmo estilo de
  botão colorido por área da tela de Conexão, em vez do chip neutro.

### Corrigido

- Observação de pagamento criada pelo app nascia desabilitada. O campo
  `obs_status` do Controllr usa `0` para habilitado (valor diferente de
  zero é desabilitado).

## [1.0.0] - 2026-09-10

Primeira versão estável, já validada em uso real pelos técnicos em produção
(`tecnico.hotnet.net.br`). Consolida todo o desenvolvimento inicial do
aplicativo.

### Adicionado

- Autenticação do técnico com sessão própria por cookie (`TECSESSION`),
  refletindo o login/logout do Controllr.
- Busca unificada de cliente (nome, CPF/CNPJ, contrato ou usuário PPPoE) com
  sugestões ao vivo.
- Detalhe do cliente com endereço, contrato (status de assinatura, itens e
  link de assinatura digital) e telefones, com atalhos para Conexão, ONU,
  Suporte e Ordem de Serviço.
- Edição de endereço do cliente com captura de localização (GPS) e link
  direto para o Google Maps.
- Tela de Conexão: dados do CPE (usuário PPPoE, IP/MAC, Circuit ID),
  criptografia Wi-Fi editável, observação, CTO/porta e acesso ao roteador.
- Sugestão de CTO por proximidade, a partir da localização do técnico.
- Status óptico da ONU: sinal, distância até a CTO, indicação de "dados
  coletados há X", edição do nome da ONU e ações de reiniciar/remover/
  associar cliente.
- Sessão online e histórico de sessão do cliente (usuário PPPoE, IP, MAC,
  Circuit ID e uso de banda).
- Fluxo de Ordem de Serviço (OS) com os 4 estágios reais (respondida,
  iniciada, finalizada) e confirmação obrigatória por item, separado dos
  chamados de Suporte.
- Tela de Suporte (chamados/chat) com visualização de fotos e vídeos
  anexados.
- Leitor de código de barras/QR nativo (Barcode Detection API), incluindo
  suporte no iPhone.
- Log de auditoria das ações sensíveis do técnico (ação, alvo e IP real).
- Menu de Ferramentas.
- Instalação como PWA, com prompt próprio de instalação no iOS.
- Identidade visual "HOTNET TECH": logotipo, ícones e sistema de botões
  unificado.

### Alterado

- Telas de Conexão e ONU consolidadas na tela do cliente, com navegação
  cruzada entre Cliente, Conexão, ONU, Suporte e OS.
- Buscas de cliente, ONU e usuário PPPoE unificadas em combobox com filtro
  parcial ao vivo.
- Layout e cores da tela de Conexão revisados para melhor leitura.
- Duração e resiliência da sessão do técnico aprimoradas (não trava mais ao
  trocar de usuário/CPE).
- Precisão da sugestão de CTO por proximidade ajustada à precisão real do
  GPS reportada pelo dispositivo.

### Corrigido

- Diversas correções de integração com a API do Controllr/BrByte (filtros
  `where`, codificação do corpo do POST, nomes de campo e colunas ambíguas)
  que causavam dados ausentes ou incorretos em cliente, endereço, CPE, ONU,
  contrato, sessão online e Ordem de Serviço — detalhamento técnico em
  `CONTROLLR_API_NOTES.md`.
- Logout passa a encerrar a sessão do Controllr corretamente, em vez de
  depender apenas do Basic Auth.
- Erro 400 em "Minhas OS" causado por `user_pk` ambíguo em
  `support_ctl/os/list`.
- IP "(null)" exibido no log de auditoria.
- Janela de amostragem do GPS que podia falhar ao obter a localização do
  técnico.
- `deploy/install.sh`: HOME inexistente do usuário de serviço e
  travamento ao atualizar com porta não padrão.

### Removido

- Envio de mensagem pelo chamado de Suporte.
- Paginação da lista de Suporte.
- Botão de busca redundante e aba "Clientes" da barra de navegação
  inferior.
- Link de Contrato na tela de ONU.

[não lançado]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/releases/tag/v1.0.0
