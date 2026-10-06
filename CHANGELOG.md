# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Não lançado]

## [1.14.1] - 2026-10-06

### Corrigido

- **Site fora do ar depois de instalar com certificado já existente:** o
  instalador gravava a configuração do site no Nginx/Apache mas só a ativava
  no passo de emitir o certificado; quando o certificado já existia, a porta
  443 ficava sem o app. Agora o site é ativado sempre.
- **Renovação do certificado:** a porta 80 mandava tudo para HTTPS, inclusive
  a verificação do Let's Encrypt, e a renovação automática ia falhar. Agora o
  caminho `/.well-known/acme-challenge/` é atendido em HTTP.

## [1.14.0] - 2026-10-06

### Adicionado

- **Filtros na tela de OS:** busca por cliente, rua, bairro, serviço,
  protocolo ou técnico (sem acento, várias palavras); botões coloridos
  **Todas** (verde), **Hoje** (azul), **Atrasadas** (vermelho) e **Próximas**
  (roxo); seletores de **etapa** e de **tipo de serviço**. Mostra "N de M
  OS" e "Limpar filtros"; a escolha fica guardada enquanto o app estiver
  aberto. Tudo na lista já carregada.
- **Prévia do anexo na tela da OS:** a foto escolhida aparece na hora,
  embaixo do botão "Anexar", com "Enviando…" e depois "Enviado" (ou
  "Falhou").

### Corrigido

- **Botão de WhatsApp faltando:**
  - na próxima OS do dia (tela inicial), ao lado do "Ligar", usando o
    primeiro celular do cliente mesmo que o primeiro número seja fixo;
  - na tela da OS, cada número do cliente tem os seus botões (antes só o
    primeiro);
  - celular no formato antigo (DDD + 8 dígitos começando em 6 a 9) passa a
    ter WhatsApp, com o 9 na frente;
  - campo com mais de um número ("... / ...", "... ou ...") é separado.
- **Foto no histórico do chamado:** quando o Controllr manda a imagem sem o
  tipo certo, o servidor confere pelos primeiros bytes e mostra a foto
  (antes virava download). Imagem que o aparelho não consegue mostrar (ex.:
  HEIC do iPhone no Android) vira link para baixar, em vez de quebrada.

## [1.13.1] - 2026-10-05

### Alterado

- **Tela de login:**
  - o teclado do celular não põe mais maiúscula nem "corrige" o usuário
    (evitava login recusado por "Anderson" em vez de "anderson");
  - Enter no usuário vai para a senha; na senha, entra;
  - aviso de Caps Lock ligado (teclado físico);
  - "Entrando…" com indicador girando e campos travados enquanto espera;
  - erro em caixa com ícone, que some ao corrigir; o bloqueio por muitas
    tentativas aparece como aviso de espera;
  - campo vazio avisado no próprio campo, no lugar do balão do navegador;
  - "Acesso do técnico" abaixo da marca, logo maior, campos no mesmo
    arredondado do resto do app e botão de tema claro/escuro no canto.

### Corrigido

- **Atrasada** só aparecia em OS de dias anteriores: uma OS de hoje às 08:00
  ainda em aberto à noite ficava sem a marca. Agora é atrasada a OS que já
  passou do dia e hora agendados e ainda não foi iniciada (OS em andamento
  não conta), na tela inicial, no resumo do dia e na lista de OS.

## [1.13.0] - 2026-10-05

### Alterado

