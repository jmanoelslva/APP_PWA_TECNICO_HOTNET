import { describe, expect, it } from 'vitest'
import { diagnosticar, onuSemLink } from './diagnostico'

const base = { contratoStatus: 1, cpeStatus: 1 }

describe('diagnosticar', () => {
  it('contrato bloqueado vem antes de tudo', () => {
    expect(diagnosticar({ ...base, contratoStatus: 4, sessaoOnline: true }).atalho).toBe('financeiro')
  })
  it('conexão desabilitada', () => {
    expect(diagnosticar({ ...base, cpeStatus: 0, sessaoOnline: false }).titulo).toMatch(/desabilitada/)
  })
  it('sem resposta da sessão ainda: verificando', () => {
    expect(diagnosticar({ ...base, sessaoOnline: null }).gravidade).toBe('verificando')
  })
  it('online e sinal bom: ok, olhar o Wi-Fi', () => {
    const d = diagnosticar({ ...base, sessaoOnline: true, onu: { state: 'Online', rx: -19 } })
    expect(d.gravidade).toBe('ok')
    expect(d.atalho).toBe('roteador')
  })
  it('online mas caindo por perda de link', () => {
    const d = diagnosticar({
      ...base,
      sessaoOnline: true,
      onu: { rx: -20 },
      quedas: { total: 5, perdaDeLink: 3, nivel: 'atencao' },
    })
    expect(d.titulo).toBe('Online, mas caiu 5 vezes em 7 dias, 3 por perda de link')
  })
  it('sem PPPoE e ONU em LOS: fibra/energia', () => {
    const d = diagnosticar({ ...base, sessaoOnline: false, onu: { state: 'LOS', rx: null } })
    expect(d.titulo).toMatch(/ONU sem link/)
    expect(d.atalho).toBe('cto')
  })
  it('sem PPPoE, ONU com sinal bom: roteador/PPPoE', () => {
    const d = diagnosticar({ ...base, sessaoOnline: false, onu: { state: 'Working', rx: -20 } })
    expect(d.titulo).toBe('ONU com sinal, mas sem PPPoE')
  })
  it('ONU Down com dying gasp: sem energia', () => {
    const d = diagnosticar({ ...base, sessaoOnline: false, onu: { state: 'Down', ultimaQuedaMotivo: 'Dying gasp' } })
    expect(d.titulo).toBe('ONU desligada (sem energia)')
  })
  it('sem PPPoE e sem ONU vinculada', () => {
    expect(diagnosticar({ ...base, sessaoOnline: false, onu: null }).titulo).toMatch(/sem ONU vinculada/)
  })
})

describe('onuSemLink', () => {
  it.each(['LOS', 'Offline', 'DyingGasp', 'Power Off', 'link down'])('%s = sem link', (s) => {
    expect(onuSemLink(s)).toBe(true)
  })
  it.each(['Online', 'Working', 'Up', null])('%s = com link', (s) => {
    expect(onuSemLink(s)).toBe(false)
  })
})
