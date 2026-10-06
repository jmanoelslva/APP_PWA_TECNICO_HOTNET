import type { EnderecoDto, OrdemServicoDto, TelefoneDto } from '../api/client'
import { dataParaFormatoServidor, extrairTelefones, separarTelefones } from './formatacao'

export interface OsDoDia {
  os: OrdemServicoDto
  // Ver osAtrasada.
  atrasada: boolean
  // Agendada para um dia anterior a hoje (mostra a data, não só a hora).
  diaAnterior: boolean
}

/**
 * Atrasada: já passou do dia E hora agendados e o técnico ainda não iniciou
 * (OS em andamento não é atraso — ele já está nela). Fechada/cancelada não.
 */
export function osAtrasada(os: OrdemServicoDto, agora: Date = new Date()): boolean {
  if (!os.op_date_sched || os.op_date_close || os.op_date_cancel || os.etapa === 'iniciada') return false
  // Mesmo formato "AAAA-MM-DD HH:mm" dos dois lados: comparar como texto.
  return os.op_date_sched.slice(0, 16) < dataParaFormatoServidor(agora).slice(0, 16)
}

/**
 * OS do técnico que contam para "hoje": agendadas para hoje ou atrasadas
 * (dia anterior e ainda em aberto), da mais antiga para a mais nova — a
 * primeira é a "próxima OS". As de dias seguintes ficam de fora. O
 * backend já tira as finalizadas (ver ordens_servico.py::_sem_finalizadas);
 * fechada/cancelada é conferida aqui de novo por segurança.
 */
export function osDoDia(ordens: OrdemServicoDto[], agora: Date = new Date()): OsDoDia[] {
  // op_date_sched vem como "YYYY-MM-DD HH:mm:ss" (hora local do Controllr):
  // comparar só a parte da data como texto evita fuso do navegador.
  const hoje = dataParaFormatoServidor(agora).slice(0, 10)
  return ordens
    .filter((os) => !!os.op_date_sched && !os.op_date_close && !os.op_date_cancel)
    .filter((os) => os.op_date_sched!.slice(0, 10) <= hoje)
    .sort((a, b) => a.op_date_sched!.localeCompare(b.op_date_sched!))
    .map((os) => ({ os, atrasada: osAtrasada(os, agora), diaAnterior: os.op_date_sched!.slice(0, 10) < hoje }))
}

/** "HH:mm" da data agendada; para OS de dia anterior, "DD/MM HH:mm". */
export function horarioOs(item: OsDoDia): string {
  const sched = item.os.op_date_sched ?? ''
  const hora = sched.slice(11, 16)
  if (!item.diaAnterior) return hora
  const [, mes, dia] = sched.slice(0, 10).split('-')
  return `${dia}/${mes}${hora ? ` ${hora}` : ''}`
}

/**
 * Link do Google Maps já em modo rota (sai da localização atual do
 * celular). Usa as coordenadas do endereço quando houver; senão o
 * endereço escrito. null quando não há nada para onde ir.
 */
export function linkRota(endereco: EnderecoDto | null, os: OrdemServicoDto): string | null {
  let destino: string
  if (endereco?.address_latitude && endereco?.address_longitude) {
    destino = `${endereco.address_latitude},${endereco.address_longitude}`
  } else {
    const base = endereco ?? os
    const rua = [base.address, base.address_number].filter(Boolean).join(', ')
    if (!rua) return null
    destino = [rua, base.address_neighborhood, base.address_province, base.address_state].filter(Boolean).join(', ')
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}`
}

/**
 * Primeiro telefone do cliente, só com dígitos (e "+"), para o link tel:.
 * Prefere a lista de telefones cadastrados; cai para o campo client_phones
 * do cliente (mesmo formato que extrairTelefones já trata).
 */
export function primeiroTelefone(telefones: TelefoneDto[], clientPhones?: string | null): string | null {
  return telefonesDoCliente(telefones, clientPhones)[0] ?? null
}

/**
 * Todos os números do cliente, na ordem (cadastrados primeiro), separando
 * campos com mais de um número — o botão de WhatsApp usa o primeiro celular.
 */
export function telefonesDoCliente(telefones: TelefoneDto[], clientPhones?: string | null): string[] {
  const numeros = [
    ...telefones.flatMap((t) => separarTelefones(t.phone_number)),
    ...separarTelefones(extrairTelefones(clientPhones)),
  ].map((n) => n.replace(/[^\d+]/g, ''))
  return [...new Set(numeros)]
}

/** Rua, número e bairro numa linha (mesmo resumo da tela da OS). */
export function enderecoCurto(base: { address?: string; address_number?: string; address_neighborhood?: string }): string {
  return [base.address, base.address_number, base.address_neighborhood].filter(Boolean).join(', ')
}

/**
 * Quando é a OS, curto: "Hoje 09:00", "Amanhã 08:30", "Ontem 14:00" ou
 * "03/10 10:00". Atraso é com osAtrasada.
 */
export function quandoOs(sched: string | null | undefined, agora: Date = new Date()): string | null {
  if (!sched) return null
  const dia = sched.slice(0, 10)
  const hora = sched.slice(11, 16)
  const hoje = dataParaFormatoServidor(agora).slice(0, 10)
  const amanha = dataParaFormatoServidor(new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1)).slice(0, 10)
  const ontem = dataParaFormatoServidor(new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 1)).slice(0, 10)
  const [, mes, d] = dia.split('-')
  const quando = dia === hoje ? 'Hoje' : dia === amanha ? 'Amanhã' : dia === ontem ? 'Ontem' : `${d}/${mes}`
  return hora ? `${quando} ${hora}` : quando
}
