// QR Code do Wi-Fi (formato que a câmera do Android e do iPhone entende:
// WIFI:T:WPA;S:<rede>;P:<senha>;;) e o texto para mandar no WhatsApp.

/** \ ; , " e : precisam de barra antes, pela especificação do formato. */
function escapar(valor: string): string {
  return valor.replace(/([\\;,":])/g, '\\$1')
}

export function textoQrWifi(rede: string, senha?: string | null): string {
  const s = escapar(rede)
  if (!senha) return `WIFI:T:nopass;S:${s};;`
  return `WIFI:T:WPA;S:${s};P:${escapar(senha)};;`
}

export function mensagemWifi(rede: string, senha?: string | null): string {
  const linhas = ['Dados do seu Wi-Fi:', `Rede: ${rede}`]
  if (senha) linhas.push(`Senha: ${senha}`)
  return linhas.join('\n')
}
