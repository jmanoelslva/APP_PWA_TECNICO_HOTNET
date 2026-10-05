import { formatarStatusContrato } from '../../utils/formatacao'

// Formatação da sessão online e do histórico de conexão (CardSessaoOnline,
// CardRede).

export function rotuloEncerramento(causa: number | undefined): string {
  // Só os códigos abaixo têm tradução conhecida (ver
  // CONTROLLR_API_NOTES.md, seção 7.5) — para qualquer outro código
  // (RFC 2866 Acct-Terminate-Cause) mostra o número cru em vez de
  // arriscar uma tradução não confirmada.
  if (causa == null || causa === 0) return '—'
  if (causa === 2) return 'Lost Carrier'
  return `Código ${causa}`
}

// /aaa_ctl/session_online/list não tem documentação oficial. Campos de
// uma sessão (usados aqui): session_callingid (MAC), contract_status,
// nas_name/nas_addr, session_nas_port_id, session_v4_ip, session_v6_px/pd,
// session_acct_time (segundos conectado) e stats.total.rx_byte/tx_byte —
// esses dois últimos vêm aninhados dentro de "stats.total", com o valor
// em KB (não bytes, apesar do nome). Candidatos alternativos ficam como
// fallback caso o formato mude.
export function formatarBytes(valor: unknown): string {
  const n = Number(valor)
  if (!Number.isFinite(n)) return String(valor)
  if (n < 1024) return `${n} B`
  const unidades = ['KB', 'MB', 'GB', 'TB']
  let i = -1
  let v = n
  do {
    v /= 1024
    i++
  } while (v >= 1024 && i < unidades.length - 1)
  return `${v.toFixed(v < 10 ? 2 : 1)} ${unidades[i]}`
}

