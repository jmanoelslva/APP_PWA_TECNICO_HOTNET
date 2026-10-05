import { describe, expect, it } from 'vitest'
import type { EventoAuditoria } from '../api/client'
import { agruparPorDia, detalhes, mudancas, tituloDia } from './auditoria'

const AGORA = new Date(2026, 9, 5, 9, 30) // segunda, 05/10/2026

function ev(quando: string): EventoAuditoria {
  return { quando, tecnico: 'joao', ip: '200.1.1.1', acao: 'onu.reiniciar', alvo: {} }
}

describe('mudancas', () => {
  it('nome da ONU: antes → depois', () => {
    expect(mudancas({ nome_anterior: 'CASA', onu_name: 'MARIA' })).toEqual([{ rotulo: 'Nome', antes: 'CASA', depois: 'MARIA' }])
  })

  it('Wi-Fi: tipo pelo nome, só quando mudou, e senha sem valor', () => {
    expect(mudancas({ wifi_tipo_anterior: 0, wifi_tipo: 2, senha_wifi_alterada: true })).toEqual([
      { rotulo: 'Criptografia', antes: 'Nenhum', depois: 'WPA' },
      { rotulo: 'Senha do Wi-Fi', depois: 'alterada', nota: 'o valor não é gravado' },
    ])
    expect(mudancas({ wifi_tipo_anterior: 2, wifi_tipo: 2, senha_wifi_alterada: false })).toEqual([
      { rotulo: 'Senha do Wi-Fi', depois: 'mantida', nota: undefined },
    ])
  })

  it('acesso ao roteador: login e porta; registro antigo só com o valor novo', () => {
    expect(mudancas({ login_anterior: 'admin', cpe_access_login: 'admin2', porta_anterior: 80, cpe_access_port: 80 })).toEqual([
      { rotulo: 'Login', antes: 'admin', depois: 'admin2' },
    ])
    expect(mudancas({ cpe_access_login: 'admin', cpe_access_port: 8080 })).toEqual([
      { rotulo: 'Login', antes: undefined, depois: 'admin' },
      { rotulo: 'Porta', antes: undefined, depois: '8080' },
    ])
  })
})

describe('associação de ONU', () => {
  const alvo = {
    onu_pk: 77, olt_pk: 1, olt_nome: 'OLT-CENTRO', porta: 2, onu_id: 3, serial: 'ZTEG1', cpe_pk: 20,
    cliente: 'Maria da Silva', pppoe: 'maria.silva', cliente_anterior: 'José Souza', pppoe_anterior: 'jose.souza',
  }

  it('cliente e PPPoE viram antes → depois, não detalhe', () => {
    expect(mudancas(alvo, 'onu.associar_cliente')).toEqual([
      { rotulo: 'Cliente', antes: 'José Souza', depois: 'Maria da Silva' },
      { rotulo: 'PPPoE', antes: 'jose.souza', depois: 'maria.silva' },
    ])
    expect(detalhes(alvo, 'onu.associar_cliente').map((d) => d.rotulo)).toEqual(['OLT', 'ONU', 'Serial'])
  })

  it('ONU nova, sem cliente antes: só o novo', () => {
    expect(mudancas({ cliente: 'Maria', pppoe: 'maria' }, 'onu.associar_cliente')).toEqual([
      { rotulo: 'Cliente', antes: undefined, depois: 'Maria' },
      { rotulo: 'PPPoE', antes: undefined, depois: 'maria' },
    ])
  })
})

describe('detalhes', () => {
  it('ONU: OLT, PON e número, serial', () => {
    expect(detalhes({ onu_pk: 55, olt_pk: 3, olt_nome: 'OLT-FLX', porta: 2, onu_id: 12, serial: 'ZTEG1' })).toEqual([
      { rotulo: 'OLT', valor: 'OLT-FLX' },
      { rotulo: 'ONU', valor: 'PON 2 · nº 12' },
      { rotulo: 'Serial', valor: 'ZTEG1' },
    ])
  })

  it('conexão: cliente e PPPoE; registro antigo cai para o número interno', () => {
    expect(detalhes({ cpe_pk: 9, cliente: 'Maria', pppoe: 'maria.silva' })).toEqual([
      { rotulo: 'Cliente', valor: 'Maria' },
      { rotulo: 'PPPoE', valor: 'maria.silva' },
    ])
    expect(detalhes({ cpe_pk: 9 })).toEqual([{ rotulo: 'Conexão', valor: '9' }])
  })
})

describe('dias', () => {
  it('títulos de hoje, ontem e outros dias', () => {
    expect(tituloDia('2026-10-05', AGORA)).toBe('Hoje · segunda, 05/10')
    expect(tituloDia('2026-10-04', AGORA)).toBe('Ontem · domingo, 04/10')
    expect(tituloDia('2026-10-02', AGORA)).toBe('Sexta, 02/10/2026')
  })

  it('agrupa mantendo a ordem do mais novo para o mais antigo', () => {
    const grupos = agruparPorDia([ev('2026-10-05 14:00:00'), ev('2026-10-05 09:00:00'), ev('2026-10-03 10:00:00')], AGORA)
    expect(grupos.map((g) => [g.dia, g.eventos.length])).toEqual([
      ['2026-10-05', 2],
      ['2026-10-03', 1],
    ])
  })
})

describe('endereço, telefone e OS', () => {
  it('lista de alterações pronta do backend vira antes → depois', () => {
    const alvo = {
      cliente: 'Maria', endereco: 'Rua B, 12 - Centro',
      alteracoes: [{ rotulo: 'Logradouro', antes: 'Rua A', depois: 'Rua B' }, { rotulo: 'Localização', depois: '-5, -42' }],
    }
    expect(mudancas(alvo, 'endereco.editar')).toEqual([
      { rotulo: 'Logradouro', antes: 'Rua A', depois: 'Rua B' },
      { rotulo: 'Localização', antes: undefined, depois: '-5, -42' },
    ])
    expect(detalhes(alvo, 'endereco.editar')).toEqual([
      { rotulo: 'Endereço', valor: 'Rua B, 12 - Centro' },
      { rotulo: 'Cliente', valor: 'Maria' },
    ])
  })

  it('telefone e OS nos detalhes; lista malformada é ignorada', () => {
    expect(detalhes({ telefone: 'Casa: 8632220000' })).toEqual([{ rotulo: 'Telefone', valor: 'Casa: 8632220000' }])
    expect(detalhes({ ticket_pk: 300, op_os_pk: 31, motivo: 'Cliente desistiu' })).toEqual([
      { rotulo: 'Chamado', valor: '#300' },
      { rotulo: 'Motivo', valor: 'Cliente desistiu' },
    ])
    expect(mudancas({ alteracoes: 'x' })).toEqual([])
    expect(mudancas({ alteracoes: [null, { rotulo: 'X' }] })).toEqual([])
  })
})
