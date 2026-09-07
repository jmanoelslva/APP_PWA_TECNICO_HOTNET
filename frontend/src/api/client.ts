/**
 * Cliente HTTP para o backend próprio (FastAPI, ver ../../backend) — não fala
 * direto com o Controllr (diferente do portal do cliente): todo dado
 * sensível de técnico (Basic Auth, ACL) fica só no backend. Sessão mantida
 * por cookie httpOnly (TECSESSION), por isso todo request usa
 * credentials: 'include'.
 */

const API_BASE = '/api'

export class SessaoExpiradaError extends Error {
  constructor() {
    super('Sessão expirada.')
    this.name = 'SessaoExpiradaError'
  }
}

export class ApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Aviso de sessão expirada para o resto do app — este módulo é código comum
 * (fora de componente React), não dá para chamar useSessao()/useToast()
 * diretamente daqui. SessionProvider (SessionContext.tsx) se registra
 * como ouvinte ao montar, e é quem realmente desloga (sair()) e mostra o
 * toast.
 */
let ouvinteSessaoExpirada: (() => void) | null = null

export function aoExpirarSessao(ouvinte: (() => void) | null): void {
  ouvinteSessaoExpirada = ouvinte
}

interface ErroPadrao {
  detail?: string
}

function querystring(params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) return ''
  const busca = new URLSearchParams()
  for (const [chave, valor] of Object.entries(params)) {
    if (valor !== undefined) busca.append(chave, String(valor))
  }
  const texto = busca.toString()
  return texto ? `?${texto}` : ''
}

async function tratarResposta<T>(response: Response, path: string): Promise<T> {
  // Diferente do Controllr direto, aqui não existe o quirk do /login
  // responder 401 para senha errada — POST /auth/login sempre devolve 200
  // com {success:false} nesse caso (ver backend/app/routers/auth.py). Um
  // 401 de verdade em QUALQUER rota aqui significa sessão ausente/expirada.
  if (response.status === 401) {
    ouvinteSessaoExpirada?.()
    throw new SessaoExpiradaError()
  }
  if (!response.ok) {
    let mensagem = `Erro ${response.status} ao chamar ${path}`
    try {
      const corpo = (await response.json()) as ErroPadrao
      if (corpo.detail) mensagem = corpo.detail
    } catch {
      // corpo não era JSON — mantém a mensagem genérica
    }
    throw new ApiError(mensagem)
  }
  return (await response.json()) as T
}

async function get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  const response = await fetch(`${API_BASE}/${path}${querystring(params)}`, {
    method: 'GET',
    credentials: 'include',
  })
  return tratarResposta<T>(response, path)
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}/${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return tratarResposta<T>(response, path)
}

async function put<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}/${path}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return tratarResposta<T>(response, path)
}

