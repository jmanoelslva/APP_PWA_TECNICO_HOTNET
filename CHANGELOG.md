# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Não lançado]

## [1.8.1] - 2026-10-02

### Corrigido

- Tela da ONU mostrava o sinal duas vezes, de fontes diferentes: os cartões
  ONU/OLT (Controllr) e a legenda do gráfico (coletor), às vezes com valores
  diferentes. Com o Coletor de OLTs, os cartões ONU e OLT passam a mostrar a
  leitura feita direto na OLT (a mesma do gráfico), com a indicação de quando
  foi lida; sem ele, continuam com o Controllr. O gráfico mostra só a
  evolução.
- Um só **Atualizar agora**: com o coletor, lê a ONU na OLT em segundos e
  relê o Controllr sem reconectar a OLT; sem ele, o fluxo antigo (~1 min).
- Quedas em um só lugar: com o coletor, "Motivo da última queda" e "Última
  queda" do Controllr saem da ficha (a lista de quedas tem motivo, hora e
  duração).
- Resumo da ONU na tela **Conexão** usa a mesma fonte: sinal RX lido na OLT
  (com há quanto tempo) e a última queda com motivo e hora.

## [1.8.0] - 2026-10-02

### Adicionado

- Tela da ONU ganha o **Histórico na OLT** (do Coletor de OLTs, lido direto
  das OLTs a cada 15 minutos): gráfico do RX da ONU e do RX na OLT em 24 h,
  3, 7 ou 30 dias, com o limite crítico de cada lado e leitura ponto a ponto
  ao tocar; TX da ONU; quedas com motivo (falta de energia, sem sinal...),
  hora e quanto tempo ficou fora, juntando oscilações seguidas numa linha só;
  alarmes ativos; diagnóstico do sinal; e a situação da PON, com aviso quando
  várias ONUs da mesma porta caíram juntas (problema da rede, não do cliente).
- Botão **Ler na OLT agora**: lê só esta ONU na OLT em segundos, sem
  reconectar a OLT inteira.
- Sem o coletor configurado no servidor, a seção não aparece.

### Removido

- Menu **OLTs** do painel: os dados do coletor agora aparecem na própria tela
  da ONU. O coletor continua acessível em `/olt/` para quem administra a rede.

## [1.7.0] - 2026-10-02

### Adicionado

- Rotas `GET /coletor/onu` e `POST /coletor/onu/atualizar` no backend: pelo
  serial da ONU (igual no Controllr e na OLT) buscam no Coletor de OLTs o
  histórico de sinal (RX/TX da ONU e RX na OLT), as quedas com motivo, hora e
  duração, os alarmes e a situação da PON. O backend chama o coletor na mesma
  máquina com o token de serviço dele; o navegador não fala com o coletor.
  Sem o coletor configurado, as rotas respondem 503 e nada muda no app.
- O instalador copia `COLETOR_URL` e `COLETOR_SERVICO_TOKEN` de
  `/etc/coletor-olt/coletor.env` quando o coletor (1.5.0 ou mais novo) está
  no mesmo servidor.

## [1.6.1] - 2026-10-02

### Corrigido

- `deploy/install.sh` atualiza o próprio arquivo com `git pull` durante a
  execução; como o bash lê o script aos poucos, a versão nova podia ser
  executada pela metade. Agora o script inteiro é lido antes de começar.

## [1.6.0] - 2026-10-02

### Adicionado

- Integração opcional com o Coletor de OLTs (projeto COLETA-OLT) no mesmo
  domínio, em `/olt/`: o menu **OLTs** só aparece no painel quando o coletor
  está instalado (`/olt/api/saude` responde) — sem ele, nada muda. O coletor
  aceita a sessão do técnico (cookie `TECSESSION`, validado no `/auth/me`),
  então quem está logado no PWA entra direto, sem outra senha.
- Login aceita `?voltar=/olt/...`: quem abre o coletor sem sessão entra no
  técnico e volta para onde estava (só caminhos de `/olt/`).
- Vhosts de exemplo (Nginx e Apache) incluem, se existir, o trecho que o
  coletor grava em `/etc/coletor-olt/web/` — sem o coletor, o include não
  acha nada.

### Alterado

- Service worker não responde navegações de `/olt/` com o app do técnico.

## [1.5.0] - 2026-09-15

### Adicionado

- Motivo e data/hora da última queda da ONU (`onu_last_down_reason`/
  `onu_last_down_time`, campos não documentados do Controllr) exibidos
  no card de status da tela ONU.

## [1.4.0] - 2026-09-12

### Adicionado

- Detecção de sessão encerrada manualmente no painel Controllr:
  checagem periódica (`CONTROLLR_LIVENESS_CHECK_SECONDS`, 60s) via
  `/web_auth/acl_perm/list`; se a sessão não for mais aceita, desloga
  o técnico.

### Alterado

- Autenticação com o Controllr passou de Basic Auth por requisição
  para o cookie de sessão do login, em toda chamada — Basic Auth abria
  uma segunda sessão "implícita" no Controllr, sem token pra fechar,
  duplicada na lista de usuários online do painel.
  `TechnicianSession.basic_auth` removido.
- Sessão do técnico não expira mais por TTL fixo (`SESSION_TTL_SECONDS`,
  removido) — validade decidida pelo Controllr via a checagem de
  liveness. `SESSION_COOKIE_MAX_AGE_SECONDS` (24h) limita só o cookie
  no navegador.
- Botão "Tentar novamente" trocado de `botao-primario` para
  `botao-secundario` nas 8 telas com esse estado de erro.
- Ícone da ONU trocado de roteador (MdRouter) para cabo (MdCable).

### Corrigido

- Logout não encerrava a sessão no Controllr quando o `/login`
  respondia com redirect — `ControllrLogin.login` agora lê o cookie do
  `cookie_jar`, não de `response.cookies`.
- Sessões órfãs no Controllr: a falha de liveness descartava a sessão
  local sem chamar `/session/logout` antes — extraída
  `encerrar_sessao_controllr`, usada nos dois lugares.
- Pull-to-refresh na tela Conexão sem cliente/CPE selecionado quebrava
  com "Informe client_pk...". Novo `atualizarTela` cobre o caso sem
  parâmetro.
- Botões com CSS de gradiente bespoke fora do sistema `.botao`
  ("Atualizar agora" e leitor de QR na ONU, busca em Conexão, "Entendi"
  do modal iOS) convertidos pro sistema padrão; nova classe utilitária
  `.botao-quadrado`.

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

[não lançado]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.8.1...HEAD
[1.8.1]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.8.0...v1.8.1
[1.8.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.7.0...v1.8.0
[1.7.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.6.1...v1.7.0
[1.6.1]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.6.0...v1.6.1
[1.6.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/releases/tag/v1.0.0
