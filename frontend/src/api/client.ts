/**
 * Cliente HTTP pro backend próprio (FastAPI, ver ../../backend) — não fala
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
 * Aviso de sessão expirada pro resto do app — este módulo é código comum
 * (fora de componente React), não dá pra chamar useSessao()/useToast()
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
  // responder 401 pra senha errada — POST /auth/login sempre devolve 200
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

export interface CpeComboDto {
  cpe_pk?: number
  client_pk?: number
  contract_pk?: number
  circuit_id?: string
  client_complete_name?: string
  dp_name?: string
  dp_pk?: number
  mac?: string
  nas_name?: string
  plan_pk?: number
  username?: string
}

export interface ContratoDto {
  contract_pk?: number
  contract_number?: number
  contract_status?: number
  contract_pay_day?: number
  contract_date_activation?: string
  client_pk?: number
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
  // Código SIAFI do município — obrigatório pro Controllr aceitar criar/
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

export interface DetalheClienteResponse {
  success: boolean
  cliente: ClienteDto
  contratos: ContratoDto[]
  enderecos: EnderecoDto[]
  cpes: CpeComboDto[]
}

export function buscarDetalheCliente(clientPk: number): Promise<DetalheClienteResponse> {
  return get<DetalheClienteResponse>(`clientes/${clientPk}`)
}

// ---------------------------------------------------------------------
// Endereço / localização
// ---------------------------------------------------------------------

export interface EnderecoPayload {
  // client_pk, address_zipcode, address_siafi, address e address_default
  // são obrigatórios pro Controllr (confirmado na doc oficial) — ao
  // editar um endereço já existente, sempre reenviar os valores já
  // carregados (ver ModalEditarEndereco em DetalheCliente.tsx), nunca
  // pedir isso de novo pro técnico.
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
  access_login?: string
  access_password?: string
  v4_ip?: string
  v4_ip_last?: string
  mac?: string
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
}

export interface BuscaCpeResponse {
  success: boolean
  results: CpeDto[]
}

export function buscarCpe(filtro: { client_pk?: number; contract_pk?: number; cpe_pk?: number }): Promise<BuscaCpeResponse> {
  return get<BuscaCpeResponse>('cpe/busca', filtro)
}

export interface SessaoOnlineResponse {
  success: boolean
  results: Record<string, unknown>[]
}

export function buscarSessaoOnlineCpe(cpePk: number): Promise<SessaoOnlineResponse> {
  return get<SessaoOnlineResponse>(`cpe/${cpePk}/sessao`)
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
  client_name?: string
  client_pk?: number
  contract_pk?: number
  contract_number?: number
  // Acesso PPPoE configurado na própria ONU (não no CPE) — confirmado
  // populado em produção via /fiber_ctl/onu/list.
  wancfg_pppoe_username?: string
  wancfg_pppoe_passwd?: string
}

export interface BuscaOnuResponse {
  success: boolean
  results: OnuDto[]
}

export function buscarOnu(filtro: { serial?: string; cpe_pk?: number; olt_pk?: number }): Promise<BuscaOnuResponse> {
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

// ---------------------------------------------------------------------
// Suporte / OS
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
}

export interface ListarOSResponse {
  success: boolean
  results: TicketDto[]
  total: number
}

export function listarOS(opcoes: { minhas: boolean; start?: number; limit?: number }): Promise<ListarOSResponse> {
  return get<ListarOSResponse>('suporte/os', { minhas: opcoes.minhas, start: opcoes.start ?? 0, limit: opcoes.limit ?? 20 })
}

export function detalheOS(ticketPk: number): Promise<{ success: boolean; ticket: TicketDto }> {
  return get(`suporte/os/${ticketPk}`)
}

export interface OperacaoDto {
  op_pk?: number
  op_desc?: string
  op_file?: string
  op_date_create?: string
  op_type?: number
  op_code?: number
  op_client?: boolean
}

export function listarMensagensOS(ticketPk: number): Promise<{ success: boolean; results: OperacaoDto[] }> {
  return get(`suporte/os/${ticketPk}/mensagens`)
}

export function criarMensagemOS(ticketPk: number, opDesc: string): Promise<{ success: boolean; results: unknown }> {
  return post(`suporte/os/${ticketPk}/mensagens`, { op_desc: opDesc })
}

export async function enviarAnexoOS(ticketPk: number, arquivo: File): Promise<{ success: boolean; results: unknown }> {
  const form = new FormData()
  form.append('file', arquivo)
  return postForm(`suporte/os/${ticketPk}/anexos`, form)
}

export function fecharOS(ticketPk: number, observacao?: string): Promise<{ success: boolean; results: unknown }> {
  return post(`suporte/os/${ticketPk}/fechar`, { observacao })
}