async function del<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}/${path}`, { method: 'DELETE', credentials: 'include' })
  return tratarResposta<T>(response, path)
}

async function postForm<T>(path: string, form: FormData): Promise<T> {
  const response = await fetch(`${API_BASE}/${path}`, { method: 'POST', credentials: 'include', body: form })
  return tratarResposta<T>(response, path)
}

// ---------------------------------------------------------------------
// Autenticação
// ---------------------------------------------------------------------

export interface TecnicoDto {
  username: string
  user_pk: number | null
}

export interface LoginResponse {
  success: boolean
  message?: string
  tecnico?: TecnicoDto
}

export function login(username: string, password: string): Promise<LoginResponse> {
  return post<LoginResponse>('auth/login', { username, password })
}

export function logout(): Promise<{ success: boolean }> {
  return post('auth/logout')
}

export function buscarTecnicoAtual(): Promise<TecnicoDto> {
  return get<TecnicoDto>('auth/me')
}

// ---------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------

export interface ClienteDto {
  client_pk?: number
  client_name?: string
  client_lastname?: string
  client_complete_name?: string
  client_doc1?: string
  client_doc2?: string
  client_phones?: string
  client_emails?: string
  client_status?: number
  client_type?: number
}

// Vem de /aaa_ctl/cpe/list_combo SEM passar pelo modelo Python (o
// backend não faz o cast — ver clientes.py) — os nomes de campo aqui são
// os NOMES CRUS do Controllr (confirmados na doc oficial:
// apidoc.brbyte.com/#post-/aaa_ctl/cpe/list_combo), não os nomes
// "bonitos" que o pacote brbyteapi usaria se passasse pelo modelo
// (ex: aqui é "cpe_username", não "username" — diferente de CpeDto,
// que vem de /cpe/busca já cast pelo modelo, ver Conexao.tsx).
export interface CpeComboDto {
  cpe_pk?: number
  client_pk?: number
  contract_pk?: number
  // /aaa_ctl/cpe/list_combo só traz contract_pk (confirmado na doc
  // oficial) — contract_number é completado pelo próprio backend
  // cruzando com os contratos do cliente (ver clientes.py), não vem
  // assim da API do Controllr.
  contract_number?: number
  cpe_circuit_id?: string
  client_complete_name?: string
  dp_name?: string
  dp_pk?: number
  cpe_mac?: string
  nas_name?: string
  plan_pk?: number
  cpe_username?: string
}

export interface ItemContratoDto {
  item_pk?: number
  contract_pk?: number
  item_name?: string
  item_amount?: string
  item_type?: number
  item_rent?: boolean
  plan_name?: string
  plan_pk?: number
}

export interface ContratoDto {
  contract_pk?: number
  contract_number?: number
  contract_status?: number
  contract_pay_day?: number
  contract_date_activation?: string
  client_pk?: number
  // Assinatura do contrato (confirmado na doc oficial,
  // apidoc.brbyte.com/#post-/controllrctl/contract/list): sign_date vem
  // vazio/null enquanto o contrato não foi assinado — é o indicador de
  // status. sign_doc_link é o link para ver/assinar o documento. Os demais
  // contract_sign_* (code/info/draw/ip/hash — vistos numa captura real,
  // mas sem descrição na doc) chegam soltos via o índice abaixo e são
  // mostrados de forma genérica (ver DetalheCliente.tsx).
  contract_sign_date?: string
  contract_sign_doc_link?: string
  itens?: ItemContratoDto[]
  [chave: string]: unknown
}

export interface EnderecoDto {
  address_pk?: number
  address_identification?: string
  address?: string
  address_number?: string
  address_neighborhood?: string
  address_zipcode?: string
  address_province?: string
  address_state?: string
  address_completation?: string
  address_default?: number
  // Código SIAFI do município — obrigatório para o Controllr aceitar criar/
  // atualizar o endereço (confirmado na doc oficial), mas não é algo que
  // o técnico deva digitar: sempre reenviar o valor já carregado.
  address_siafi?: number
  address_latitude?: string
  address_longitude?: string
  client_pk?: number
}

export interface BuscaClienteResultado {
  client_pk: number
  cliente: ClienteDto
  cpes: CpeComboDto[]
}

export interface BuscaClienteResponse {
  success: boolean
  results: BuscaClienteResultado[]
}

export function buscarClientes(filtros: { doc?: string; contrato?: number; nome?: string }): Promise<BuscaClienteResponse> {
  return get<BuscaClienteResponse>('clientes/busca', filtros)
}

// Telefone é recurso próprio do Controllr (/controllrctl/phone/*), não um
// campo solto do cliente — client_phones (ClienteDto) é só um resumo
// "Rótulo#-#número" sem phone_pk, então não dá para editar a partir dele.
// Estes campos vêm crus da API (sem cast por model no backend), por isso
// os nomes batem 1:1 com o Controllr.
export interface TelefoneDto {
  phone_pk?: number
  client_pk?: number
  phone_identification?: string
  phone_number?: string
  phone_operator?: string
  phone_type?: number
  phone_sva?: number
  phone_status?: number
  phone_valid?: number
  phone_code?: string
}

export interface DetalheClienteResponse {
  success: boolean
  cliente: ClienteDto
  contratos: ContratoDto[]
  enderecos: EnderecoDto[]
  cpes: CpeComboDto[]
  telefones: TelefoneDto[]
}

export function buscarDetalheCliente(clientPk: number): Promise<DetalheClienteResponse> {
  return get<DetalheClienteResponse>(`clientes/${clientPk}`)
}

// Reenvia o registro inteiro (não só phone_number) — confirmado ao vivo
// que o Controllr espera o telefone completo no update, mesmo para trocar
// só o número (ver backend/app/routers/telefones.py).
export function atualizarTelefone(phonePk: number, dados: TelefoneDto): Promise<{ success: boolean; results: unknown }> {
  return put(`telefones/${phonePk}`, dados)
}

// Só identificação e número — o backend preenche o resto (status,
// válido, SVA, tipo de contato) com os mesmos valores padrão de um
// telefone novo no painel (confirmado ao vivo, ver telefones.py).
export function criarTelefone(dados: {
  client_pk: number
  phone_identification: string
  phone_number: string
}): Promise<{ success: boolean; results: unknown }> {
  return post('telefones', dados)
}

// ---------------------------------------------------------------------
// Endereço / localização
// ---------------------------------------------------------------------

export interface EnderecoPayload {
  // client_pk, address_zipcode, address_siafi, address e address_default
  // são obrigatórios para o Controllr (confirmado na doc oficial) — ao
  // editar um endereço já existente, sempre reenviar os valores já
  // carregados (ver ModalEditarEndereco em DetalheCliente.tsx), nunca
  // pedir isso de novo para o técnico.
  client_pk?: number
  address?: string
  address_number?: string
  address_neighborhood?: string
  address_zipcode?: string
  address_province?: string
  address_state?: string
  address_siafi?: number
  address_default?: number
  address_completation?: string
  address_identification?: string
  address_latitude?: string
  address_longitude?: string
}

export function criarEndereco(payload: EnderecoPayload): Promise<{ success: boolean; results: unknown }> {
  return post('enderecos', payload)
}

export function atualizarEndereco(
  addressPk: number,
  payload: EnderecoPayload,
): Promise<{ success: boolean; results: unknown }> {
  return put(`enderecos/${addressPk}`, payload)
}

export function excluirEndereco(addressPk: number): Promise<{ success: boolean }> {
  return del(`enderecos/${addressPk}`)
}

export function atualizarLocalizacaoCpe(
  cpePk: number,
  latitude: string,
  longitude: string,
): Promise<{ success: boolean; results: unknown }> {
  return put(`cpe/${cpePk}/localizacao`, { address_latitude: latitude, address_longitude: longitude })
}

// ---------------------------------------------------------------------
// Conexão (CPE)
// ---------------------------------------------------------------------

export interface CpeDto {
  pk?: number
  username?: string
  // Senha PPPoE real (cpe_password na API) — é o que o cliente usa para
  // conectar. access_login/access_password é uma credencial DIFERENTE
  // (acesso administrativo ao próprio roteador/CPE), confirmado na doc
  // oficial (apidoc.brbyte.com/#post-/aaa_ctl/cpe/list) — os dois
  // existem separados, não são a mesma coisa com nomes diferentes.
  password?: string
  access_login?: string
  access_password?: string
  access_port?: number
  v4_ip?: string
  v4_ip_last?: string
  mac?: string
  // Último MAC visto (cpe_mac_last) — quando o cliente conecta por PPPoE
  // sem MAC fixo cadastrado, cpe_mac fica vazio e o MAC de verdade só
  // aparece aqui.
  mac_last?: string
  status?: number
  state?: number
  address?: string
  address_number?: string
  address_neighborhood?: string
  address_zipcode?: string
  address_latitude?: string
  address_longitude?: string
  client_complete_name?: string
  client_pk?: number
  contract_pk?: number
  contract_number?: number
  plan_name?: string
  dp_name?: string
  dp_pk?: number
  dp_port?: number
  obs?: string
  // Criptografia do Wi-Fi do próprio CPE/roteador (cpe_wifi_encryption_type/
  // password na API — confirmado na doc oficial, apidoc.brbyte.com/#post-
  // /aaa_ctl/cpe/update). Não há enum documentado para o "type" (a doc só diz
  // que é number), por isso o app não tenta traduzir o código para um nome
  // de protocolo — mostra e edita o valor cru que o sistema fornecer.
  wifi_encryption_type?: number
  wifi_encryption_password?: string
}

export interface BuscaCpeResponse {
  success: boolean
  results: CpeDto[]
}

export function buscarCpe(
  filtro: { client_pk?: number; contract_pk?: number; cpe_pk?: number; username?: string },
): Promise<BuscaCpeResponse> {
  return get<BuscaCpeResponse>('cpe/busca', filtro)
}

export interface SessaoOnlineResponse {
  success: boolean
  results: Record<string, unknown>[]
}

export function buscarSessaoOnlineCpe(cpePk: number): Promise<SessaoOnlineResponse> {
  return get<SessaoOnlineResponse>(`cpe/${cpePk}/sessao`)
}

export function atualizarWifiCpe(
  cpePk: number,
  dados: { wifi_encryption_type?: number; wifi_encryption_password?: string },
): Promise<{ success: boolean; results: unknown }> {
  return put(`cpe/${cpePk}/wifi`, dados)
}

export interface DetalhesCpePayload {
  cpe_obs?: string
  dp_pk?: number
  cpe_dp_port?: number
  cpe_access_login?: string
  cpe_access_password?: string
  cpe_access_port?: number
}

export function atualizarDetalhesCpe(cpePk: number, dados: DetalhesCpePayload): Promise<{ success: boolean; results: unknown }> {
  return put(`cpe/${cpePk}/detalhes`, dados)
}

export interface DpDto {
  pk: number
  name: string
  lat: number | null
  lng: number | null
}

export function listarDps(): Promise<{ success: boolean; results: DpDto[] }> {
  return get<{ success: boolean; results: DpDto[] }>('dp/lista')
}

// ---------------------------------------------------------------------
// ONU
// ---------------------------------------------------------------------

export interface OnuDto {
  pk?: number
  sn?: string
  name?: string
  state?: string
  cmd_status?: number
  omddm_rx_power?: number
  omddm_tx_power?: number
  omddm_temperature?: number
  omddm_voltage?: number
  distance?: number
  signal_alert?: number
  signal_warning?: number
  dp_name?: string
  olt_pk?: number
  olt_name?: string
  olt_omddm_rx_power?: number
  olt_omddm_tx_power?: number
  model?: string
  vendor?: string
  frame?: number
  slot?: number
  pon?: number
  id?: number
  cpe_pk?: number
  cpe_v4_ip_last?: string
  // Porta da CTO (mesmo campo cpe_dp_port já usado no CPE — confirmado
  // no modelo vendorizado; não está na doc oficial de /fiber_ctl/onu/list,
  // mas o backend já expõe corretamente).
  cpe_dp_port?: number
  client_name?: string
  client_pk?: number
  contract_pk?: number
  contract_number?: number
  // Acesso PPPoE configurado na própria ONU (não no CPE) — confirmado
  // populado em produção via /fiber_ctl/onu/list.
  wancfg_pppoe_username?: string
  wancfg_pppoe_passwd?: string
  // Resto da config de WAN da ONU (Vlan, Cos, Template etc.) — o técnico
  // nunca edita isso diretamente, mas precisa ser reenviado ao associar
  // um cliente (ver associarClienteOnu), senão /fiber_ctl/onu/apply_wan
  // zeraria a configuração de rede da própria ONU (mesmo endpoint exige
  // o registro completo, confirmado lendo o handler do botão "Salvar" da
  // tela "Informações" do painel).
  wancfg_pppoe_svcname?: string
  wancfg_conntype?: number
  wan_tpl_pk?: number
  wancfg_vlanid?: number
  wancfg_user_vlanid?: number
  wancfg_cos?: number
  wancfg_tcont?: number
  wancfg_gemport?: number
  wancfg_svlan?: number
  wancfg_stpid?: number
  wancfg_scos?: number
  wancfg_pon_profile?: string
  wancfg_local_ip?: string
  // Wi-Fi e acesso web da própria ONU — confirmados na doc oficial
  // (apidoc.brbyte.com/#post-/fiber_ctl/onu/list).
  wificfg_name?: string
  wificfg_password?: string
  webcfg_login?: string
  webcfg_password?: string
}

export interface BuscaOnuResponse {
  success: boolean
  results: OnuDto[]
}

export function buscarOnu(
  filtro: { serial?: string; username?: string; cpe_pk?: number; olt_pk?: number },
): Promise<BuscaOnuResponse> {
  return get<BuscaOnuResponse>('onu/busca', filtro)
}

export function atualizarInfoOnu(
  onuPk: number,
  parametros: { olt_pk: number; onu_serial: string; slot_id: number; port_id: number; onu_id: number; frame_id?: number },
): Promise<{ success: boolean; results: unknown }> {
  // Rota do backend recebe os parâmetros por querystring, não por corpo
  // JSON (ver backend/app/routers/onu.py::atualizar_info_onu).
  const query = querystring({ ...parametros, frame_id: parametros.frame_id ?? 1 })
  return post(`onu/${onuPk}/atualizar${query}`)
}

interface OspoOnu {
  olt_pk: number
  slot_id: number
  port_id: number
  onu_id: number
  frame_id?: number
}

export function reiniciarOnu(onuPk: number, parametros: OspoOnu): Promise<{ success: boolean; results: unknown }> {
  const query = querystring({ ...parametros, frame_id: parametros.frame_id ?? 1 })
  return post(`onu/${onuPk}/reiniciar${query}`)
}

export function removerOnu(onuPk: number, parametros: OspoOnu): Promise<{ success: boolean; results: unknown }> {
  const query = querystring({ ...parametros, frame_id: parametros.frame_id ?? 1 })
  return post(`onu/${onuPk}/remover${query}`)
}

export interface AssociarClienteOnuPayload extends OspoOnu {
  client_pk: number
  // O cliente pode ter mais de uma conexão (CPE) cadastrada — o técnico
  // escolhe explicitamente qual usuário PPPoE vincular a esta ONU.
  cpe_pk: number
  onu_serial: string
  wancfg_conntype?: number
  wan_tpl_pk?: number
  wancfg_vlanid?: number
  wancfg_user_vlanid?: number
  wancfg_cos?: number
  wancfg_tcont?: number
  wancfg_gemport?: number
  wancfg_svlan?: number
  wancfg_stpid?: number
  wancfg_scos?: number
  wancfg_pon_profile?: string
  wancfg_pppoe_svcname?: string
  wancfg_local_ip?: string
}

export function associarClienteOnu(
  onuPk: number,
  dados: AssociarClienteOnuPayload,
): Promise<{ success: boolean; results: unknown }> {
  return post(`onu/${onuPk}/associar-cliente`, dados)
}

// ---------------------------------------------------------------------
// Suporte / Tickets — o CASO aberto pelo cliente (título, descrição,
// categoria, chat). Diferente de Ordem de Serviço (ver seção abaixo):
// um ticket pode ter uma ou mais OS vinculadas, cujo ciclo de vida é
// próprio (responder/iniciar/finalizar pelo técnico — ver
// responderOrdemServico/iniciarOrdemServico/finalizarOrdemServico).
// ---------------------------------------------------------------------

export interface TicketDto {
  ticket_pk?: number
  ticket_protocol?: string
  ticket_title?: string
  ticket_desc?: string
  ticket_status?: number
  ticket_date_create?: string
  ticket_date_last?: string
  ticket_date_close?: string
  category_name?: string
  contract_number?: number
  // Confirmados na doc oficial (apidoc.brbyte.com/#post-/support_ctl/ticket/list)
  client_pk?: number
  client_complete_name?: string
  address_pk?: number
}

export interface ListarTicketsResponse {
  success: boolean
  results: TicketDto[]
  total: number
}

export function listarTickets(
  opcoes: { minhas: boolean; clientPk?: number; start?: number; limit?: number },
): Promise<ListarTicketsResponse> {
  return get<ListarTicketsResponse>('suporte/tickets', {
    minhas: opcoes.minhas,
    client_pk: opcoes.clientPk,
    start: opcoes.start ?? 0,
    limit: opcoes.limit ?? 20,
  })
}

export function detalheTicket(ticketPk: number): Promise<{ success: boolean; ticket: TicketDto }> {
  return get(`suporte/tickets/${ticketPk}`)
}

export interface OperacaoDto {
  op_pk?: number
  op_desc?: string
  op_file?: string
  op_date_create?: string
  op_type?: number
  op_code?: number
  op_client?: boolean
  // Confirmados capturando ao vivo — o mesmo /support_ctl/op/list usado
  // para o chat também traz os eventos de responder/iniciar/finalizar/
  // desfazer da OS (op_os_pk aponta para o op_pk do registro raiz da OS).
  // Um "set" grava esse evento com a data preenchida; um "undo" grava
  // outro evento do MESMO op_type com a data nula — por isso para saber
  // o estágio atual é preciso olhar o evento mais recente de cada tipo,
  // não um campo fixo (ver DetalheOrdemServico.tsx).
  op_os_pk?: number
  op_date_answer?: string
  op_date_start?: string
  op_date_finish?: string
}

export function listarMensagensTicket(ticketPk: number): Promise<{ success: boolean; results: OperacaoDto[] }> {
  return get(`suporte/tickets/${ticketPk}/mensagens`)
}

export function criarMensagemTicket(ticketPk: number, opDesc: string): Promise<{ success: boolean; results: unknown }> {
  return post(`suporte/tickets/${ticketPk}/mensagens`, { op_desc: opDesc })
}

export async function enviarAnexoTicket(ticketPk: number, arquivo: File): Promise<{ success: boolean; results: unknown }> {
  const form = new FormData()
  form.append('file', arquivo)
  return postForm(`suporte/tickets/${ticketPk}/anexos`, form)
}

// ---------------------------------------------------------------------
// Ordem de Serviço (OS) — recurso PRÓPRIO do Controllr, diferente de
// Ticket (confirmado na doc oficial, tag "Ordem de Serviço"): é a OS,
// não o ticket, que representa o trabalho de campo agendado/atribuído
// ao técnico (op_date_sched, user_pk) e que de fato se fecha/cancela/
// reabre via /os/*.
// ---------------------------------------------------------------------

export interface OrdemServicoDto {
  op_pk?: number
  op_os_pk?: number
  // Número legível da OS (confirmado na doc oficial e visto ao vivo, ex:
  // "20260528000013") — diferente de op_pk (id interno) e de
  // ticket_protocol (número do CHAMADO, outra coisa).
  op_number?: string
  ticket_pk?: number
  op_date_sched?: string
  op_date_create?: string
  op_date_answer?: string
  op_date_start?: string
  op_date_finish?: string
  op_date_close?: string
  op_date_cancel?: string
  op_status?: number
  op_priority?: number
  op_desc?: string
  op_obs?: string
  op_client_show?: boolean
  address_pk?: number
  user_pk?: number
  staff_pk?: number
  task_pk?: number
  // Nome da tarefa (ex: "Instalação a Cabo", "Desinstalação Equipamento",
  // "Viabilidade") — confirmado ao vivo em /support_ctl/os/list, não
  // documentado na doc oficial. É o tipo de serviço definido pelo
  // escritório ao agendar a OS, diferente de op_desc (nota do técnico,
  // preenchida só ao confirmar uma etapa) e de ticket_title (assunto do
  // chamado aberto pelo cliente).
  task_name?: string
  // Confirmados na doc oficial (apidoc.brbyte.com/#post-/support_ctl/os/list)
  // — client_pk/contrato/endereço vêm prontos no próprio registro da OS,
  // sem precisar buscar o cliente à parte para mostrar isso na tela da OS.
  client_pk?: number
  client_complete_name?: string
  contract_pk?: number
  contract_number?: number
  ticket_protocol?: string
  address_identification?: string
  address?: string
  address_number?: string
  address_neighborhood?: string
  address_province?: string
  address_state?: string
  address_zipcode?: string
  address_completation?: string
}

export interface ListarOrdensServicoResponse {
  success: boolean
  results: OrdemServicoDto[]
  total: number
}

export function listarOrdensServico(
  opcoes: { minhas?: boolean; abertas?: boolean; ticketPk?: number; start?: number; limit?: number },
): Promise<ListarOrdensServicoResponse> {
  return get<ListarOrdensServicoResponse>('os', {
    minhas: opcoes.minhas ?? true,
    abertas: opcoes.abertas ?? true,
    ticket_pk: opcoes.ticketPk,
    start: opcoes.start ?? 0,
    limit: opcoes.limit ?? 20,
  })
}

// Os 4 estágios reais de uma OS (confirmado com o dono da operação):
// Agendada (feita pelo escritório) -> Respondida -> Iniciada ->
// Finalizada, todas pelo técnico. Fechar é etapa à parte, só do
// escritório (ACL do Controllr não libera para o técnico) — por isso não
// tem função de fechar aqui, só as 3 de progresso do técnico.
export function responderOrdemServico(
  ticketPk: number,
  parametros: { opOsPk: number; opDesc?: string },
): Promise<{ success: boolean; results: unknown }> {
  return post(`os/${ticketPk}/responder`, { op_os_pk: parametros.opOsPk, op_desc: parametros.opDesc })
}

export function iniciarOrdemServico(
  ticketPk: number,
  parametros: { opOsPk: number; opDesc?: string },
): Promise<{ success: boolean; results: unknown }> {
  return post(`os/${ticketPk}/iniciar`, { op_os_pk: parametros.opOsPk, op_desc: parametros.opDesc })
}

export function finalizarOrdemServico(
  ticketPk: number,
  parametros: { opOsPk: number; opDesc?: string },
): Promise<{ success: boolean; results: unknown }> {
  return post(`os/${ticketPk}/finalizar`, { op_os_pk: parametros.opOsPk, op_desc: parametros.opDesc })
}

// Desfazer exige op_desc (confirmado sondando o endpoint) — sem opcional,
// diferente das funções de marcar acima.
export function desfazerRespostaOrdemServico(
  ticketPk: number,
  parametros: { opOsPk: number; opDesc: string },
): Promise<{ success: boolean; results: unknown }> {
  return post(`os/${ticketPk}/desfazer-resposta`, { op_os_pk: parametros.opOsPk, op_desc: parametros.opDesc })
}

export function desfazerInicioOrdemServico(
  ticketPk: number,
  parametros: { opOsPk: number; opDesc: string },
): Promise<{ success: boolean; results: unknown }> {
  return post(`os/${ticketPk}/desfazer-inicio`, { op_os_pk: parametros.opOsPk, op_desc: parametros.opDesc })
}

export function desfazerFinalizacaoOrdemServico(
  ticketPk: number,
  parametros: { opOsPk: number; opDesc: string },
): Promise<{ success: boolean; results: unknown }> {
  return post(`os/${ticketPk}/desfazer-finalizacao`, { op_os_pk: parametros.opOsPk, op_desc: parametros.opDesc })
}

export function cancelarOrdemServico(
  ticketPk: number,
  parametros: { opOsPk: number; opDesc?: string },
): Promise<{ success: boolean; results: unknown }> {
  return post(`os/${ticketPk}/cancelar`, { op_os_pk: parametros.opOsPk, op_desc: parametros.opDesc })
}

export function reabrirOrdemServico(
  ticketPk: number,
  parametros: { opOsPk: number; opDesc?: string },
): Promise<{ success: boolean; results: unknown }> {
  return post(`os/${ticketPk}/reabrir`, { op_os_pk: parametros.opOsPk, op_desc: parametros.opDesc })
}