export function formatarDuracaoSegundos(segundos: number): string {
  const total = Math.max(0, Math.floor(segundos))
  const dias = Math.floor(total / 86400)
  const horas = Math.floor((total % 86400) / 3600)
  const minutos = Math.floor((total % 3600) / 60)
  const s = total % 60
  // Sessões de dias exibidas em "60h 26min" ficam difíceis de ler —
  // acima de 24h passa para dd/hh/mm com zero à esquerda (ex.:
  // "02d 12h 26m"), como um cronômetro.
  if (dias > 0) {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(dias)}d ${pad(horas)}h ${pad(minutos)}m`
  }
  if (horas > 0) return `${horas}h ${minutos}min`
  if (minutos > 0) return `${minutos}min ${s}s`
  return `${s}s`
}

function formatarTempoConectado(valor: unknown, chave: string): string {
  const chaveMin = chave.toLowerCase()
  const n = Number(valor)
  if (chaveMin.includes('start') || chaveMin.includes('inicio')) {
    // valor é um instante (início da sessão), não uma duração — calcula
    // o tempo decorrido até agora. Aceita epoch (segundos) ou ISO.
    const inicioMs = /^\d+$/.test(String(valor)) ? n * 1000 : new Date(String(valor)).getTime()
    if (!Number.isFinite(inicioMs)) return String(valor)
    return formatarDuracaoSegundos((Date.now() - inicioMs) / 1000)
  }
  if (Number.isFinite(n)) return formatarDuracaoSegundos(n)
  return String(valor)
}

interface ValorEncontrado {
  valor: unknown
  chave: string
}

type Sessao = Record<string, unknown>

interface CampoDesejado {
  rotulo: string
  extrair: (sessao: Sessao) => ValorEncontrado | undefined
  formatar?: (valor: unknown, chave: string) => string
}

function porCandidatos(candidatos: string[]): (sessao: Sessao) => ValorEncontrado | undefined {
  return (sessao) => {
    const chavesPorNomeMinusculo = new Map(Object.keys(sessao).map((chave) => [chave.toLowerCase(), chave]))
    for (const candidato of candidatos) {
      const chave = chavesPorNomeMinusculo.get(candidato)
      if (chave !== undefined) return { valor: sessao[chave], chave }
    }
    return undefined
  }
}

function porConsumo(direcao: 'rx' | 'tx'): (sessao: Sessao) => ValorEncontrado | undefined {
  const chaveAninhada = direcao === 'rx' ? 'rx_byte' : 'tx_byte'
  const candidatosPlanos = direcao === 'rx'
    ? ['session_input_octets', 'session_rx_bytes', 'rx_bytes', 'input_octets']
    : ['session_output_octets', 'session_tx_bytes', 'tx_bytes', 'output_octets']
  return (sessao) => {
    const stats = (sessao as { stats?: { total?: Record<string, unknown> } }).stats?.total
    const valorAninhado = stats?.[chaveAninhada]
    if (valorAninhado != null && valorAninhado !== '') {
      // stats.total.rx_byte/tx_byte vêm em KB, não bytes — converte antes de formatar.
      return { valor: Number(valorAninhado) * 1024, chave: chaveAninhada }
    }
    return porCandidatos(candidatosPlanos)(sessao)
  }
}

const CAMPOS_DESEJADOS: CampoDesejado[] = [
  { rotulo: 'Usuário PPPoE', extrair: porCandidatos(['session_username', 'cpe_username', 'username']) },
  { rotulo: 'MAC da CPE', extrair: porCandidatos(['session_callingid', 'cpe_mac', 'session_calling_station_id', 'mac']) },
  {
    rotulo: 'Status do contrato',
    extrair: porCandidatos(['contract_status', 'contract_status_name', 'client_contract_status']),
    formatar: (valor) => formatarStatusContrato(valor as number | string),
  },
  { rotulo: 'NAS (nome/identificador)', extrair: porCandidatos(['nas_name', 'session_nas_identifier', 'nas_identifier']) },
  { rotulo: 'NAS (endereço/IP)', extrair: porCandidatos(['nas_addr', 'session_nas_ip', 'nas_ip_address', 'nas_address']) },
  { rotulo: 'NAS (porta)', extrair: porCandidatos(['session_nas_port_id', 'nas_port_id']) },
  { rotulo: 'Circuit ID', extrair: porCandidatos(['session_circuit_id', 'cpe_circuit_id']) },
  { rotulo: 'IPv4', extrair: porCandidatos(['session_v4_ip', 'v4_ip']) },
  { rotulo: 'IPv6 (PX)', extrair: porCandidatos(['session_v6_px', 'v6_px']) },
  { rotulo: 'IPv6 (PD)', extrair: porCandidatos(['session_v6_pd', 'v6_pd']) },
  {
    rotulo: 'Tempo conectado',
    extrair: porCandidatos(['session_acct_time', 'session_uptime', 'session_duration', 'session_time']),
    formatar: formatarTempoConectado,
  },
  // rx/tx aqui são do ponto de vista do NAS (padrão RADIUS accounting):
  // rx_byte = recebido PELO NAS vindo do cliente = upload do cliente;
  // tx_byte = enviado PELO NAS para o cliente = download do cliente.
  { rotulo: 'Consumo (download)', extrair: porConsumo('tx'), formatar: formatarBytes },
  { rotulo: 'Consumo (upload)', extrair: porConsumo('rx'), formatar: formatarBytes },
]

/** [rótulo, valor formatado] de cada campo conhecido presente na sessão. */
export function camposSessao(sessao: Sessao | null): Array<[string, string]> {
  if (!sessao) return []
  const resultado: Array<[string, string]> = []
  for (const campo of CAMPOS_DESEJADOS) {
    const encontrado = campo.extrair(sessao)
    if (!encontrado) continue
    const { valor, chave } = encontrado
    if (valor == null || valor === '') continue
    resultado.push([campo.rotulo, campo.formatar ? campo.formatar(valor, chave) : String(valor)])
  }
  return resultado
}
