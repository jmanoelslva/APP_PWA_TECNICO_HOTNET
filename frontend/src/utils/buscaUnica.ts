/** Clientes abertos por último — lista da busca única (BuscaCliente.tsx). */

// Clientes abertos por último, só neste celular.
const CHAVE_RECENTES = 'hotnet-tecnico-clientes-recentes'
const MAX_RECENTES = 6

export interface ClienteRecente {
  pk: number
  nome: string
}

export function lerRecentes(): ClienteRecente[] {
  try {
    const lista = JSON.parse(localStorage.getItem(CHAVE_RECENTES) ?? '[]') as unknown
    if (!Array.isArray(lista)) return []
    return lista.filter(
      (item): item is ClienteRecente => typeof item?.pk === 'number' && typeof item?.nome === 'string',
    )
  } catch {
    return []
  }
}

export function registrarRecente(cliente: ClienteRecente): void {
  try {
    const lista = [cliente, ...lerRecentes().filter((item) => item.pk !== cliente.pk)].slice(0, MAX_RECENTES)
    localStorage.setItem(CHAVE_RECENTES, JSON.stringify(lista))
  } catch {
    // sem armazenamento: só não lembra os recentes
  }
}

export function limparRecentes(): void {
  try {
    localStorage.removeItem(CHAVE_RECENTES)
  } catch {
    // sem armazenamento
  }
}
