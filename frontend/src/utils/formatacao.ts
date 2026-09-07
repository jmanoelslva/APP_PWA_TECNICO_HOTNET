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

/** "YYYY-MM-DD HH:mm:ss", mesmo formato usado pelo Controllr — pra carimbar mensagens otimistas. */
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

/** Tipos de criptografia Wi-Fi do CPE (cpe_wifi_encryption_type), confirmado pelo usuário. */
export const OPCOES_CRIPTOGRAFIA_WIFI: Array<{ valor: number; rotulo: string }> = [
  { valor: 0, rotulo: 'Nenhum' },
  { valor: 1, rotulo: 'WEP' },
  { valor: 2, rotulo: 'WPA' },
  { valor: 3, rotulo: 'EAP' },
]
