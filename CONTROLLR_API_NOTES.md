# Notas sobre a API do Controllr (BrByte)

Este documento reúne tudo que descobrimos **testando ao vivo** contra o
Controllr real (`controllr.hotnet.net.br:8443`) que **não está** na doc
oficial (`https://apidoc.brbyte.com`), ou que a doc oficial descreve
incompleto/errado. Sem isso, cada descoberta ficava só espalhada em
comentário de código e mensagem de commit — difícil de achar de novo da
próxima vez que um bug parecido aparecer.

Convenção: "confirmado ao vivo" = testado de verdade contra o servidor
real (não é suposição). Quando um nome de campo/endpoint não tem link
para doc oficial, é porque ele **não existe** na doc.

---

## 1. Formato do filtro `where`

JSON: lista de condições, intercaladas com `{"field":"AND"}` quando há
mais de uma. Exemplo: `[{"field":"a","oper":5,"value":1},{"field":"AND"},{"field":"b","oper":7,"value":null}]`.

**IMPORTANTE**: o corpo inteiro (`where=...` incluído) precisa passar
por `urlencode()` antes de virar o body da requisição. Colar o JSON cru
num f-string funciona por sorte para valores só numéricos, mas quebra na
hora que aparece um `%` (ex: ILIKE `%termo%`) — um `%te` não é hex
válido, corrompe o parsing do corpo no servidor, que aí **ignora o
`where` inteiro sem erro nenhum** (sintoma: filtro nunca funciona,
busca sempre traz tudo ou nada errado).

### Tabela de operadores (embutida na descrição do `openapi.yaml`, não numa página própria)

| oper | significado |
|---|---|
| 0 | nenhum |
| 1 | `<` |
| 2 | `>` |
| 3 | `<=` |
| 4 | `>=` |
| 5 | `=` (EQUAL) |
| 6 | `!=` |
| 7 | IS (NULL/TRUE) |
| 8 | IS NOT (NULL/TRUE) |
| 9 | LIKE (`valor%`, sensível a maiúsculas) |
| 10 | ILIKE (`%valor%`, não sensível) |
| 11–20 | comparação de INET |
| 21 | IN (valor é uma lista) |
| 22–24 | operações de array |
| 25–29 | operações bit a bit |

---

## 2. Colunas ambíguas (bug recorrente — mesma causa, vários endpoints)

Vários endpoints de listagem fazem JOIN internamente, e um nome de
coluna sem prefixo de tabela vira ambíguo para o Postgres por trás. O
Controllr às vezes **rejeita com erro** (código `42702`,
"ambiguous_column") e às vezes **silenciosamente ignora o filtro
inteiro** (sintoma bem mais traiçoeiro: a busca "funciona" mas sempre
traz resultado errado/não filtrado). Prefixos confirmados:

| Endpoint | Campo | Prefixo certo |
|---|---|---|
| `/controllrctl/client/list` | `client_pk` | `client.client_pk` |
| `/controllrctl/addresses/list` (full) | `client_pk` | `addresses.client_pk` |
| `/controllrctl/addresses/list_combo` | `client_pk` | **sem prefixo** (bare já funciona) |
| `/aaa_ctl/cpe/list` e `/list_combo` | `client_pk` | `aaa_cpe.client_pk` (nome real da tabela é `aaa_cpe`, não `cpe`) |
| `/aaa_ctl/cpe/list` | `contract_pk` | `aaa_cpe.contract_pk` |
| `/support_ctl/ticket/list` | `client_pk` | `ticket.client_pk` |
| `/support_ctl/ticket/list` | `user_pk` | **sem prefixo** (bare já funciona, testado e confirmado — não tem o mesmo bug de `os/list`) |
| `/support_ctl/os/list` | `user_pk` | `support_op.user_pk` (nome real da tabela é `support_op`) |
| `/controllrctl/contract/update`/`/create` | `sign_url` | não é ambiguidade, é um **parâmetro extra** — ver seção 7 |

### Como achar o prefixo certo quando aparecer um novo caso

1. Testa a query bare primeiro — se voltar vazio/errado sem erro, ou
   `42702`, é ambiguidade.
2. Tenta candidatos plausíveis (nome da tabela real, visível nos
   comentários dos models vendorizados ou em outros endpoints que já
   usam esse dado) até um devolver `200` com resultado certo em vez de
   `42702` (ambíguo) ou `42P01` ("relation does not exist" — nome de
   tabela errado).

---

## 3. Ordem de Serviço (OS) — o maior achado desta sessão

A doc oficial só documenta `/support_ctl/os/list`, `/create`, `/close`,
`/cancel`, `/reopen`. Só isso não é suficiente para o ciclo de vida real
que o Controllr usa.

### 3.1. Os 4 estágios reais (confirmado com o dono da operação)

1. **Agendamento** — feito pelo escritório, já vem pronto (`op_date_sched`).
2. **Respondida** — técnico viu a OS.
3. **Iniciada** — técnico começou o atendimento.
4. **Finalizada** — técnico terminou o atendimento.

**Fechar** a OS é uma etapa à parte, só do escritório — confirmado que
o ACL do Controllr nega (403 `{"code":-2,"message":"Access Denied"}`)
para uma conta de técnico de verdade em `/support_ctl/os/close`.

### 3.2. Endpoints não documentados, achados capturando ao vivo os botões do painel

- `POST /support_ctl/os/set_answer` — marca "Respondida".
- `POST /support_ctl/os/set_start` — marca "Iniciada".
- `POST /support_ctl/os/set_finish` — marca "Finalizada".
- `POST /support_ctl/os/undo_answer` / `undo_start` / `undo_finish` — desfaz cada uma.

