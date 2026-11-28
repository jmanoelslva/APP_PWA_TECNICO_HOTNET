import type { EventoAuditoria } from '../api/client'
import { detalhes, mudancas } from './auditoria'

// CSV da Auditoria (o que está carregado na tela, com os filtros aplicados).
// Separador ";" e BOM: o Excel em português abre direto, com acentos.

function celula(valor: string): string {
  return /[";\n\r]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor
}

export function auditoriaParaCsv(eventos: EventoAuditoria[], rotuloDaAcao: (acao: string) => string): string {
  const cabecalho = ['Quando', 'Técnico', 'Ação', 'O que mudou', 'Detalhes', 'Local', 'Precisão (m)', 'IP']
  const linhas = eventos.map((ev) => {
    const alvo = ev.alvo ?? {}
    const mudou = mudancas(alvo, ev.acao)
      .map((m) => `${m.rotulo}: ${m.antes !== undefined ? `${m.antes} → ` : ''}${m.depois}`)
      .join(' | ')
    const det = detalhes(alvo, ev.acao)
      .map((d) => `${d.rotulo}: ${d.valor}`)
      .join(' | ')
    const local = ev.local ? `${ev.local.lat},${ev.local.lng}` : ''
    const precisao = ev.local ? String(ev.local.precisao_m) : ''
    return [ev.quando, ev.tecnico, rotuloDaAcao(ev.acao), mudou, det, local, precisao, ev.ip]
  })
  return '﻿' + [cabecalho, ...linhas].map((l) => l.map(celula).join(';')).join('\r\n')
}

/** Baixa o texto como arquivo no aparelho. */
export function baixarArquivo(nome: string, conteudo: string, tipo = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }))
  const link = document.createElement('a')
  link.href = url
  link.download = nome
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
