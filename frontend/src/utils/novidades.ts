/**
 * Novidades da atualização (ModalNovidades.tsx): o trecho do CHANGELOG que o
 * vite.config.ts embute no build (__NOVIDADES__), transformado em grupos
 * ("Adicionado", "Alterado"…) e itens com destaque em negrito.
 */

export interface ItemNovidade {
  /** Texto entre ** no começo do item, sem os dois-pontos finais. */
  destaque: string | null
  texto: string
}

export interface GrupoNovidade {
  titulo: string
  itens: ItemNovidade[]
}

/** Markdown do CHANGELOG (### grupo, "- item" com continuação recuada) → grupos. */
export function lerNovidades(markdown: string): GrupoNovidade[] {
  const grupos: GrupoNovidade[] = []
  let grupo: GrupoNovidade | null = null
  let linhasItem: string[] | null = null

  function fecharItem() {
    if (!grupo || !linhasItem) return
    const bruto = linhasItem.join(' ').replace(/\s+/g, ' ').trim()
    linhasItem = null
    if (!bruto) return
    const comDestaque = /^\*\*(.+?)\*\*\s*(.*)$/.exec(bruto)
    const item: ItemNovidade = comDestaque
      ? { destaque: comDestaque[1].replace(/:$/, '').trim(), texto: comDestaque[2].replace(/^:\s*/, '') }
      : { destaque: null, texto: bruto }
    item.texto = item.texto.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1')
    grupo.itens.push(item)
  }

  for (const linha of markdown.split(/\r?\n/)) {
    const titulo = /^###\s+(.+)$/.exec(linha)
    if (titulo) {
      fecharItem()
      grupo = { titulo: titulo[1].trim(), itens: [] }
      grupos.push(grupo)
      continue
    }
    const inicioItem = /^[-*]\s+(.*)$/.exec(linha)
    if (inicioItem) {
      fecharItem()
      if (!grupo) {
        grupo = { titulo: 'Novidades', itens: [] }
        grupos.push(grupo)
      }
      linhasItem = [inicioItem[1]]
      continue
    }
    if (linhasItem && linha.trim()) linhasItem.push(linha.trim())
    else fecharItem()
  }
  fecharItem()
  return grupos.filter((g) => g.itens.length > 0)
}

/** Identificador curto do texto: muda quando o trecho do CHANGELOG muda. */
export function assinaturaNovidades(texto: string): string {
  let hash = 0
  for (let i = 0; i < texto.length; i++) hash = (Math.imul(hash, 31) + texto.charCodeAt(i)) | 0
  return (hash >>> 0).toString(36)
}

const CHAVE_VISTA = 'hotnet-tecnico-novidades-vistas'

/**
 * Mostrar sozinho só depois de uma atualização: na primeira vez que o app
 * abre neste aparelho só marca como visto (quem acabou de instalar não
 * precisa da lista do que mudou).
 */
export function deveMostrarNovidades(assinatura: string): boolean {
  try {
    const vista = localStorage.getItem(CHAVE_VISTA)
    if (vista === null) {
      localStorage.setItem(CHAVE_VISTA, assinatura)
      return false
    }
    return vista !== assinatura
  } catch {
    return false
  }
}

export function marcarNovidadesVistas(assinatura: string): void {
  try {
    localStorage.setItem(CHAVE_VISTA, assinatura)
  } catch {
    // sem armazenamento: aparece de novo na próxima vez
  }
}
