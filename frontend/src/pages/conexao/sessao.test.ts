import { describe, expect, it } from 'vitest'
import { camposSessao, formatarBytes, formatarDuracaoSegundos, rotuloEncerramento } from './sessao'

describe('sessão online', () => {
  it('bytes, duração e motivo de encerramento', () => {
    expect(formatarBytes(512)).toBe('512 B')
    expect(formatarBytes(10 * 1024 ** 3)).toBe('10.0 GB')
    expect(formatarDuracaoSegundos(3600)).toBe('1h 0min')
    expect(formatarDuracaoSegundos(200000)).toBe('02d 07h 33m')
    expect(rotuloEncerramento(2)).toBe('Lost Carrier')
    expect(rotuloEncerramento(0)).toBe('—')
    expect(rotuloEncerramento(7)).toBe('Código 7')
  })

  it('campos da sessão: consumo aninhado em KB, ordem fixa, vazios fora', () => {
    const campos = camposSessao({
      SESSION_USERNAME: 'maria', session_v4_ip: '100.64.1.20', session_v6_px: '',
      stats: { total: { rx_byte: 512, tx_byte: 1024 } },
    })
    expect(campos).toEqual([
      ['Usuário PPPoE', 'maria'],
      ['IPv4', '100.64.1.20'],
      ['Consumo (download)', '1.00 MB'],
      ['Consumo (upload)', '512.0 KB'],
    ])
    expect(camposSessao(null)).toEqual([])
  })
})
