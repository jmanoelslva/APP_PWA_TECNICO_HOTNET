export interface PaginaBuscada<T> {
  results: T[]
  // Total bruto da origem (antes de filtros do backend). Sem ele, para na 1ª página.
  totalBruto?: number
}

/**
 * Busca página após página até cobrir o total bruto da origem.
 * O avanço usa o tamanho da página pedida, não o número de itens que voltou:
 * o backend filtra (minhas, finalizadas), então uma página pode vir menor ou vazia
 * mesmo com mais páginas pela frente. `maxPaginas` evita laço sem fim.
 */
export async function buscarTodasPaginas<T>(
  buscar: (start: number, limit: number) => Promise<PaginaBuscada<T>>,
  tamanho: number,
  maxPaginas = 20,
): Promise<T[]> {
  const todos: T[] = []
  for (let pagina = 0; pagina < maxPaginas; pagina++) {
    const start = pagina * tamanho
    const resposta = await buscar(start, tamanho)
    todos.push(...resposta.results)
    const total = resposta.totalBruto
    if (typeof total !== 'number' || start + tamanho >= total) break
  }
  return todos
}
