import { describe, expect, it } from 'vitest'
import type { OrdemServicoDto } from '../api/client'
import { FILTRO_VAZIO, filtrarOs, filtroAtivo, tarefasDaLista } from './filtroOs'

const AGORA = new Date(2026, 9, 6, 10, 0)

const ORDENS: OrdemServicoDto[] = [
  { op_pk: 1, task_name: 'Instalação', op_date_sched: '2026-10-06 08:00:00', staff_username: 'anderson', etapa: 'agendada',
    client_complete_name: 'João da Silva', address_neighborhood: 'Centro', ticket_protocol: '2026100600001' },
  { op_pk: 2, task_name: 'Suporte', op_date_sched: '2026-10-06 14:00:00', staff_username: 'Maria', etapa: 'respondida',
    client_complete_name: 'Ana Souza', address: 'Rua das Flores', address_neighborhood: 'Atalaia' },
  { op_pk: 3, task_name: 'Instalação', op_date_sched: '2026-10-07 09:00:00', staff_username: 'Anderson ', etapa: 'agendada',
    client_complete_name: 'Pedro Lima', address_neighborhood: 'Centro' },
  { op_pk: 4, task_name: 'Retirada', op_date_sched: '2026-10-05 09:00:00', staff_username: 'maria', etapa: 'iniciada',
    client_complete_name: 'Clínica São José', address_neighborhood: 'Siqueira Campos' },
]

const pks = (lista: OrdemServicoDto[]) => lista.map((o) => o.op_pk)

describe('filtro das OS', () => {
  it('sem filtro mostra todas', () => {
    expect(pks(filtrarOs(ORDENS, FILTRO_VAZIO, AGORA))).toEqual([1, 2, 3, 4])
    expect(filtroAtivo(FILTRO_VAZIO)).toBe(false)
  })

  it('quando: hoje, atrasadas e próximas', () => {
    expect(pks(filtrarOs(ORDENS, { ...FILTRO_VAZIO, quando: 'hoje' }, AGORA))).toEqual([1, 2])
    // A 4 é de ontem mas já está em andamento: não conta como atrasada.
    expect(pks(filtrarOs(ORDENS, { ...FILTRO_VAZIO, quando: 'atrasadas' }, AGORA))).toEqual([1])
    expect(pks(filtrarOs(ORDENS, { ...FILTRO_VAZIO, quando: 'proximas' }, AGORA))).toEqual([3])
  })

  it('etapa e tipo de serviço', () => {
    expect(pks(filtrarOs(ORDENS, { ...FILTRO_VAZIO, etapa: 'respondida' }, AGORA))).toEqual([2])
    expect(pks(filtrarOs(ORDENS, { ...FILTRO_VAZIO, tarefa: 'Instalação' }, AGORA))).toEqual([1, 3])
  })

  it('busca sem acento, por várias palavras e campos', () => {
    expect(pks(filtrarOs(ORDENS, { ...FILTRO_VAZIO, busca: 'joao' }, AGORA))).toEqual([1])
    expect(pks(filtrarOs(ORDENS, { ...FILTRO_VAZIO, busca: 'clinica jose' }, AGORA))).toEqual([4])
    expect(pks(filtrarOs(ORDENS, { ...FILTRO_VAZIO, busca: 'flores' }, AGORA))).toEqual([2])
    expect(pks(filtrarOs(ORDENS, { ...FILTRO_VAZIO, busca: '2026100600001' }, AGORA))).toEqual([1])
  })

  it('filtros combinados', () => {
    const filtro = { ...FILTRO_VAZIO, busca: 'centro', quando: 'hoje' as const }
    expect(pks(filtrarOs(ORDENS, filtro, AGORA))).toEqual([1])
    expect(filtroAtivo(filtro)).toBe(true)
  })

  it('lista os tipos de serviço sem repetir, em ordem', () => {
    expect(tarefasDaLista(ORDENS)).toEqual(['Instalação', 'Retirada', 'Suporte'])
  })
})