Corpo de todos os 6: **só** `op_os_pk` + `op_desc` (os dois
obrigatórios — confirmado sondando com corpo vazio, que devolve
`{"errors":[{"id":"op_os_pk","msg":"Required Field"},{"id":"op_desc","msg":"Required Field"}]}`).
Diferente de `close`/`cancel`/`reopen`, que também levam `ticket_pk`.

**Cuidado**: nomes de ação inventados (`/support_ctl/os/isso_nao_existe`)
devolvem o **mesmo** 403 `Access Denied` genérico do servidor para rota
desconhecida — não confie em "deu 403" sozinho como prova de que um
endpoint existe. Confirme testando com corpo vazio: se vier
`"Required Field"` (validação de verdade), o endpoint existe; se vier
`Access Denied` até para um nome claramente inventado, é só o fallback.

### 3.3. O detalhe que mais confundiu: onde mora o estado de cada etapa

Os campos `op_date_answer` / `op_date_start` / `op_date_finish` do
**registro raiz** da OS (o que `/support_ctl/os/list` devolve,
`op_type=1`) ficam **sempre nulos** — confirmado ao vivo, repetidas
vezes, mesmo depois de marcar todas as 3 etapas.

O que acontece de verdade: cada `set_*`/`undo_*` cria um **novo
registro de evento** (`op_type` 3=respondida, 4=iniciada, 5=finalizada),
visível só em `/support_ctl/op/list` (o **mesmo endpoint usado para o chat
do chamado**), vinculado à OS via `op_os_pk = op_pk do registro raiz`.

- Um `set_*` grava esse evento com a data correspondente **preenchida**.
- Um `undo_*` grava **outro** evento do **mesmo** `op_type`, só que com
  a data **nula** (confirmado comparando os dois registros criados ao
  vivo, campo a campo — só a data e a descrição diferem).

**Conclusão**: para saber se uma etapa está marcada, é preciso pegar o
evento **mais recente** (maior `op_pk`) daquele `op_type`, vinculado à
OS certa, e olhar a data DELE — nunca um campo fixo da OS. Ver
`backend/app/routers/ordens_servico.py` e
`frontend/src/pages/DetalheOrdemServico.tsx` para implementação.

Isso também significa que **`/support_ctl/os/list` não retorna os
eventos** — filtrar esse endpoint por `op_os_pk` de uma OS específica
sempre volta vazio. Os eventos só aparecem via `/support_ctl/op/list`
(filtrado por `ticket_pk`).

### 3.4. Outros campos confirmados

- `op_number` — número legível da OS (ex: `"20260528000013"`), igual
  em todos os eventos da mesma OS. Diferente de `ticket_protocol`
  (número do chamado, ex: `"202605280000012"`) e de `op_pk`/`op_os_pk`
  (ids internos).
- `client_pk`, `client_complete_name`, `contract_pk`, `contract_number`,
  `address`/`address_number`/`address_neighborhood`/`address_province`/
  `address_state`/`address_zipcode`/`address_completation`/
  `address_identification` já vêm prontos no próprio registro de
  `/support_ctl/os/list` — não precisa buscar o cliente à parte só para
  mostrar isso.
- **Não vêm prontos**: telefone do cliente, status/vencimento do
  contrato, dados de conexão (usuário/senha/IP/MAC/CTO) — precisa
  buscar via `/clientes/{pk}` e `/cpe/busca` à parte.

### 3.4.1. `task_name`/`task_pk` — a Tarefa da OS

`/support_ctl/os/list` também já traz `task_pk` e `task_name` prontos no
próprio registro (confirmado ao vivo na tela "Ordem de Serviço" do
painel, coluna "Tarefa": valores reais vistos — `"Viabilidade"` (pk 1),
`"Instalação a Cabo"` (pk 2), `"Desinstalação Equipamento"` (pk 8)).
É o **tipo de serviço** definido pelo escritório ao agendar a OS — bem
diferente de `op_desc` (nota de texto livre que só existe depois que o
técnico confirma uma etapa, pode nem existir numa OS recém-agendada) e
de `ticket_title` (assunto que o CLIENTE deu ao abrir o chamado). Não
precisa de endpoint extra para buscar isso — já vem no mesmo list.

### 3.5. "Minhas OS abertas" — filtro combinado confirmado

```json
[
  {"field":"op_date_sched","oper":8,"value":null},
  {"field":"AND"},
  {"field":"op_date_close","oper":7,"value":null},
  {"field":"AND"},
  {"field":"op_date_cancel","oper":7,"value":null},
  {"field":"AND"},
  {"field":"op_deleted","oper":7,"value":false},
  {"field":"AND"},
  {"field":"support_op.user_pk","oper":21,"value":[<user_pk>]}
]
```

---

## 4. CPE (`/aaa_ctl/cpe/list` e afins)

- Duas credenciais **diferentes**, não confundir:
  - `cpe_username` / `cpe_password` — login PPPoE de internet do cliente.
  - `cpe_access_login` / `cpe_access_password` (+ `cpe_access_port`) —
    acesso administrativo ao próprio roteador/CPE.
- `cpe_latitude` / `cpe_longitude` — localização do **equipamento**
  (GPS capturado pelo técnico). Diferente de `address_latitude`/
  `address_longitude`, que é do **endereço cadastral** (registro
  separado, via `address_pk`).
- `cpe_dp_port` — porta da CTO (splitter). Aparece tanto em
  `/aaa_ctl/cpe/list` quanto em `/fiber_ctl/onu/list` (não documentado
  nesse segundo).
- `cpe_mac_last` — último MAC visto. Quando o cliente conecta por
  PPPoE sem MAC fixo cadastrado, `cpe_mac` fica vazio e o MAC de
  verdade só aparece aqui.
