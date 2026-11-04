/**
 * Checklist de saída da OS: o técnico marca o que conferiu antes de ir
 * embora; ao finalizar, a lista entra pronta na descrição (dá para editar).
 * Fica salva no aparelho por OS, para não perder ao sair e voltar.
 */

export interface ItemChecklist {
  chave: string
  rotulo: string
  /** Texto que vai para a descrição da finalização. */
  resumo: string
}

export const ITENS_CHECKLIST: ItemChecklist[] = [
  { chave: 'sinal', rotulo: 'Sinal da ONU conferido', resumo: 'sinal da ONU conferido' },
  { chave: 'fotos', rotulo: 'Fotos da CTO e do conector anexadas', resumo: 'fotos anexadas' },
  { chave: 'velocidade', rotulo: 'Teste de velocidade feito com o cliente', resumo: 'teste de velocidade feito' },
  { chave: 'organizado', rotulo: 'Cabos e equipamentos organizados', resumo: 'cabos e equipamentos organizados' },
]

const PREFIXO = 'hotnet-tecnico-checklist-'

export function lerChecklist(osPk: number): string[] {
  try {
    const lista = JSON.parse(localStorage.getItem(PREFIXO + osPk) ?? '[]') as unknown
    return Array.isArray(lista) ? lista.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

export function salvarChecklist(osPk: number, marcados: string[]): void {
  try {
    if (marcados.length) localStorage.setItem(PREFIXO + osPk, JSON.stringify(marcados))
    else localStorage.removeItem(PREFIXO + osPk)
  } catch {
    // sem armazenamento: vale só nesta tela
  }
}

/**
 * Linha para a descrição da finalização, na ordem da lista. Com o sinal
 * conferido e a leitura disponível, leva o valor junto.
 */
export function textoChecklist(marcados: string[], rx?: number | null): string {
  const partes = ITENS_CHECKLIST.filter((item) => marcados.includes(item.chave)).map((item) =>
    item.chave === 'sinal' && rx != null ? `${item.resumo} (${rx.toLocaleString('pt-BR')} dBm)` : item.resumo,
  )
  if (!partes.length) return ''
  const texto = partes.join('; ')
  return `Checklist: ${texto}.`
}
