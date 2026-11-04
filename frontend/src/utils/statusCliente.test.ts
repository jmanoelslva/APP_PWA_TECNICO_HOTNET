import { describe, expect, it } from 'vitest'
import { statusDoCliente, tempoDesde } from './statusCliente'
import { atalhosDaBusca, lerRecentes, registrarRecente } from './buscaUnica'

describe('statusDoCliente', () => {
  it('bloqueado vence online', () => {
    expect(statusDoCliente({ contratos: [{ contract_status: 4 }], sessoes: [true] })).toBe('bloqueado')
  })
  it('online se qualquer conexão tiver sessão', () => {
    expect(statusDoCliente({ contratos: [{ contract_status: 1 }], sessoes: [false, true] })).toBe('online')
  })
  it('offline só quando todas responderam sem sessão', () => {
    expect(statusDoCliente({ contratos: [], sessoes: [false, false] })).toBe('offline')
    expect(statusDoCliente({ contratos: [], sessoes: [false, null] })).toBe('verificando')
  })
  it('sem conexão cadastrada', () => {
    expect(statusDoCliente({ contratos: [], sessoes: [] })).toBe('sem-cpe')
    expect(statusDoCliente({ contratos: [], sessoes: [], carregando: true })).toBe('verificando')
  })
})

describe('tempoDesde', () => {
  const agora = 1_000_000_000
  it('formata as faixas', () => {
    expect(tempoDesde(agora - 5_000, agora)).toBe('agora')
    expect(tempoDesde(agora - 40_000, agora)).toBe('há 40s')
    expect(tempoDesde(agora - 125_000, agora)).toBe('há 2 min')
    expect(tempoDesde(agora - 2 * 3600_000, agora)).toBe('há 2 h')
  })
})

describe('atalhosDaBusca', () => {
  it('reconhece serial de ONU', () => {
    expect(atalhosDaBusca('fhtt9a3c21b0')).toEqual([
      { tipo: 'onu-serial', valor: 'FHTT9A3C21B0', rota: '/onu?serial=FHTT9A3C21B0' },
    ])
  })
  it('reconhece login PPPoE', () => {
    expect(atalhosDaBusca('maria.santos')[0]).toMatchObject({ tipo: 'pppoe', rota: '/conexao?username=maria.santos' })
  })
  it('nome com espaço, só dígitos ou palavra solta não geram atalho', () => {
    expect(atalhosDaBusca('Maria Santos')).toEqual([])
    expect(atalhosDaBusca('12345678900')).toEqual([])
    expect(atalhosDaBusca('maria')).toEqual([])
  })
})

describe('recentes', () => {
  it('mais recente primeiro, sem repetir', () => {
    localStorage.clear()
    registrarRecente({ pk: 1, nome: 'A' })
    registrarRecente({ pk: 2, nome: 'B' })
    registrarRecente({ pk: 1, nome: 'A' })
    expect(lerRecentes().map((c) => c.pk)).toEqual([1, 2])
  })
})
