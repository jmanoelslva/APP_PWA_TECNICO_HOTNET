/** Base64 "de URL" (sem "=", com "-" e "_") para bytes — formato da chave pública do Web Push. */
export function base64UrlParaBytes(texto: string): Uint8Array<ArrayBuffer> {
  const preenchido = texto.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(texto.length / 4) * 4, '=')
  const binario = atob(preenchido)
  const bytes = new Uint8Array(new ArrayBuffer(binario.length))
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  return bytes
}
