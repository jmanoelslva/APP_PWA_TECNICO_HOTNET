// api.ipify.org/api6.ipify.org são públicos, sem chave, e servem
// exatamente para isso: descobrir o IPv4 e o IPv6 do dispositivo que faz
// a chamada, direto do navegador — api6 falha (não cai para IPv4) quando
// o dispositivo não tem conectividade IPv6. Timeout curto porque uma
// rede sem IPv6 não retorna erro rápido sozinha, só fica pendurada.
//
// Requer que a CSP do servidor libere esses dois domínios em
// "connect-src" (ver deploy/nginx.conf.example e apache-vhost.conf.example)
// — sem isso, o fetch é bloqueado pelo navegador antes de sair.
async function buscarIpPublico(url: string, timeoutMs = 4000): Promise<string | null> {
  const controlador = new AbortController()
  const temporizador = setTimeout(() => controlador.abort(), timeoutMs)
  try {
    const resposta = await fetch(url, { signal: controlador.signal })
    if (!resposta.ok) return null
    const dados = (await resposta.json()) as { ip?: string }
    return dados.ip ?? null
  } catch {
    return null
  } finally {
    clearTimeout(temporizador)
  }
}

export async function buscarIpsPublicos(): Promise<{ ipv4: string | null; ipv6: string | null }> {
  const [ipv4, ipv6] = await Promise.all([
    buscarIpPublico('https://api.ipify.org?format=json'),
    buscarIpPublico('https://api6.ipify.org?format=json'),
  ])
  return { ipv4, ipv6 }
}
