import { beforeEach, describe, expect, it } from 'vitest'
import { assinaturaNovidades, deveMostrarNovidades, lerNovidades, marcarNovidadesVistas } from './novidades'

const TRECHO = `### Adicionado

- **Abertos recentemente:** os últimos clientes vistos
  ficam na tela inicial.
- Item sem destaque com \`código\`.

### Alterado

- **Cores:** OS e **Financeiro** mais escuros.
`

describe('lerNovidades', () => {
  it('separa grupos e junta as linhas de continuação do item', () => {
    const grupos = lerNovidades(TRECHO)
    expect(grupos.map((g) => g.titulo)).toEqual(['Adicionado', 'Alterado'])
    expect(grupos[0].itens[0]).toEqual({
      destaque: 'Abertos recentemente',
      texto: 'os últimos clientes vistos ficam na tela inicial.',
    })
  })

  it('tira negrito e crase do texto e aceita item sem destaque', () => {
    const grupos = lerNovidades(TRECHO)
    expect(grupos[0].itens[1]).toEqual({ destaque: null, texto: 'Item sem destaque com código.' })
    expect(grupos[1].itens[0].texto).toBe('OS e Financeiro mais escuros.')
  })

  it('ignora grupo vazio', () => {
    expect(lerNovidades('### Removido\n\n### Alterado\n\n- Algo.')).toEqual([
      { titulo: 'Alterado', itens: [{ destaque: null, texto: 'Algo.' }] },
    ])
  })
})

describe('deveMostrarNovidades', () => {
  beforeEach(() => localStorage.clear())

  it('primeira abertura só marca como visto', () => {
    expect(deveMostrarNovidades('a')).toBe(false)
    expect(deveMostrarNovidades('a')).toBe(false)
  })

  it('mostra quando o trecho muda, até marcar como visto', () => {
    deveMostrarNovidades('a')
    expect(deveMostrarNovidades('b')).toBe(true)
    marcarNovidadesVistas('b')
    expect(deveMostrarNovidades('b')).toBe(false)
  })

  it('assinatura muda com o texto', () => {
    expect(assinaturaNovidades('x')).not.toBe(assinaturaNovidades('y'))
  })
})
