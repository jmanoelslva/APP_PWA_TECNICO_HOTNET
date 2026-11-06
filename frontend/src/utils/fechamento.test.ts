import { describe, expect, it } from 'vitest'
import { verificarFechamento } from './fechamentoOs'
import { ocupanteDaPorta, portasDaCto } from './portasCto'
import { dataControllr, periodoQuedas, resumirQuedas } from './quedas'

const onuBoa = { sn: 'ZTEG1', client_pk: 7, omddm_rx_power: -19, olt_omddm_rx_power: -22 }
const cpeOk = { pk: 1, username: 'joao', dp_pk: 3, dp_name: 'CTO-1', dp_port: 4 }
const endOk = { address_latitude: '-10.9', address_longitude: '-37.0' }

describe('verificarFechamento', () => {
  it('tudo certo', () => {
    const itens = verificarFechamento({ cpe: cpeOk, onu: onuBoa, carregandoOnu: false, online: true, clientPk: 7, endereco: endOk })
    expect(itens.map((i) => i.situacao)).toEqual(['ok', 'ok', 'ok', 'ok', 'ok'])
  })

  it('ONU de outro cliente, sinal fraco, offline, sem porta e sem coordenada', () => {
    const itens = verificarFechamento({
      cpe: { ...cpeOk, dp_port: undefined },
      onu: { ...onuBoa, client_pk: 9, client_name: 'Maria', omddm_rx_power: -23 },
      carregandoOnu: false,
      online: false,
      clientPk: 7,
      endereco: { address_latitude: '0', address_longitude: '' },
    })
    const por = Object.fromEntries(itens.map((i) => [i.chave, i]))
    expect(por.onu.situacao).toBe('pendente')
    expect(por.onu.detalhe).toContain('Maria')
    expect(por.sinal.situacao).toBe('atencao')
    expect(por.pppoe.situacao).toBe('pendente')
    expect(por.cto.detalhe).toBe('CTO-1 sem porta')
    expect(por.endereco.situacao).toBe('pendente')
  })

  it('sinal crítico fica pendente; consultas em andamento', () => {
    const critico = verificarFechamento({
      cpe: cpeOk,
      onu: { ...onuBoa, olt_omddm_rx_power: -28 },
      carregandoOnu: false,
      online: null,
      clientPk: 7,
      endereco: endOk,
    })
    expect(critico[1].situacao).toBe('pendente')
    expect(critico[2].situacao).toBe('verificando')
    const carregando = verificarFechamento({ cpe: cpeOk, onu: null, carregandoOnu: true, online: true, clientPk: 7, endereco: endOk })
    expect(carregando[0].situacao).toBe('verificando')
  })
})

describe('portasDaCto', () => {
  const cpes = [
    { pk: 1, username: 'a', dp_port: 2, contract_status: 1, sessions: 1 },
    { pk: 2, username: 'b', dp_port: 2, contract_status: 4 },
    { pk: 3, username: 'c', dp_port: 5, contract_status: 5 },
    { pk: 4, username: 'd', contract_status: 1 },
  ]

  it('ocupadas, livres, repetidas e sem porta; cancelado libera', () => {
    const r = portasDaCto(cpes, 6)
    expect(r.ocupadas.map((o) => o.cpePk)).toEqual([1, 2])
    expect(r.ocupadas[0].online).toBe(true)
    expect(r.livres).toEqual([1, 3, 4, 5, 6])
    expect(r.repetidas).toEqual([2])
    expect(r.semPorta).toBe(1)
  })

  it('sem limite não lista livres', () => {
    expect(portasDaCto(cpes, null).livres).toEqual([])
  })

  it('ocupante ignora a própria conexão', () => {
    const { ocupadas } = portasDaCto(cpes, 8)
    expect(ocupanteDaPorta(ocupadas, '2', 1)?.cpePk).toBe(2)
    expect(ocupanteDaPorta(ocupadas, '3', 1)).toBeUndefined()
    expect(ocupanteDaPorta(ocupadas, '', 1)).toBeUndefined()
  })
})

describe('quedas', () => {
  it('formata data e período de 7 dias', () => {
    expect(dataControllr(new Date(2026, 10, 6, 9, 5, 3))).toBe('2026-11-06 09:05:03')
    expect(periodoQuedas(new Date(2026, 10, 8, 12, 0, 0))).toEqual({
      dataInicio: '2026-11-01 12:00:00',
      dataFim: '2026-11-08 12:00:00',
    })
  })

  it('níveis e perda de link', () => {
    expect(resumirQuedas([], 2).nivel).toBe('normal')
    expect(resumirQuedas([], 3).nivel).toBe('atencao')
    const r = resumirQuedas([{ session_terminate_cause: 2 }, { session_terminate_cause: 1 }], 12)
    expect(r).toEqual({ total: 12, perdaDeLink: 1, nivel: 'critico' })
  })
})
