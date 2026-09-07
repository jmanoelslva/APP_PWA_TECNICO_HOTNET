# Notas sobre a API do Controllr (BrByte)

Este documento reúne tudo que descobrimos **testando ao vivo** contra o
Controllr real (`controllr.hotnet.net.br:8443`) que **não está** na doc
oficial (`https://apidoc.brbyte.com`), ou que a doc oficial descreve
incompleto/errado. Sem isso, cada descoberta ficava só espalhada em
comentário de código e mensagem de commit — difícil de achar de novo da
próxima vez que um bug parecido aparecer.

Convenção: "confirmado ao vivo" = testado de verdade contra o servidor
real (não é suposição). Quando um nome de campo/endpoint não tem link
pra doc oficial, é porque ele **não existe** na doc.

---

## 1. Formato do filtro `where`

JSON: lista de condições, intercaladas com `{"field":"AND"}` quando há
mais de uma. Exemplo: `[{"field":"a","oper":5,"value":1},{"field":"AND"},{"field":"b","oper":7,"value":null}]`.

**IMPORTANTE**: o corpo inteiro (`where=...` incluído) precisa passar
por `urlencode()` antes de virar o body da requisição. Colar o JSON cru
num f-string funciona por sorte pra valores só numéricos, mas quebra na
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
coluna sem prefixo de tabela vira ambíguo pro Postgres por trás. O
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
`/cancel`, `/reopen`. Só isso não é suficiente pro ciclo de vida real
que o Controllr usa.

### 3.1. Os 4 estágios reais (confirmado com o dono da operação)

1. **Agendamento** — feito pelo escritório, já vem pronto (`op_date_sched`).
2. **Respondida** — técnico viu a OS.
3. **Iniciada** — técnico começou o atendimento.
4. **Finalizada** — técnico terminou o atendimento.

**Fechar** a OS é uma etapa à parte, só do escritório — confirmado que
o ACL do Controllr nega (403 `{"code":-2,"message":"Access Denied"}`)
pra uma conta de técnico de verdade em `/support_ctl/os/close`.

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
devolvem o **mesmo** 403 `Access Denied` genérico do servidor pra rota
desconhecida — não confie em "deu 403" sozinho como prova de que um
endpoint existe. Confirme testando com corpo vazio: se vier
`"Required Field"` (validação de verdade), o endpoint existe; se vier
`Access Denied` até pra um nome claramente inventado, é só o fallback.

### 3.3. O detalhe que mais confundiu: onde mora o estado de cada etapa

Os campos `op_date_answer` / `op_date_start` / `op_date_finish` do
**registro raiz** da OS (o que `/support_ctl/os/list` devolve,
`op_type=1`) ficam **sempre nulos** — confirmado ao vivo, repetidas
vezes, mesmo depois de marcar todas as 3 etapas.

O que acontece de verdade: cada `set_*`/`undo_*` cria um **novo
registro de evento** (`op_type` 3=respondida, 4=iniciada, 5=finalizada),
visível só em `/support_ctl/op/list` (o **mesmo endpoint usado pro chat
do chamado**), vinculado à OS via `op_os_pk = op_pk do registro raiz`.

- Um `set_*` grava esse evento com a data correspondente **preenchida**.
- Um `undo_*` grava **outro** evento do **mesmo** `op_type`, só que com
  a data **nula** (confirmado comparando os dois registros criados ao
  vivo, campo a campo — só a data e a descrição diferem).

**Conclusão**: pra saber se uma etapa está marcada, é preciso pegar o
evento **mais recente** (maior `op_pk`) daquele `op_type`, vinculado à
OS certa, e olhar a data DELE — nunca um campo fixo da OS. Ver
`backend/app/routers/ordens_servico.py` e
`frontend/src/pages/DetalheOrdemServico.tsx` pra implementação.

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
  `/support_ctl/os/list` — não precisa buscar o cliente à parte só pra
  mostrar isso.
- **Não vêm prontos**: telefone do cliente, status/vencimento do
  contrato, dados de conexão (usuário/senha/IP/MAC/CTO) — precisa
  buscar via `/clientes/{pk}` e `/cpe/busca` à parte.

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
  (sem `contract_number`, só `contract_pk`) — pra mostrar o número de
  contrato de verdade é preciso cruzar com `/controllrctl/contract/list`
  filtrado por `contract_pk` (ver seção 6).

