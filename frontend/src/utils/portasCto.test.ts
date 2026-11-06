import { describe, expect, it } from 'vitest'
import type { CpeDto } from '../api/client'
import { gradeDePortas, portasDaCto } from './portasCto'

const cpe = (pk: number, porta: number | null, contrato = 1, sessoes = 0, status?: number): CpeDto =>
  ({ pk, dp_port: porta, contract_status: contrato, sessions: sessoes, username: `u${pk}`, status }) as unknown as CpeDto

describe('gradeDePortas', () => {
  it('mostra todas as portas do limite com a situação de cada uma', () => {
    const portas = portasDaCto([cpe(1, 2), cpe(2, 3), cpe(3, 3), cpe(9, 4)], 5)
    const grade = gradeDePortas(portas, 5, 9)
    expect(grade.map((c) => c.situacao)).toEqual(['livre', 'ocupada', 'repetida', 'propria', 'livre'])
  })

  it('porta de contrato cancelado ou desativado fica livre, com o antigo ocupante', () => {
    const portas = portasDaCto([cpe(1, 1, 5), cpe(2, 2, 0, 1), cpe(3, 2, 0)], 3)
    expect(portas.livres).toEqual([1, 2, 3])
    const grade = gradeDePortas(portas, 3, undefined)
    expect(grade[0].anterior?.cpePk).toBe(1)
    expect(grade[1].anterior?.cpePk).toBe(2) // o que ainda está online vem primeiro
    expect(grade[2].anterior).toBeUndefined()
  })

  it('CPE habilitado de contrato cancelado prende a porta; CPE desabilitado libera', () => {
    const portas = portasDaCto([cpe(1, 1, 5, 0, 1), cpe(2, 2, 0, 0, 0), cpe(3, 3, 1, 0, 0)], 3)
    expect(portas.ocupadas.map((o) => o.porta)).toEqual([1])
    expect(portas.livres).toEqual([2, 3])
    expect(gradeDePortas(portas, 3, undefined)[0].ocupantes[0].contrato).toBe(5)
  })

  it('porta gravada acima do limite também aparece; sem limite, só as gravadas', () => {
    const portas = portasDaCto([cpe(1, 10)], 8)
    expect(gradeDePortas(portas, 8, undefined)).toHaveLength(10)
    expect(gradeDePortas(portasDaCto([cpe(1, 4)], null), null, undefined).map((c) => c.porta)).toEqual([4])
  })
})
