/**
 * Rascunho da descrição de finalização da OS: sobrevive ao app recarregar
 * (versão nova) ou ser fechado pelo sistema. Apagado ao finalizar.
 */
const PREFIXO_RASCUNHO = 'hotnet-tecnico-rascunho-'

export function lerRascunhoFinalizacao(osPk: number): string {
  try {
    return localStorage.getItem(PREFIXO_RASCUNHO + osPk) ?? ''
  } catch {
    return ''
  }
}

export function salvarRascunhoFinalizacao(osPk: number, texto: string): void {
  try {
    if (texto.trim()) localStorage.setItem(PREFIXO_RASCUNHO + osPk, texto)
    else localStorage.removeItem(PREFIXO_RASCUNHO + osPk)
  } catch {
    // sem armazenamento: vale só nesta tela
  }
}
