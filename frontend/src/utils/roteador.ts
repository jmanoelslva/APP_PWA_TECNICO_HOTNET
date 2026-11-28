// Endereço para abrir o acesso web do roteador do cliente: IP da conexão
// + porta gravada no acesso ao roteador (cpe_access_port). Só IPv4 — o
// acesso remoto é pelo IP da sessão PPPoE.

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/
const PORTAS_HTTPS = new Set([443, 8443])

/** URL do roteador, ou null se o IP não for um IPv4 válido. */
export function urlRoteador(ip: string | null | undefined, porta?: number | null): string | null {
  const endereco = ip?.trim()
  if (!endereco || !IPV4.test(endereco)) return null
  const portaValida = porta != null && Number.isInteger(porta) && porta > 0 && porta <= 65535 ? porta : null
  const protocolo = portaValida != null && PORTAS_HTTPS.has(portaValida) ? 'https' : 'http'
  const padrao = protocolo === 'https' ? 443 : 80
  const sufixo = portaValida != null && portaValida !== padrao ? `:${portaValida}` : ''
  return `${protocolo}://${endereco}${sufixo}/`
}