---

## 5. ONU (`/fiber_ctl/onu/list`)

- Busca por `cpe_pk` sozinho é ambígua/poitem trazer a ONU de **outro**
  cliente. Jeito confiável: busca "wizard" por `search_term`/
  `search_value` (não é o formato `where` normal):
  - `search_term=onu_serial` — busca por serial do equipamento.
  - `search_term=onu_wancfg_pppoe_username` — busca pelo usuário PPPoE
    do cliente (mais confiável pra achar a ONU certa; confirmado
    capturando a busca real do painel de fibra).
  - Payload completo confirmado (sentinelas `-1`/`0`/`128` = "não
    filtrar"): `olt_pk=0&dp_pk=-1&search_term=...&search_value=...&frame_id=-1&slot_id=-1&port_id=-1&onu_id=-1&duplicate_serial=-1&signal_min_limit=128&signal_max_limit=128&page=1&start=0&limit=15&sort=...&dir=ASC`.
- `onu_distance` — a doc diz só "string", sem unidade. **É em
  quilômetros, não metros** (confirmado pelo usuário — um valor real de
  ~10.58 corresponde a ~10,5km; bate também com o exemplo da doc,
  `"0.931"`, que só faz sentido como km pra alcance de GPON).
- `/fiber_ctl/olt/reconnect` — **confirmado seguro pelo usuário**: só
  força reler os dados da OLT, não derruba conexão de ninguém. Usado
  no fluxo de "Atualizar agora": reconnect → espera 15s →
  `onu_update_info` → espera 30s.

---

## 6. Contrato (`/controllrctl/contract/*`)

- `contract_status`: **confirmado pelo usuário** — `0` Desativado,
  `1` Ativado, `2` Alertado, `3` Pendente, `4` Bloqueado, `5` Cancelado.
- **Bug confirmado (também documentado no app cliente de referência)**:
  filtrar `/controllrctl/contract/list` por `client_pk` pode voltar
  **vazio mesmo com contrato de verdade existindo**. Único filtro
  confiável: `contract_pk` (oper 5, `=`), um de cada vez.
- **`sign_url=true`** — parâmetro extra (não documentado) que precisa
  ir junto no corpo pra `contract_sign_doc_link` aparecer na resposta.
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
  inventamos rótulo/tradução pra eles — mostrados crus quando presentes.
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
  cliente; `tx_byte` = enviado PELO NAS pro cliente = **download** do
  cliente. Fácil de inverter por engano se pensar do ponto de vista do
  cliente.

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
header pra derrubar — foi exatamente o bug do primeiro logout
implementado aqui (parecia funcionar, mas era um no-op do lado do
Controllr).

Corrigido guardando o cookie devolvido pelo `/login` (agora
`ControllrLogin.login` retorna `ControllrLoginResult{success,
cookie_header}` em vez de só `bool`) junto da sessão do técnico
(`TechnicianSession.controllr_cookie`), e usando **esse cookie
específico** — não o Basic Auth — pra chamar `/session/logout` no
`/auth/logout` deste backend.

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

---

## 10. Como investigar um novo caso (técnica que funcionou repetidas vezes)

1. Pedir pro usuário logar no painel real do Controllr (nunca eu digito
   credencial).
2. Injetar via `javascript_tool` um patch em `window.fetch`/
   `XMLHttpRequest.prototype.send` que guarda `{url, body, resposta}`
   de toda chamada que bater num padrão de URL.
3. Pedir pro usuário clicar na ação real na tela (ex: botão
   "Respondida").
4. Ler o corpo/resposta capturados — geralmente revela o endpoint e os
   campos exatos, sem chute nenhum.
5. Pra descobrir se um endpoint existe sem efeito colateral: mandar
   corpo **vazio** — se vier `"Required Field"` pra algum campo, o
   endpoint existe de verdade; se vier o erro genérico de rota
   desconhecida do servidor (ver seção 3.2), não existe.
6. Pra descobrir o prefixo certo de uma coluna ambígua: testar
   candidatos plausíveis (nome real da tabela, visível em outros
   endpoints que já lidam com o mesmo dado) até um devolver sucesso.
