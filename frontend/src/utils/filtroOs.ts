import type { OrdemServicoDto } from '../api/client'
import { dataParaFormatoServidor } from './formatacao'
import { osAtrasada } from './minhasOs'

// Filtros da tela OS / Suporte, aplicados na lista já carregada (só OS em
// aberto) — não faz chamada nova ao Controllr.

export type FiltroQuando = 'todas' | 'hoje' | 'atrasadas' | 'proximas'
export type FiltroEtapa = 'todas' | 'agendada' | 'respondida' | 'iniciada'

export interface FiltroOs {
  busca: string
  quando: FiltroQuando
  etapa: FiltroEtapa
  /** Tipo de serviço (task_name); vazio = todos. */
  tarefa: string
}

export const FILTRO_VAZIO: FiltroOs = { busca: '', quando: 'todas', etapa: 'todas', tarefa: '' }

export function filtroAtivo(filtro: FiltroOs): boolean {
  return (
    filtro.busca.trim() !== '' ||
    filtro.quando !== 'todas' ||
    filtro.etapa !== 'todas' ||
    filtro.tarefa !== ''
  )
}

/** Sem acento e em minúsculas, para "joão" achar "Joao". */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
}

function textoDaOs(os: OrdemServicoDto): string {
  return normalizar(
    [
      os.client_complete_name,
      os.address,
      os.address_number,
      os.address_neighborhood,
      os.address_province,
      os.task_name,
      os.ticket_protocol,
      os.op_number,
      os.contract_number,
      os.staff_username,
    ]
      .filter((v) => v !== undefined && v !== null)
      .join(' '),
  )
}

/** Tipos de serviço presentes na lista, em ordem alfabética (para o seletor). */
export function tarefasDaLista(ordens: OrdemServicoDto[]): string[] {
  const nomes = new Set(ordens.map((os) => os.task_name?.trim()).filter((n): n is string => !!n))
  return [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

// Sem filtro "Minhas": a ACL do Controllr já só devolve ao técnico as OS dele.
export function filtrarOs(ordens: OrdemServicoDto[], filtro: FiltroOs, agora: Date = new Date()): OrdemServicoDto[] {
  const hoje = dataParaFormatoServidor(agora).slice(0, 10)
  // Cada palavra da busca precisa aparecer em algum campo (ordem livre).
  const palavras = normalizar(filtro.busca).split(/\s+/).filter(Boolean)

  return ordens.filter((os) => {
    const dia = os.op_date_sched?.slice(0, 10) ?? ''
    if (filtro.quando === 'hoje' && dia !== hoje) return false
    if (filtro.quando === 'atrasadas' && !osAtrasada(os, agora)) return false
    if (filtro.quando === 'proximas' && !(dia > hoje)) return false
    if (filtro.etapa !== 'todas' && (os.etapa ?? 'agendada') !== filtro.etapa) return false
    if (filtro.tarefa && os.task_name?.trim() !== filtro.tarefa) return false
    if (palavras.length > 0) {
      const texto = textoDaOs(os)
      if (!palavras.every((p) => texto.includes(p))) return false
    }
    return true
  })
}
