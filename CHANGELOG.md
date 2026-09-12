# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Corrigido

- Botão "Atualizar agora" e o ícone de leitor de QR/código de barras na
  tela ONU tinham CSS próprio (gradiente com cor fixa, fora do sistema
  `.botao`/`--botao-cor` usado em todo o resto do app, inclusive nos
  outros botões da mesma tela) — destoavam visualmente. Trocados por
  `botao botao-secundario` (os dois — o gradiente de `botao-primario`
  também destoava, pesado demais pra essa tela) com `--botao-cor:
  CORES.onu`, igual ao resto.

### Alterado

- Autenticação deste backend com o Controllr deixou de usar Basic Auth
  por requisição e passou a usar, em toda chamada, o mesmo cookie de
  sessão criado no login (`TechnicianSession.controllr_cookie`) — antes
  reservado só para `/auth/logout` e a checagem de liveness. Causa:
  confirmado em produção que chamadas com Basic Auth faziam o Controllr
  abrir e manter uma segunda sessão "implícita" pra esse uso, sem
  nenhum token devolvido pra guardar e fechar depois — aparecia como
  sessão duplicada na lista de usuários online do painel administrativo,
  ao lado da sessão de cookie de verdade, e não tinha como ser fechada
  explicitamente. Agora existe só uma sessão por técnico, do login ao
  logout. `TechnicianSession.basic_auth` foi removido (o técnico não
  precisa mais ter a senha guardada, nem reversível, na memória deste
  backend). Testado ao vivo em produção: criação de telefone, busca e
  renomeação de ONU funcionando normalmente, sem sessão duplicada e com
  o mesmo cookie mantido ao trocar de módulo/ação no painel — ACL não
  se mostrou diferente entre Basic Auth e cookie nesses casos. Ainda
  vale acompanhar os módulos menos testados até agora (financeiro,
  anexos de ticket, ações de OS) nos próximos dias de uso normal.

### Corrigido

- Pull-to-refresh na tela Conexão sem cliente/CPE selecionado (ex: tela
  ainda no campo de busca por usuário PPPoE) quebrava mostrando "Informe
  client_pk, contract_pk, cpe_pk ou username": o gesto chamava `carregar`
  direto, que sem parâmetro nenhum na URL cai no ramo `contract_pk` de
  `buscarInicial` mesmo sem ele ter sido informado (`Number(null)` vira
  `0`, e o backend rejeita com 400). Pull-to-refresh agora usa
  `atualizarTela`, que seguindo a mesma guarda já usada pelo botão
  "Tentar novamente" (`temParametroInicial`), refaz a busca por usuário
  ao vivo quando não há parâmetro, em vez de cair nesse ramo inválido.

- Checagem de liveness da sessão no Controllr (`deps.py::get_current_session`)
  derrubava a sessão do técnico como "encerrada no Controllr" já na
  primeira navegação após o login, para todo mundo. Causa raiz
  (confirmada em produção via log): o endpoint escolhido,
  `/sys/message/count`, é restrito por ACL de módulo — só tinha sido
  testado numa sessão de admin (acesso a tudo) e devolvia `HTTP 403
  Access Denied` pra um técnico comum mesmo com a sessão perfeitamente
  viva. Trocado por `/web_auth/acl_perm/list` (lista as próprias
  permissões do usuário), que precisa funcionar pra qualquer sessão
  válida independente do cargo.

- Sessões órfãs acumulando no Controllr (o mesmo técnico aparecia
  "logado" várias vezes na lista de usuários online de lá): quando a
  checagem de liveness derrubava a sessão local (`delete_session`),
  ela nunca chamava `/session/logout` no Controllr antes — só
  `/auth/logout` fazia isso. Resultado: a sessão local sumia, mas a
  sessão real no Controllr ficava presa ativa; e a próxima chamada de
  `/auth/logout` do frontend não achava mais sessão local pra fechar,
  então também pulava a limpeza no Controllr. Cada login seguinte
  criava mais uma sessão nova lá, sem nunca fechar as anteriores.
  Extraída `encerrar_sessao_controllr` (compartilhada entre
  `/auth/logout` e a falha de liveness) para sempre tentar fechar a
  sessão no Controllr antes de descartar a sessão local, dos dois
  lugares.

### Removido

- `SESSION_TTL_SECONDS`: a sessão do técnico não expira mais por um
  tempo fixo desde o login. A validade passa a ser decidida
  inteiramente pelo Controllr — enquanto o técnico usa o app, a
  checagem de liveness (`CONTROLLR_LIVENESS_CHECK_SECONDS`) mantém a
  sessão dele ativa lá; parado por tempo suficiente para o Controllr
  expirar a sessão por inatividade, a próxima checagem detecta e
  desloga. Substituída por `SESSION_COOKIE_MAX_AGE_SECONDS` (24h por
  padrão), que só limita até quando o navegador guarda o cookie
  `TECSESSION`, sem afetar a validade real da sessão.

### Adicionado

- Detecção de sessão do técnico encerrada manualmente no painel
  Controllr: como as demais chamadas deste backend usam Basic Auth por
  requisição (sem sessão nenhuma no Controllr, ver
  `CONTROLLR_API_NOTES.md` seção 8.5), encerrar a sessão do técnico lá
  nunca era percebido aqui — o app continuava funcionando normalmente
  até o TTL local (`SESSION_TTL_SECONDS`) expirar sozinho. Agora
  `get_current_session` confirma periodicamente (a cada
  `CONTROLLR_LIVENESS_CHECK_SECONDS`, 60s por padrão) que o cookie de
  sessão guardado no login ainda é aceito pelo Controllr, chamando
  `/sys/message/count` (o endpoint de menor payload entre os que exigem
  sessão válida) — se não for mais aceito, a sessão local também é
  encerrada na hora (401), reaproveitando o fluxo de "sessão expirada"
  já existente no frontend.

### Corrigido

- Logout do técnico não encerrava a sessão criada no Controllr no
  momento do login: `ControllrLogin.login` lia o cookie de sessão em
  `response.cookies`, que só reflete o Set-Cookie da resposta final —
  se o `/login` do Controllr respondesse com redirect antes do 200,
  o cookie ficava vazio e `/auth/logout` pulava a chamada a
  `/session/logout` silenciosamente (o `except: pass` também escondia
  qualquer outra falha nessa chamada). A sessão local e o cookie do
  navegador eram sempre encerrados normalmente, mas a sessão no
  Controllr ficava "ativa" até o lease dele expirar sozinho. Corrigido
  lendo o cookie do `cookie_jar` da própria `ClientSession` (reflete
  qualquer resposta da cadeia de redirect) e trocando o swallow
  silencioso por log de erro real.

### Alterado

- Ícone que representa ONU trocado de roteador (MdRouter) para cabo
  (MdCable) em todas as telas, botões e menus — mais próximo do
  conceito de fibra do que um ícone de roteador genérico.

## [1.3.0] - 2026-09-12

### Adicionado

- Rodapé da tela inicial (Home) com IPv4/IPv6 da rede atual, consultados
  automaticamente ao entrar na tela, exibidos como chips coloridos.
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

[não lançado]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/releases/tag/v1.0.0
