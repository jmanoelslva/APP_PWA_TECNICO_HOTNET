import { afterEach, describe, expect, it, vi } from 'vitest'
import { mudouOSuficiente, obterMelhorLocalizacao } from './localizacao'

// ~1 m de latitude
const UM_METRO = 1 / 111320

describe('mudouOSuficiente', () => {
  const base = { lat: -9.6, lng: -36.6, precisaoM: 10 }

  it('primeira leitura sempre atualiza', () => {
    expect(mudouOSuficiente(null, base)).toBe(true)
  })

  it('tremor parado (menos de 3 m, sem ganho de precisão) não atualiza', () => {
    expect(mudouOSuficiente(base, { ...base, lat: base.lat + 2 * UM_METRO, precisaoM: 11 })).toBe(false)
  })

  it('andou 3 m ou mais atualiza', () => {
    expect(mudouOSuficiente(base, { ...base, lat: base.lat + 3.5 * UM_METRO })).toBe(true)
  })

  it('qualquer melhora de 1 m na precisão atualiza, mesmo parado', () => {
    expect(mudouOSuficiente(base, { ...base, precisaoM: 8.5 })).toBe(true)
  })

  it('piora pequena da precisão não atualiza; piora de 5 m atualiza', () => {
    expect(mudouOSuficiente(base, { ...base, precisaoM: 13 })).toBe(false)
    expect(mudouOSuficiente(base, { ...base, precisaoM: 16 })).toBe(true)
  })
})

describe('obterMelhorLocalizacao', () => {
  let aoLer: (p: GeolocationPosition) => void = () => {}
  const limpar = vi.fn()

  function leitura(accuracy: number): GeolocationPosition {
    return { coords: { latitude: -9.6, longitude: -36.6, accuracy } } as GeolocationPosition
  }

  function instalarGps() {
    vi.useFakeTimers()
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition: (sucesso: (p: GeolocationPosition) => void) => {
          aoLer = sucesso
          return 1
        },
        clearWatch: limpar,
      },
    })
  }

  afterEach(() => {
    vi.useRealTimers()
    limpar.mockClear()
  })

  it('encerra antes da janela ao atingir a precisão pedida', async () => {
    instalarGps()
    const melhorias: number[] = []
    const promessa = obterMelhorLocalizacao({ pararComPrecisaoM: 5, aoMelhorar: (p) => melhorias.push(p.coords.accuracy) })
    aoLer(leitura(20))
    aoLer(leitura(25))
    aoLer(leitura(4))
    const posicao = await promessa
    expect(posicao.coords.accuracy).toBe(4)
    expect(melhorias).toEqual([20, 4])
    expect(limpar).toHaveBeenCalledTimes(1)
  })

  it('sem limite de precisão, espera a janela e devolve a melhor leitura', async () => {
    instalarGps()
    const promessa = obterMelhorLocalizacao()
    aoLer(leitura(12))
    aoLer(leitura(3))
    aoLer(leitura(8))
    vi.advanceTimersByTime(10000)
    expect((await promessa).coords.accuracy).toBe(3)
  })
})