- **Visual mais limpo e fácil de ler em campo:**
  - a fonte do app vale também em campos, listas e menus (antes alguns
    caíam em Arial/Roboto);
  - cinzas de apoio mais escuros, legíveis sob sol (contraste mínimo AA);
  - cabeçalho das telas mais baixo, sobrando mais espaço para o conteúdo;
  - tela inicial: resumo do dia na saudação ("3 OS para hoje · 1
    atrasada"), avatar com as iniciais do técnico, lupa na busca e atalhos
    em 3 colunas; "Abrir OS" não quebra mais em duas linhas;
  - lista de **OS / Suporte**: etapa de cada OS (Agendada, Respondida, Em
    andamento) em vez de "Aberta" para todas, "Hoje 09:00" em vez da data
    completa, bairro junto do cliente e OS atrasada destacada em vermelho;
  - erro ao carregar uma tela com o mesmo visual em todo o app (ícone,
    mensagem e "Tentar novamente").
- Aviso de OS nova mostra o **endereço** (rua e número) em vez do bairro:
  "Instalação — Rua B, 12 · hoje 14:00". Sem rua cadastrada, o bairro.

### Adicionado

- CPF/CNPJ, telefone e CEP com máscara, e botões **Ligar** e **WhatsApp**
  (WhatsApp só para celular) nos telefones do cliente e no contato da OS.

## [1.12.2] - 2026-10-05

### Corrigido

- Mensagens informativas do backend não apareciam no `journalctl` (o
  uvicorn só mostra as próprias): agora aparecem, por exemplo "Vigia de OS
  ligado" ao iniciar e "N aviso(s) enviado(s)" quando sai aviso de OS nova.

## [1.12.1] - 2026-10-05

### Alterado

- Avisos de OS continuam chegando depois do **Sair** (antes o Sair do menu
  do avatar desligava, e o da barra de baixo não — ficou igual nos dois).
  Para parar, o interruptor **Avisos de OS** no avatar. Se outro técnico
  entrar no mesmo celular, os avisos passam a ser dele.

## [1.12.0] - 2026-10-05

### Adicionado

- **Avisos de OS nova no celular** (notificação, mesmo com o app fechado).
  O servidor procura OS nova a cada minuto (`AVISOS_INTERVALO_SEGUNDOS`)
  com um usuário de consulta do Controllr e avisa o técnico responsável:
  tipo, bairro e horário, sem o nome do cliente; tocar abre a OS. Liga e
  desliga no menu do avatar (**Avisos de OS**). Várias OS novas de uma vez
  viram um aviso só. O **Sair** desliga os avisos daquele celular. No
  iPhone, só com o app instalado na tela inicial. O `install.sh` gera as
  chaves e pergunta o usuário de consulta (ver `deploy/DEPLOY.md`, seção 6).

### Corrigido

- **Minhas OS de hoje** mostrava as OS que a pessoa **abriu** (`user_*` da
  OS), não as que ela **executa**. Agora usa o técnico responsável
  (`staff_username`), comparado com o login do app. O bloco também aparece
  sempre na tela inicial, sem depender de o login achar o número do técnico
  no Controllr.

## [1.11.0] - 2026-10-05

### Adicionado

- Auditoria registra também: criar, editar e excluir **endereço** (com o
  antes → depois de cada campo e da localização), localização do
  equipamento, criar e editar **telefone**, e cancelar e reabrir **OS** (com
  o motivo). O "como estava" e o nome do cliente são lidos no próprio
  Controllr. Novos filtros na tela: Endereços, Localização, Telefones e OS.

### Corrigido

- Excluir endereço que o Controllr recusa agora responde erro; antes
  respondia sucesso e a tela podia dizer que excluiu sem ter excluído.

### Alterado

- Busca de cliente e detalhe do cliente mais rápidos: as consultas ao
  Controllr saem em paralelo (no máximo 6 ao mesmo tempo por pedido) em vez
  de uma de cada vez.
- Telas de Conexão e de ONU divididas em partes menores (`pages/conexao/` e
  `pages/onu/`), sem mudança no que aparece na tela.

## [1.10.0] - 2026-10-05

### Adicionado

- Auditoria registra a **associação de ONU a cliente**: OLT, PON e número
  da ONU, serial, e cliente e usuário PPPoE em antes → depois (o novo vem
  da conexão conferida no Controllr). Novo filtro **Associações** na tela.

## [1.9.1] - 2026-10-05

### Segurança

- Anexo de chamado: só imagem (exceto SVG), vídeo, áudio e PDF abrem na
  tela; qualquer outro tipo (HTML, SVG, texto...) é baixado como arquivo,
  isolado e sem script. Antes, um anexo HTML aberto no app podia rodar
  código com a sessão de quem clicou.

### Corrigido

- Associar ONU a um cliente confere se a conexão devolvida pelo Controllr é
  mesmo a escolhida e pertence ao cliente; senão recusa, em vez de gravar na
  ONU o usuário e a senha PPPoE de outra conexão.

### Alterado

- Filtros da Auditoria em duas colunas: **De** acima de **Até**, e
  **Técnico** acima do botão **Filtrar**.

## [1.9.0] - 2026-10-05

### Adicionado

- Auditoria grava, nas alterações de Wi-Fi e de acesso ao roteador, o
  cliente e o usuário PPPoE, o tipo de criptografia antes e depois, o login
  e a porta anteriores e se a senha foi trocada (a senha em si nunca é
  gravada).

### Alterado

- Tela de **Auditoria** mais fácil de ler: ações agrupadas por dia (Hoje,
  Ontem...), ícone e cor por tipo de ação (remoção em destaque), quadro de
  **antes → depois** com o valor antigo riscado e o novo em verde, o IP
  (IPv4 ou IPv6) numa linha própria abaixo do técnico, detalhes
  (OLT, ONU, serial, cliente, PPPoE) em grade, e filtro por tipo de ação em
  botões no topo, no lugar da lista suspensa.

## [1.8.1] - 2026-10-05

### Adicionado

- Auditoria: `AUDITORIA_USUARIOS=*` (ou `todos`) libera a consulta para
  qualquer técnico logado, sem precisar listar cada usuário.

## [1.8.0] - 2026-10-05

### Adicionado

- **Minhas OS de hoje** na tela inicial: a próxima OS do técnico em destaque
  (horário, tipo de serviço, cliente e endereço) com os botões **Rota**
  (Google Maps já em modo navegação até o endereço), **Ligar** (primeiro
  telefone do cliente) e **Abrir OS**; abaixo, as demais OS do dia. OS de
  dias anteriores ainda em aberto aparecem no topo como **Atrasada**. Só
  aparece quando o login identificou o técnico no Controllr.

## [1.7.2] - 2026-10-05

### Alterado

- Auditoria: a ONU aparece só com o número (sem "nº") e a **OLT aparece
  sempre**. Nos registros antigos, OLT pelo nome, PON, número e serial vêm da
  mesma busca de ONU que a tela usa no Controllr (antes era a lista de OLTs);
  só vale o resultado cujo número confere. Buscas em paralelo, poucas de cada
  vez, e guardadas por 10 minutos.

## [1.7.1] - 2026-10-05

### Alterado

- Auditoria mostra a ONU como ela aparece na tela: **OLT pelo nome**, PON e
  número da ONU, serial e, ao renomear, o nome anterior → novo. Reiniciar,
  remover e renomear passam a gravar esses dados; nos registros antigos o
  nome da OLT é buscado no Controllr pelo número (se não der, aparece "nº").

## [1.7.0] - 2026-10-05

### Adicionado

- **Consulta da auditoria no app** (Ferramentas → Auditoria): quem
  reiniciou, removeu ou renomeou ONU e quem alterou Wi-Fi ou o acesso ao
  roteador, quando e de qual IP, com filtro por técnico, ação e período. Só
  para os usuários em `AUDITORIA_USUARIOS` (o instalador pergunta uma vez).
- **Limite de tentativas no login**: 5 senhas erradas do mesmo IP, ou 10 do
  mesmo usuário, bloqueiam por 15 minutos sem nem tentar no Controllr —
  protege as senhas dos técnicos e evita bloqueio da conta lá.
- Primeiros testes do backend (`backend/tests`, `requirements-dev.txt`).

### Corrigido

- **IP da auditoria podia ser falsificado**: o app confiava primeiro em
  `CF-Connecting-IP` e no primeiro IP do `X-Forwarded-For`, que o navegador
  pode mandar com qualquer valor. Agora usa o `X-Real-IP` do proxy ou o
  último IP do `X-Forwarded-For` (o que o proxy acrescenta). No Apache, o
  `X-Real-IP` chegava como "(null)": o vhost passa a usar
  `expr=%{REMOTE_ADDR}`.

### Alterado

- Log de auditoria dividido por mês (`logs/auditoria-AAAA-MM.jsonl`), com os
  de mais de 12 meses apagados automaticamente (`AUDITORIA_RETENCAO_MESES`).
  O arquivo antigo continua aparecendo na consulta.
- Notas das releases no GitHub montadas pelo `tools/notas_release.py` a partir
  deste CHANGELOG: título "v1.6.1 · assunto", seções com ícones, cada item numa
  linha só, comando de atualização copiável e link para comparar com a versão
  anterior. Aplicado a todas as releases.

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

[não lançado]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.14.1...HEAD
[1.14.1]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.14.0...v1.14.1
[1.14.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.13.1...v1.14.0
[1.13.1]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.13.0...v1.13.1
[1.13.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.12.2...v1.13.0
[1.12.2]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.12.1...v1.12.2
[1.12.1]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.12.0...v1.12.1
[1.12.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.11.0...v1.12.0
[1.11.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.10.0...v1.11.0
[1.10.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.9.1...v1.10.0
[1.9.1]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.9.0...v1.9.1
[1.9.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.8.1...v1.9.0
[1.8.1]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.8.0...v1.8.1
[1.8.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.7.2...v1.8.0
[1.7.2]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.7.1...v1.7.2
[1.7.1]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.7.0...v1.7.1
[1.7.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.6.1...v1.7.0
[1.6.1]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.6.0...v1.6.1
[1.6.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/releases/tag/v1.0.0
