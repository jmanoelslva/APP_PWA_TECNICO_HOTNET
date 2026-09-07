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

/** "YYYY-MM-DD HH:mm:ss", mesmo formato usado pelo Controllr — para carimbar mensagens otimistas. */
export function agoraNoFormatoDoServidor(): string {
  const agora = new Date()
  const par = (n: number) => String(n).padStart(2, '0')
  return `${agora.getFullYear()}-${par(agora.getMonth() + 1)}-${par(agora.getDate())} ${par(agora.getHours())}:${par(agora.getMinutes())}:${par(agora.getSeconds())}`
}

/** Mapeamento oficial de contract_status confirmado na doc do Controllr. */
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
 * separados por vírgula (ex: "Celular#-#82996267665,Comercial#-#..."),
 * confirmado no app cliente de referência (D:\Desktop\WEB_APPS\
 * HOTNET_WEB_APP\src\api\cadastro.ts::formatarContatos). Aqui só o(s)
 * número(s) interessa(m), sem o rótulo.
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

/** Tipos de criptografia Wi-Fi do CPE (cpe_wifi_encryption_type), confirmado pelo usuário. */
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
 * Faixas de sinal óptico (dBm) da ONU — confirmadas contra um script de
 * monitoramento (bot de Telegram) já em uso interno na empresa, que usa
 * exatamente esses cortes para classificar RX de ONU (ver também
 * OnuStatus.tsx, que usa a mesma faixa para OLT com cortes diferentes).
 * Não é uma norma GPON genérica — é o critério já calibrado e adotado
 * por esta operação.
 */
export function nivelSinalOnu(rx: number | null | undefined): NivelSinal {
  if (rx == null) return 'desconhecida'
  if (rx >= -22) return 'boa'
  if (rx >= -24) return 'alerta'
  return 'critica'
}

export const TEXTO_SINAL_ONU: Record<NivelSinal, string> = {
  boa: 'Sinal normal',
  alerta: 'Sinal fraco',
  critica: 'Sinal crítico',
  desconhecida: 'Sinal não informado',
}
