import { describe, expect, it, vi } from 'vitest'
import { buscarTodasPaginas } from './paginacao'

describe('buscarTodasPaginas', () => {
  it('busca até cobrir o total bruto, mesmo com página filtrada vazia', async () => {
    const paginas = [[1, 2], [], [3]]
    const buscar = vi.fn(async (start: number) => ({ results: paginas[start / 100], totalBruto: 250 }))
    expect(await buscarTodasPaginas(buscar, 100)).toEqual([1, 2, 3])
    expect(buscar.mock.calls.map((c) => c[0])).toEqual([0, 100, 200])
  })

  it('para na primeira página quando o total cabe nela ou não veio', async () => {
    const comTotal = vi.fn(async () => ({ results: [1], totalBruto: 100 }))
    expect(await buscarTodasPaginas(comTotal, 100)).toEqual([1])
    const semTotal = vi.fn(async () => ({ results: [1] }))
    expect(await buscarTodasPaginas(semTotal, 100)).toEqual([1])
    expect(comTotal).toHaveBeenCalledTimes(1)
    expect(semTotal).toHaveBeenCalledTimes(1)
  })

  it('respeita o máximo de páginas', async () => {
    const buscar = vi.fn(async () => ({ results: [0], totalBruto: 1_000_000 }))
    expect(await buscarTodasPaginas(buscar, 100, 3)).toHaveLength(3)
  })
})