- `cpe_wifi_encryption_type` — sem enum na doc oficial (só diz que é
  number). **Confirmado pelo usuário**: `0` = Nenhum, `1` = WEP,
  `2` = WPA, `3` = EAP. Com `0` (Nenhum) não faz sentido mandar senha.
- `/aaa_ctl/cpe/list_combo` só traz um subconjunto reduzido de campos
  (sem `contract_number`, só `contract_pk`) — para mostrar o número de
  contrato de verdade é preciso cruzar com `/controllrctl/contract/list`
  filtrado por `contract_pk` (ver seção 6).
- `cpe_sessions` — contador de sessões RADIUS ativas no momento para
  aquele CPE (`0` = sem sessão agora). Combinado com `contract_status`
  (seção 6) e `cpe_status` dá o filtro de "clientes offline que
  deveriam estar online" usado na tela "Clientes Offline": `where`
  confirmado pelo próprio usuário (captura de rede do painel):
  `contract_status IN [1]` (Ativado) **AND** `cpe_status = 1`
  (habilitado) **AND** `cpe_sessions = 0` — ver
  `backend/app/routers/conexao.py::listar_cpe_offline`.

---

## 5. ONU (`/fiber_ctl/onu/list`)

- Busca por `cpe_pk` sozinho é ambígua/poitem trazer a ONU de **outro**
  cliente. Jeito confiável: busca "wizard" por `search_term`/
  `search_value` (não é o formato `where` normal):
  - `search_term=onu_serial` — busca por serial do equipamento.
  - `search_term=onu_wancfg_pppoe_username` — busca pelo usuário PPPoE
    do cliente (mais confiável para achar a ONU certa; confirmado
    capturando a busca real do painel de fibra).
  - Payload completo confirmado (sentinelas `-1`/`0`/`128` = "não
    filtrar"): `olt_pk=0&dp_pk=-1&search_term=...&search_value=...&frame_id=-1&slot_id=-1&port_id=-1&onu_id=-1&duplicate_serial=-1&signal_min_limit=128&signal_max_limit=128&page=1&start=0&limit=15&sort=...&dir=ASC`.
  - `search_term=onu_serial` filtra por **PREFIXO** (não precisa do
    serial completo nem é match exato) — confirmado ao vivo na própria
    tela "ONU - Registrado" do painel: digitar `ZTEG` na busca por
    Serial já filtrou de 2550 para 764 resultados, todos começando com
    esse prefixo. Por isso dá para usar esse mesmo endpoint (via
    `buscarOnu({serial})`) num combobox de busca ao vivo, sem precisar
    de outro endpoint — diferente da busca por usuário PPPoE, que exige
    match exato aqui e por isso usa `/aaa_ctl/cpe/list` (ILIKE) à parte
    para sugestão, só resolvendo a ONU de fato depois que o técnico
    escolhe um usuário exato.
- `onu_distance` — a doc diz só "string", sem unidade. **É em
  quilômetros, não metros** (confirmado pelo usuário — um valor real de
  ~10.58 corresponde a ~10,5km; bate também com o exemplo da doc,
  `"0.931"`, que só faz sentido como km para alcance de GPON).
- `/fiber_ctl/olt/reconnect` — **confirmado seguro pelo usuário**: só
  força reler os dados da OLT, não derruba conexão de ninguém. Usado
  no fluxo de "Atualizar agora": reconnect → espera 15s →
  `onu_update_info` → espera 30s.
- `onu_update_info` (`POST /fiber_ctl/onu/list_info`) **não devolve
  `results`** — a resposta é só `{"success": true}` (confirmado ao vivo
  chamando o endpoint direto pelo console, autenticado na sessão do
  painel). É só um comando assíncrono pro Controllr reler a ONU na OLT;
  o dado atualizado de verdade só aparece numa chamada posterior a
  `/fiber_ctl/onu/list` (por isso o fluxo de "Atualizar agora" ignora o
  retorno desse endpoint e re-busca a ONU depois de esperar). Logo,
  `onu_info_timer` **não vem** dessa "coleta" — ele só existe no
  payload do `/fiber_ctl/onu/list` normal (confirmado ao vivo: campo
  presente no `store` da grade do painel), que é o mesmo endpoint que
  `buscarOnu()`/`ONUExtended.info_timer` já usam.
- `onu_info_timer` — **confirmado pelo usuário**: é um contador em ms
  desde a última coleta feita pelo Controllr (ex.: `167000` = a última
  coleta desta ONU foi há 2min47s). Só zera quando alguém clica em
  "Atualizar agora" (reconnect + `onu_update_info`) — não é um
  timestamp absoluto nem um intervalo de polling configurado. Exibido
  na tela da ONU do app (`formatarTempoDesdeColeta` em
  `frontend/src/pages/OnuStatus.tsx`) como "Dados coletados há Xmin",
  só a partir do valor já trazido por `buscarOnu()` — não há relógio
  correndo ao vivo no frontend, o texto reflete a última busca feita.

### 5.1. Reiniciar/Remover/Associar cliente — achados SEM disparar a ação de verdade

Técnica usada (nova nesta sessão): em vez de clicar o botão de verdade
(reiniciar/remover uma ONU real derrubaria a conexão de um cliente de
verdade), os ícones de ação da tela "ONU - Registrado" são componentes
ExtJS — dá para pegar o handler de cada um **sem clicar** via
`Ext.ComponentQuery.query('actioncolumn')`, e ler `item.handler.toString()`
para extrair a URL e os campos do corpo. Confirmado que só ABRIR a janela
de confirmação ("Fibra Onu": "Reiniciar ONU, `<nome>`?" / clicar "Não")
não dispara nada — conferido lendo `window.__capturas` (nenhuma chamada a
`apply_reboot`/`delete`/`apply_wan` até o fechamento).

- **Reiniciar**: `POST /fiber_ctl/onu/apply_reboot`, corpo
  `olt_pk/frame_id/slot_id/port_id/onu_id` (mesmos identificadores OSPO
  de `onu_update_info`, **sem** `onu_serial`).
- **Remover**: `POST /fiber_ctl/onu/delete`, mesmo corpo exato do
  reiniciar (só muda a URL).
- **Renomear**: `POST /fiber_ctl/onu/apply_rename`, mesmo corpo OSPO
  do reiniciar/remover mais `onu_name` (confirmado ao vivo lendo o
  form da janela "ONU - Renomear" e o JS `fiber_onu_rename.js` — o
  rótulo do campo no painel é "Descrição", mas o form submete
  `onu_name`, não `onu_desc`).
- **Associar a um cliente** (pedido do usuário: "se a onu não tiver
  cliente vinculado, registrar ao cliente buscando pelo nome"): não
  existe um endpoint de "associar" dedicado. O painel faz isso através
  da janela "Informações" da ONU (ícone "i"), que tem uma seção
  "Cliente" com combo de busca por nome (`POST
  /controllrctl/client/list_combo`, `where` com `client_complete_name`
  oper 10 = ILIKE `%valor%`, mesmo padrão já usado em `buscar_clientes`)
  — selecionar um cliente ali:
  1. Busca os contratos dele (`/controllrctl/contract/list_combo`,
     `where contract.client_pk=<pk>`).
  2. Busca a CPE do contrato (`/aaa_ctl/cpe/list_combo`, `where
     aaa_cpe.contract_pk=<pk>` — **mesmo endpoint que `cpe_list_combo`
     do brbyteapi já usa em `clientes.py`**, e o retorno CRU, sem
     `model_return`, já traz `cpe_username`/`cpe_password` prontos —
     o model `CPECombo` do pacote vendorizado NÃO expõe
     `cpe_password`, por isso a chamada tem que ser sem
     `model_return=True`).
  3. Preenche "PPPoE Usuário"/"Senha" com o `cpe_username`/`cpe_password`
     achado — **não existe PPPoE "solto"**, é sempre o acesso que já
     existe no cadastro do cliente. Cliente sem CPE cadastrada não dá
     para associar por aqui.
  4. "Salvar" chama `POST /fiber_ctl/onu/apply_wan` com **o registro
     inteiro da config de WAN da ONU** (mesmo padrão "registro completo"
     já visto em `phone/update` — confirmado lendo o handler do botão
     "Salvar": referencia `client_pk`, `contract_pk`, `cpe_pk` vindos dos
     combos, mais todos os campos nomeados do formulário). Campos do
     formulário (nome = chave enviada): `onu_wancfg_conntype`,
     `wan_tpl_pk`, `onu_wancfg_vlanid`, `onu_wancfg_user_vlanid`,
     `onu_wancfg_cos`, `onu_wancfg_tcont`, `onu_wancfg_gemport`,
     `onu_wancfg_svlan`, `onu_wancfg_stpid`, `onu_wancfg_scos`,
     `onu_wancfg_pon_profile`, `onu_wancfg_pppoe_username`,
     `onu_wancfg_pppoe_passwd`, `onu_wancfg_pppoe_svcname`,
     `onu_wancfg_local_ip`, mais `olt_pk`/`frame_id`/`slot_id`/
     `port_id`/`onu_id`/`onu_serial`.
  - **Boa notícia**: o modelo vendorizado `ONU`/`ONUExtended`
    (`brbyteapi/controllr/models/onu.py`) **já mapeia todos esses campos
    de WAN** (`wancfg_conntype`, `wan_tpl_pk`, `wancfg_vlanid` etc.) —
    `buscarOnu()` já traz tudo que é preciso reenviar para não zerar a
    config de rede da própria ONU ao associar um cliente; não precisou
    editar o pacote vendorizado nem fazer fetch adicional no backend.
  - O ícone "editar" (lápis) da lista é só **renomear** a ONU
    (`fiber_onu_rename`) — não tem nada a ver com cliente/CPE, apesar do
    nome sugestivo.
  - **`onu_pk` vem `0`** para uma ONU já registrada na OLT mas ainda sem
    cliente vinculado (`client_pk`/`cpe_pk`/`contract_pk` também vêm `0`
    nesse caso) — confirmado ao vivo numa ONU real de instalação nova.
    `0` aqui é um valor **válido**, não "faltando": qualquer checagem no
    frontend do tipo `!onu.pk` (falsy) trata esse caso como dado
    insuficiente e bloqueia a ação sem nem chamar o backend — precisa
    ser `onu.pk == null`. Isso não quebra nada de verdade porque as
    rotas de reiniciar/remover/associar nem usam o `onu_pk` da URL pra
    montar a chamada ao Controllr (usam olt_pk/frame/slot/pon/onu_id).
  - Módulo `fiber_onu_add` (`/fiber_ctl/onu/add`, botão "Cadastrar" da
    tela "Não Registrado") é só para dar entrada na ONU na rede
    (name/line_profile/service_profile/model/slot/port/serial) — **sem
    nenhum campo de cliente**. Confirma que associar cliente é sempre
    via a janela de Informações de uma ONU já registrada, nunca no
    cadastro inicial.

---

## 6. Contrato (`/controllrctl/contract/*`)

- `contract_status`: **confirmado pelo usuário** — `0` Desativado,
  `1` Ativado, `2` Alertado, `3` Pendente, `4` Bloqueado, `5` Cancelado.
- **Bug confirmado (também documentado no app cliente de referência)**:
  filtrar `/controllrctl/contract/list` por `client_pk` pode voltar
  **vazio mesmo com contrato de verdade existindo**. Único filtro
  confiável: `contract_pk` (oper 5, `=`), um de cada vez.
- **`sign_url=true`** — parâmetro extra (não documentado) que precisa
  ir junto no corpo para `contract_sign_doc_link` aparecer na resposta.
  Sem ele, o campo simplesmente **some** da resposta (não vem `null`,
  não aparece a chave). Confirmado comparando ao vivo a chamada real do
  painel (`where` por `contract.contract_pk` + `sign_url=true`) contra
  a mesma chamada sem esse parâmetro. Não tem relação com permissão/ACL
  nem com Basic Auth vs sessão por cookie — testei as duas hipóteses e
  descartei antes de achar a real.
- `contract_sign_date` — vazio/null = ainda não assinado; é o próprio
  indicador de status, não tem um campo "assinado: sim/não" separado.
- `contract_sign_code` / `contract_sign_info` / `contract_sign_draw` /
  `contract_sign_ip` / `contract_sign_hash` — existem na resposta
  (vistos ao vivo), mas sem descrição nenhuma na doc oficial. Não
  inventamos rótulo/tradução para eles — mostrados crus quando presentes.
- Itens do contrato: `/controllrctl/contract/svclist`, sem wrapper no
  pacote vendorizado (chamada direta). Filtro confirmado (no app
  cliente de referência): `item.contract_pk` (com prefixo).

---

## 7. Sessão online (`/aaa_ctl/session_online/list`)

**Não documentado em lugar nenhum** — nem a doc oficial, nem o pacote
vendorizado. Campos confirmados capturando ao vivo a tela "Sessões
Online" do próprio painel:

- `session_callingid` — MAC do cliente (RADIUS Calling-Station-Id).
- `contract_status` — mesmo enum da seção 6.
- `nas_name` / `nas_addr` (ou `session_nas_ip` / `session_nas_identifier`,
  valores duplicados) — NAS que atende a sessão.
- `session_nas_port_id` — porta do NAS (ex: `"VLAN2400-FTTH-GE03"`).
- `session_v4_ip`, `session_v6_px`, `session_v6_pd`.
- `session_acct_time` — tempo conectado **em segundos**. NÃO é
  `session_uptime` nem baseado em `session_start` (nomes que a gente
  chutou antes de confirmar e não existem na resposta real).
- Consumo: **aninhado** em `stats.total.rx_byte` / `stats.total.tx_byte`
  — não são campos soltos no nível raiz. Valor está em **KB**, não
  bytes (confirmado batendo a conta contra o "Rx Bytes"/"Tx Bytes"
  mostrado na tela real do Controllr). E são do ponto de vista do
  **NAS** (convenção RADIUS accounting), não do cliente:
  `rx_byte` = recebido PELO NAS vindo do cliente = **upload** do
  cliente; `tx_byte` = enviado PELO NAS para o cliente = **download** do
  cliente. Fácil de inverter por engano se pensar do ponto de vista do
  cliente.

---

## 7.5. Histórico de sessões (`/aaa_ctl/session_history/list`)

**Não documentado em lugar nenhum.** Confirmado ao vivo abrindo
"Histórico - Acesso" de um CPE no painel (botão no topo da janela de
cadastro do CPE) e capturando o corpo real enviado pelo grid
(monkey-patch em `Ext.Ajax.request`, já que `read_network_requests` não
expõe o body da requisição).

- `where`: `cpe_pk` (oper 5) **AND** `session_username` (oper 10, ILIKE
  `%termo%`, opcional) **AND** um **grupo aninhado** (uma lista dentro da
  lista) com `session_date_close >= data_inicio` **AND**
  `session_date_close <= data_fim` para o período. Exemplo real
  (usuário `abimael-vsj`, período "Semana Passada" pedido em
  09/09/2026):
  ```json
  [
    {"field":"cpe_pk","oper":5,"value":4217},
    {"field":"AND"},
    {"field":"session_username","oper":10,"value":"%abimael-vsj%"},
    {"field":"AND"},
    [
      {"field":"session_date_close","oper":4,"value":"2026-08-30 00:00:00"},
      {"field":"AND"},
      {"field":"session_date_close","oper":3,"value":"2026-09-05 23:59:59"}
    ]
  ]
  ```
- Sem período nenhum (preset "Desde o Início" no painel) o `where` **não
  usa faixa nenhuma** — vira só `{"field":"session_date_close","oper":8,"value":null}`
  (oper 8 = IS NOT NULL) encadeado com AND nas condições acima.
- Paginação: `start`/`limit`/`page` de sempre, `sort=session_date_close`,
  `dir=DESC`.
- Campos confirmados na resposta (`results[]`): `session_date_start`
  (início da sessão), `session_date_close` (fim), `session_username`,
  `session_callingid` (MAC), `session_v4_ip`, `session_v6_px`,
  `session_v6_pd`, `session_nas_port_id`, `session_acct_time` (duração em
  **segundos**), `session_terminate_cause` (código RFC 2866
  Acct-Terminate-Cause — `0` = sem causa registrada/ainda ativa, `2` =
  Lost Carrier, confirmado ao vivo comparando com a coluna "Terminar" da
  grade real).
- `session_rx_byte` / `session_tx_byte` — **mesmo quirk de unidade da
  sessão online** (seção 7): valor em **KB**, não bytes, apesar do nome
  (confirmado batendo a conta: `7117908` KB × 1024 ≈ 6,79 GB, bate exato
  com o "RX Byte" mostrado na grade real).
- **Presets de período do painel** (botão cíclico "Data Fim", confirmado
  um por um disparando o filtro de verdade e lendo o `where` resultante):
  semana vai de **domingo a sábado** (pedindo "Essa Semana" em
  09/09/2026, quarta-feira, o painel devolveu 06/09 dom a 12/09 sáb).
  Mês/ano seguem o calendário normal (ex: "Mês passado" em setembro/2026
  devolveu 01/08 a 31/08). Nosso app replica esse cálculo no frontend
  (`utils/periodos.ts`) em vez de reproduzir o menu cycle button do
  Controllr.

---

## 8. Cadastro do cliente

- `client_phones` (e `client_emails`) vêm no formato
  `"Rótulo#-#valor"`, múltiplos separados por vírgula (ex:
  `"Celular#-#82996267665,Comercial#-#..."`). Confirmado no app cliente
  de referência (`HOTNET_WEB_APP/src/api/cadastro.ts`).
- `/controllrctl/addresses/update` e `/create` exigem `address_siafi`
  (código SIAFI do município) além dos campos óbvios — sem ele a
  chamada falha. Não é algo que o técnico deva digitar (não muda);
  sempre reenviar o valor já carregado.
- **Telefone é recurso PRÓPRIO do Controllr** (`/controllrctl/phone/*`
  — list, list_combo, create, update, delete), não um campo solto do
  cliente. `client_phones` (`client/list`) é só um resumo
  `"Rótulo#-#valor"` montado a partir desses registros para exibição —
  não tem `phone_pk`, então não dá para editar a partir dele.
  - Nome real da tabela para o `where`: **`client_phone`** (singular) —
    confirmado ao vivo testando candidatos: `client_pk` puro dá `42702`
    (ambíguo, mesmo padrão de outros endpoints), `phone.client_pk` dá
    `42P01` (tabela errada), `client_phone.client_pk` funciona.
  - Campos reais (via `phone_list`, sem cast de model — nomes crus):
    `phone_pk`, `phone_identification` (rótulo, ex: "PRINCIPAL",
    "Celular", "WHATSAPP"), `phone_number`, `phone_operator`,
    `phone_type`, `client_pk`, `phone_sva`, `phone_status`,
    `phone_valid`, `phone_code`.
  - `/controllrctl/phone/update` **exige o registro inteiro**, não só o
    campo que mudou — confirmado ao vivo capturando um "Salvar" sem
    alteração nenhuma no formulário real do painel (`phone_type`,
    `phone_pk`, `client_pk`, `phone_identification`, `phone_status`,
    `phone_sva`, `phone_number`, `phone_operator`, `phone_valid`,
    `phone_code` — todos presentes no corpo, mesmo os que não mudaram).
    Mesmo padrão de "reenviar o que já veio carregado" já visto em
    endereço (`address_siafi` etc).
  - `/controllrctl/phone/create` usa o **mesmo formato** de
    `phone/update` (mesmos campos, incluindo um `phone_pk` vazio/
    irrelevante — formulário "Nova Entrada" e "Editar" são o mesmo
    componente no painel) — confirmado ao vivo criando e apagando um
    telefone de teste (`phone_delete` logo em seguida, sem deixar
    rastro). Defaults de um telefone novo no painel: `phone_status=1`,
    `phone_valid=1`, `phone_sva=1`, `phone_type=15` (bitmask dos 4 tipos
    de contato pré-marcados). `phone_operator` default é `"-"` (nenhuma
    operadora selecionada). `phone_code` parece ser só um código de
    verificação gerado no cliente (JS do painel), não validado por
    formato específico — geramos um número aleatório de 6 dígitos no
    backend em vez de depender de algo vindo do técnico.

---

## 8.5. Login/Logout — sessão por cookie, não por Basic Auth

Confirmado ao vivo (painel administrativo real, aba de rede): o botão
"Logout" do painel dispara `POST /session/logout`, **sem corpo**,
autenticado só pelo **cookie** de sessão que o próprio `/login` (form
`username`/`password`) devolve — o mesmo mecanismo usado por
`ControllrLogin.login` neste backend, cujo cookie a versão original do
pacote **descartava** (a `aiohttp.ClientSession` era fechada logo depois
de validar o login, junto com o cookie jar).

Isso importa porque este backend autentica as DEMAIS chamadas por
**Basic Auth por requisição** (decisão de arquitetura, ver `sessions.py`)
— e Basic Auth **não cria sessão nenhuma** no Controllr. Ou seja, chamar
`/session/logout` mandando só o header `Authorization: Basic ...` (sem o
cookie) não derruba nada, porque não existe sessão associada a esse
header para derrubar — foi exatamente o bug do primeiro logout
implementado aqui (parecia funcionar, mas era um no-op do lado do
Controllr).

Corrigido guardando o cookie devolvido pelo `/login` (agora
`ControllrLogin.login` retorna `ControllrLoginResult{success,
cookie_header}` em vez de só `bool`) junto da sessão do técnico
(`TechnicianSession.controllr_cookie`), e usando **esse cookie
específico** — não o Basic Auth — para chamar `/session/logout` no
`/auth/logout` deste backend.

**Atualização:** a decisão de Basic Auth por requisição foi abandonada.
Descoberto em produção que ela faz o Controllr abrir uma segunda sessão
"implícita", sem token pra fechar — aparecia duplicada na lista de
usuários online do painel. Migrado pra usar o cookie de sessão em toda
chamada (ver `app/deps.py::get_auth_context` e `app/brbyteapi/base.py`).

---

## 9. Bugs no `brbyteapi` vendorizado (não são do Controllr — são do pacote Python)

Vários campos do pacote vendorizado usavam o alias "bonito" em vez da
chave real da resposta do Controllr, então nunca eram preenchidos
mesmo com o dado presente. Todos corrigidos em
`backend/app/brbyteapi/controllr/models/`:

| Model | Campo | Alias errado (original) | Alias certo |
|---|---|---|---|
| `CPEExtended` | senha PPPoE | `password` | `cpe_password` |
| `CPEExtended` | localização do CPE | *(nem existia)* | `cpe_latitude`/`cpe_longitude` |
| `CPEExtended` | porta da CTO | `dp_port` | `cpe_dp_port` |
| `CPEExtended` | último MAC | `mac_last` | `cpe_mac_last` |

### Bug no parser de resposta (`base.py`, não é aliasing — é como a resposta HTTP é interpretada)

1. `success` era decidido **só pelo status HTTP** — mas pelo menos um
   endpoint (`undo_finish` numa OS já não-finalizada) devolve
   `{"success": false, ...}` com **status HTTP 200**. Corrigido:
   prioriza o `success` do próprio corpo da resposta quando presente.
2. Erros no formato `{"code": N, "message": "..."}` (sem `"errors"`)
   eram **descartados silenciosamente** — o campo `errors` do nosso
   `Response` ficava `[]`, escondendo o motivo real do erro atrás de um
   "não foi possível..." genérico. Corrigido: quando não há `errors`
   mas há `message`, sintetiza uma entrada `{"id": code, "msg": message}`.
3. `Response.total` era um `computed_field` = `len(results)` — ou seja,
   sempre o tamanho da PÁGINA atual, nunca o total de verdade no
   servidor. O corpo real de todo endpoint de listagem já traz um
   `"total"` próprio, separado de `"results"` (confirmado ao vivo: é o
   mesmo valor que aparece no rodapé "1 à N de `total`" das grades reais
   do painel — ex. `/invoice_ctl/invoice/list`, `/web_auth/acl_role/list`)
   — esse valor estava sendo descartado. Sintoma real: a tela "Clientes
   Offline" mostrava só 20 (o `limit` da página) quando o painel
   mostrava 105 no total, e "carregar mais" nunca fazia sentido porque
   `total` sempre batia com `len(results)`. Corrigido em
   `brbyteapi/response.py`/`base.py`: `response_json.get('total')` agora
   é capturado como `total_servidor`, e `Response.total` usa esse valor
   quando presente, caindo para `len(results)` só quando o endpoint não
   informa `total` nenhum.

---

## 10. CTO / Distribution Point (`/controllrctl/dp/list`) — coordenada e sugestão por proximidade

Além de `pk`/`name` (já usados no seletor de CTO da tela Conexão), o
registro cru de `/controllrctl/dp/list` traz `dp_lat`/`dp_lng` (string
decimal) com a coordenada da caixa — mas **nem toda CTO cadastrada tem
essa coordenada preenchida**, por isso o backend (`routers/dp.py`) não
usa o modelo Pydantic `DP` (que exige os dois campos) para a lista
inteira, e converte `dp_lat`/`dp_lng` para `float | None` campo a campo
(`_coordenada()`), devolvendo `None` para quem não tiver.

O frontend usa essas coordenadas para um botão "usar minha localização"
ao lado do combobox de CTO (`Conexao.tsx`): captura a posição do técnico
via `navigator.geolocation`, calcula a distância até cada CTO com
coordenada (fórmula de Haversine, `distanciaMetros()`) e reordena a lista
do combobox pela proximidade, mostrando a distância ao lado do nome.

Decisão de UX (pedido explícito do usuário): **não selecionar a CTO
sozinho por padrão** — GPS perto de caixas metálicas/muros perde
precisão facilmente (erro de 30–50 m em área urbana densa), então duas
CTOs próximas entre si poderiam ser confundidas. Só há auto-seleção
"cega" quando a mais próxima está a menos de 10 m *e* a segunda mais
próxima está pelo menos 20 m mais longe que ela (sem ambiguidade); fora
isso, a lista é só reordenada por distância e o técnico confirma
manualmente qual é a caixa certa.

---

## 11. Financeiro — faturas (`/invoice_ctl/invoice/list`) e pagamentos em observação (`/invoice_ctl/observation/*`)

Achados capturando ao vivo (via `Ext.ComponentQuery`) as telas reais
"Financeiro > Cobranças" (grid de faturas de um cliente) e "Financeiro >
Cobranças > Pagamentos em observação" do painel Controllr.

### 11.1. Fatura (`/invoice_ctl/invoice/list`)

- Filtrar por cliente é **ambíguo sem prefixo** (mesmo bug da seção 2):
  o campo certo é `client.client_pk`, não `client_pk` puro — confirmado
  lendo o `extraParams.where` real do grid "Cobranças" do cliente.
- `invoice_deleted` (oper 7 = IS) sempre entra no filtro para não trazer
  faturas removidas.
- `invoice_date_credit` vazio/null = ainda não paga (mesmo padrão de
  `contract_sign_date`) — não existe um campo "pago: sim/não" à parte.
  `invoice_late` (bool) indica atraso.
- Cada fatura já traz `obs_pk`/`obs_date_end` prontos quando tem um
  pagamento em observação ativo — não precisa de chamada extra a
  `observation/list` só para saber se está "em observação".
- `invoice_is_released` também vem no registro (visto ao vivo, sem
  descrição confirmada) — não usado ainda no app do técnico.

### 11.2. Pagamento em observação (`/invoice_ctl/observation/*`)

Tela do painel: Financeiro > Cobranças > "Pagamentos em observação" —
uma anotação presa a uma fatura que segura as consequências de um
atraso (ex: bloqueio) até uma data ou por N dias, enquanto o cliente
negocia. Grid real usa `/invoice_ctl/observation/list`, campos
confirmados no `store.model` do grid: `obs_pk`, `invoice_pk`,
`contract_pk`, `contract_number`, `client_pk`, `client_complete_name`,
`invoice_nosso_num`, `invoice_date_due`, `invoice_amount_document`,
`obs_date_end` ("Liberar"), `obs_date_cad` (cadastro), `obs_text`
(a observação), `obs_username`, `obs_status`, `obs_deleted`,
`obs_date_deleted`.

Formulário "Novo" (campos lidos direto do form real via
`win.query('field')`, não chutados):

| Campo (name) | Label no painel | Observação |
|---|---|---|
| `client_pk` | Cliente | combo |
| `contract_pk` | Contrato | combo |
| `invoice_pk` | Cobrança | combo, via `/invoice_ctl/invoice/list_combo` |
| `obs_release_type` | Liberar Tipo | `0` = Data de Validade, `1` = Período |
| `obs_date_end` | Liberar | datetime, usado só com tipo `0` |
| `obs_period` | Liberar (Dias) | numérico, usado só com tipo `1` |
| `obs_status` | Habilitado | **invertido** — `0` = habilitado, ver abaixo |
| `obs_text` | Descrição | texto livre — a observação em si |

**`obs_status` é invertido do que o nome/label sugere** — bug real já
cometido aqui: a primeira versão do backend mandava `obs_status=1`
"achando" que 1 = habilitado, e toda observação criada pelo app nascia
desabilitada. Confirmado ao vivo comparando com o próprio filtro
"Status: Habilitado" da grade "Pagamentos em observação"
(`extraParams.where` real: `{"field":"obs_status","oper":5,"value":0}`)
e com TODAS as observações reais já existentes (criadas por staff
direto no painel, meses antes deste app existir) — sem exceção, têm
`obs_status: 0`. Ou seja: `0` = habilitado/ativo, qualquer valor
diferente de zero = desabilitado. Sempre mandar `obs_status=0` ao criar
uma observação nova (ver `backend/app/routers/financeiro.py`).

Ações da grade (icones da coluna de ação, handlers lidos sem clicar,
mesma técnica da seção 5.1): "Habilitar/Desabilitar" →
`POST /invoice_ctl/observation/change_status`; "Remover" →
`POST /invoice_ctl/observation/delete`. Nenhuma das duas foi exposta
para o técnico no app (só visualizar faturas + criar observação, ver
`backend/app/routers/financeiro.py`).

### 11.3. ACL do módulo financeiro — como o Controllr decide quem tem acesso

Não existe um campo solto "liberado: sim/não" no cadastro do técnico
(`acl_user`) — a permissão é por **role** (`role_pk`/`role_name`, visto em
`/web_auth/acl_user/list`) e granular por ação, num catálogo GIGANTE
(819 registros) exposto em `POST /web_auth/acl_perm/list` (aceita
`role_pk` no body e devolve `view_act_allow` já resolvido para aquela
role). Confirmado ao vivo comparando roles reais desta operação:

| Role | `invoice_invoice.show` | `invoice_observation.show/create` |
|---|---|---|
| Root (1) | 1 | 1 |
| Administração (3) | 1 | 1 |
| **Técnico (5)** | **0** | **0** |
| **Técnico Suporte N1 (8)** | **1** | **1** |

Ou seja, entre as duas roles de técnico já em uso nesta operação, uma
tem acesso ao financeiro e outra não — confirma que "liberação de ACL"
é uma diferença real e deliberada, não um capricho. Só que
`/web_auth/acl_perm/list` e `/web_auth/acl_user/list` (para saber o
`role_pk` do técnico) são endpoints de administração — nada garante que
uma conta comum de técnico tenha permissão para chamá-los.

**Histórico**: uma primeira versão deste app tentou resolver essa
liberação uma única vez no login, chamando `/invoice_ctl/invoice/list`
sem `where` (sem filtro nenhum) e tratando um 403 como "sem liberação".
Isso deu dois problemas em produção: (1) sem filtro, a consulta demorou
o bastante pra estourar o timeout de 10s em quem TEM liberação — login
lento, e a exceção do timeout (não o 403 de verdade) fazia a checagem
sempre cair em "sem liberação"; (2) mesmo depois de trocar por um filtro
rápido (`client.client_pk = -1`, bate índice), o menu continuou não
aparecendo em produção — causa exata não isolada, mas a abordagem toda
de "decidir permissão uma vez no login e guardar numa flag" se mostrou
frágil o bastante para ser abandonada. Solução atual, mais simples e
robusta: o menu Financeiro **sempre aparece**; cada rota
(`backend/app/routers/financeiro.py`) só repassa fielmente o 403 que a
própria chamada real ao Controllr devolver na hora — mesmo padrão já
usado no fechamento de OS (seção 3), sem nenhuma pré-checagem.

---

## 12. Como investigar um novo caso (técnica que funcionou repetidas vezes)

1. Pedir para o usuário logar no painel real do Controllr (nunca eu digito
   credencial).
2. Injetar via `javascript_tool` um patch em `window.fetch`/
   `XMLHttpRequest.prototype.send` que guarda `{url, body, resposta}`
   de toda chamada que bater num padrão de URL.
3. Pedir para o usuário clicar na ação real na tela (ex: botão
   "Respondida").
4. Ler o corpo/resposta capturados — geralmente revela o endpoint e os
   campos exatos, sem chute nenhum.
5. Pra descobrir se um endpoint existe sem efeito colateral: mandar
   corpo **vazio** — se vier `"Required Field"` para algum campo, o
   endpoint existe de verdade; se vier o erro genérico de rota
   desconhecida do servidor (ver seção 3.2), não existe.
6. Pra descobrir o prefixo certo de uma coluna ambígua: testar
   candidatos plausíveis (nome real da tabela, visível em outros
   endpoints que já lidam com o mesmo dado) até um devolver sucesso.
