/** "YYYY-MM-DD" ou "YYYY-MM-DD HH:mm:ss" (formato do Controllr) → "DD/MM/YYYY". */
export function formatarData(data: string | null | undefined): string | null {
  if (!data) return null
  const soData = data.split(' ')[0]
  const partes = soData.split('-')
  if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`
  return soData
}

/** "YYYY-MM-DD HH:mm:ss" → "DD/MM/YYYY HH:mm". */
export function formatarDataHora(data: string | null | undefined): string {
  if (!data) return ''
  const partes = data.split(' ')
  const dataParte = partes[0]?.split('-')
  const horaParte = partes[1]?.slice(0, 5)
  if (dataParte?.length === 3) {
    return `${dataParte[2]}/${dataParte[1]}/${dataParte[0]}${horaParte ? ` ${horaParte}` : ''}`
  }
  return data
}

/** "YYYY-MM-DD HH:mm:ss" → "DD/MM/YYYY HH:mm:ss" — com segundos, para eventos que exigem mais precisão (ex: última autenticação, histórico de conexão). */
export function formatarDataHoraSegundos(data: string | null | undefined): string {
  if (!data) return ''
  const partes = data.split(' ')
  const dataParte = partes[0]?.split('-')
  const horaParte = partes[1]
  if (dataParte?.length === 3) {
    return `${dataParte[2]}/${dataParte[1]}/${dataParte[0]}${horaParte ? ` ${horaParte}` : ''}`
  }
  return data
}

/** "YYYY-MM-DD HH:mm:ss", mesmo formato usado pelo Controllr (ver where.py::corpo no backend). */
export function dataParaFormatoServidor(data: Date): string {
  const par = (n: number) => String(n).padStart(2, '0')
  return `${data.getFullYear()}-${par(data.getMonth() + 1)}-${par(data.getDate())} ${par(data.getHours())}:${par(data.getMinutes())}:${par(data.getSeconds())}`
}

/** Mesmo formato acima, carimbado com o instante atual — usado para mensagens otimistas. */
export function agoraNoFormatoDoServidor(): string {
  return dataParaFormatoServidor(new Date())
}

/** Mapeamento oficial de contract_status, doc do Controllr. */
const ROTULOS_STATUS_CONTRATO: Record<number, string> = {
  0: 'Desativado',
  1: 'Ativado',
  2: 'Alertado',
  3: 'Pendente',
  4: 'Bloqueado',
  5: 'Cancelado',
}

export function formatarStatusContrato(valor: number | string | null | undefined): string {
  if (valor == null) return '—'
  return ROTULOS_STATUS_CONTRATO[Number(valor)] ?? String(valor)
}

/**
 * client_phones vem no formato "Rótulo#-#número", às vezes múltiplos
 * separados por vírgula (ex: "Celular#-#82996267665,Comercial#-#...").
 * Aqui só o(s) número(s) interessa(m), sem o rótulo.
 */
export function extrairTelefones(raw: string | null | undefined): string | null {
  if (!raw) return null
  const numeros = raw
    .split(',')
    .map((parte) => parte.trim())
    .filter(Boolean)
    .map((parte) => parte.split('#-#').pop()?.trim() ?? parte)
    .filter(Boolean)
  return numeros.length > 0 ? numeros.join(', ') : null
}

/** Tipos de criptografia Wi-Fi do CPE (cpe_wifi_encryption_type). */
export const OPCOES_CRIPTOGRAFIA_WIFI: Array<{ valor: number; rotulo: string }> = [
  { valor: 0, rotulo: 'Nenhum' },
  { valor: 1, rotulo: 'WEP' },
  { valor: 2, rotulo: 'WPA' },
  { valor: 3, rotulo: 'EAP' },
]

/**
 * Um campo só decide sozinho o que foi digitado, em vez de pedir para o
 * técnico escolher entre nome/contrato/documento: CPF tem 11 dígitos,
 * CNPJ tem 14 — só números com uma dessas contagens vira busca por
 * documento; outra quantidade de dígitos vira busca por contrato;
 * qualquer coisa com letra vira busca por nome. Usado tanto na busca
 * completa (BuscaCliente.tsx) quanto no combobox rápido da Home.
 */
export function detectarTipoBusca(valor: string): { doc?: string; contrato?: number; nome?: string } {
  const termo = valor.trim()
  const somenteDigitos = termo.replace(/\D/g, '')
  if (somenteDigitos && somenteDigitos.length === termo.length) {
    if (somenteDigitos.length === 11 || somenteDigitos.length === 14) return { doc: somenteDigitos }
    return { contrato: Number(somenteDigitos) }
  }
  return { nome: termo }
}

export type NivelSinal = 'boa' | 'alerta' | 'critica' | 'desconhecida'

/**
 * Faixas de sinal óptico (dBm) da ONU, calibradas para esta operação —
 * não é uma norma GPON genérica (ver também OnuStatus.tsx, que usa a
 * mesma faixa para OLT com cortes diferentes).
 */
export function nivelSinalOnu(rx: number | null | undefined): NivelSinal {
  if (rx == null) return 'desconhecida'
  if (rx >= -22) return 'boa'
  if (rx >= -24) return 'alerta'
  return 'critica'
}

/** Valor monetário (number ou string do Controllr) → "1.234,56", sem o "R$" (quem exibe decide o prefixo). */
export function formatarMoeda(valor: number | string | null | undefined): string {
  if (valor == null || valor === '') return '—'
  const numero = typeof valor === 'string' ? Number(valor.replace(',', '.')) : valor
  if (Number.isNaN(numero)) return String(valor)
  return numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export const TEXTO_SINAL_ONU: Record<NivelSinal, string> = {
  boa: 'Sinal normal',
  alerta: 'Sinal fraco',
  critica: 'Sinal crítico',
  desconhecida: 'Sinal não informado',
}
