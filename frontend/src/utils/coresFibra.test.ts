import { describe, expect, it } from 'vitest'
import { corMaisProxima, ocupacaoDaCto } from './coresFibra'

describe('corMaisProxima', () => {
  // Tons escolhidos à mão no painel (dados reais da HOTNET, 28/11).
  it.each([
    ['#55FF00', 'Verde'],
    ['#00FF00', 'Verde'],
    ['#0055FF', 'Azul'],
    ['#AA55FF', 'Violeta'],
    ['#ff0000', 'Vermelho'],
    ['#FF00FF', 'Rosa'],
    ['#FFFFFF', 'Branco'],
    ['#AA5500', 'Marrom'],
    ['#000000', 'Preto'],
  ])('%s → %s', (hex, nome) => {
    expect(corMaisProxima(hex)?.nome).toBe(nome)
  })
  it('sem cor ou inválida', () => {
    expect(corMaisProxima(null)).toBeNull()
    expect(corMaisProxima('azul')).toBeNull()
  })
})

describe('ocupacaoDaCto', () => {
  it('livre, pouca, lotada e sem dado', () => {
    expect(ocupacaoDaCto({ limite: 16, ativos: 12 })).toBe('livre')
    expect(ocupacaoDaCto({ limite: 8, ativos: 7 })).toBe('pouca')
    expect(ocupacaoDaCto({ limite: 8, ativos: 8 })).toBe('lotada')
    expect(ocupacaoDaCto({ limite: null, ativos: 3 })).toBe('desconhecida')
  })
})
