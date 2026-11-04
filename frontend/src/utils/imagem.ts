/**
 * Foto do celular (3–8 MB) reduzida no próprio aparelho antes do anexo:
 * sobe rápido mesmo com 3G fraco. Qualquer falha devolve o arquivo original
 * — comprimir nunca pode impedir o envio.
 */

// Lado maior da foto depois de reduzir: ainda dá para ler etiqueta de CTO.
export const LADO_MAXIMO = 1600
// Abaixo disto não vale a pena mexer.
export const TAMANHO_MINIMO = 400 * 1024
const QUALIDADE = 0.8
const TIPOS = ['image/jpeg', 'image/png', 'image/webp']

/** Largura e altura para caber em `lado` sem distorcer (nunca amplia). */
export function dimensoesReduzidas(largura: number, altura: number, lado = LADO_MAXIMO): { largura: number; altura: number } {
  const maior = Math.max(largura, altura)
  if (maior <= lado) return { largura, altura }
  const fator = lado / maior
  return { largura: Math.round(largura * fator), altura: Math.round(altura * fator) }
}

/** Só imagem comum e grande passa pela redução (PDF, HEIC etc. vão como estão). */
export function deveComprimir(arquivo: { type: string; size: number }): boolean {
  return TIPOS.includes(arquivo.type) && arquivo.size > TAMANHO_MINIMO
}

export async function comprimirImagem(arquivo: File): Promise<File> {
  if (!deveComprimir(arquivo) || typeof createImageBitmap !== 'function') return arquivo
  try {
    // from-image: respeita a rotação gravada pela câmera (EXIF).
    const bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' })
    const { largura, altura } = dimensoesReduzidas(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = largura
    canvas.height = altura
    const contexto = canvas.getContext('2d')
    if (!contexto) return arquivo
    contexto.drawImage(bitmap, 0, 0, largura, altura)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolver) => canvas.toBlob(resolver, 'image/jpeg', QUALIDADE))
    if (!blob || blob.size >= arquivo.size) return arquivo
    const nome = arquivo.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], nome, { type: 'image/jpeg', lastModified: arquivo.lastModified })
  } catch {
    return arquivo
  }
}
