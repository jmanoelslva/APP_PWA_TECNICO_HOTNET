import { describe, expect, it } from 'vitest'
import { auditoriaParaCsv } from './auditoriaCsv'

describe('auditoriaParaCsv', () => {
  it('cabeçalho, BOM, separador ; e aspas quando precisa', () => {
    const csv = auditoriaParaCsv(
      [
        {
          quando: '2026-11-28 10:00:00',
          tecnico: 'joao',
          ip: '200.1.1.1',
          acao: 'os.finalizar',
          alvo: { ticket_pk: 7, motivo: 'Troca; conector' },
          local: { lat: -9.6, lng: -35.7, precisao_m: 12, idade_s: 3 },
        },
      ],
      () => 'Finalizar OS',
    )
    const [cabecalho, linha] = csv.slice(1).split('\r\n')
    expect(csv.startsWith('﻿')).toBe(true)
    expect(cabecalho).toBe('Quando;Técnico;Ação;O que mudou;Detalhes;Local;Precisão (m);IP')
    expect(linha).toBe('2026-11-28 10:00:00;joao;Finalizar OS;;"Chamado: #7 | Descrição: Troca; conector";-9.6,-35.7;12;200.1.1.1')
  })
})
