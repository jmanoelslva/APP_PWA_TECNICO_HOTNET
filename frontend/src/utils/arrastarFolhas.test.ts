import { describe, expect, it } from 'vitest'
import { deveFechar, iniciarArrastarFolhas, LIMITE_FECHAR } from './arrastarFolhas'

// Toque sintético: o jsdom não tem o construtor Touch.
function tocar(tipo: string, alvo: Element, ys: number[]) {
  const evento = new Event(tipo, { bubbles: true }) as Event & { touches: { clientY: number }[] }
  Object.defineProperty(evento, 'touches', { value: ys.map((clientY) => ({ clientY })) })
  alvo.dispatchEvent(evento)
}

describe('arrastar a janela', () => {
  iniciarArrastarFolhas()
  document.body.innerHTML = `
    <div class="teste-fundo"><div id="janela"><p id="texto">x</p><div id="mapa" data-sem-arrastar></div></div></div>`
  const janela = document.getElementById('janela')!

  it('um dedo no conteúdo arrasta a janela', () => {
    tocar('touchstart', document.getElementById('texto')!, [100])
    tocar('touchmove', document.getElementById('texto')!, [150])
    expect(janela.style.transform).toBe('translateY(50px)')
    tocar('touchend', document.getElementById('texto')!, [])
    janela.style.transform = ''
  })

  it('no mapa (data-sem-arrastar) a janela não se move', () => {
    tocar('touchstart', document.getElementById('mapa')!, [100])
    tocar('touchmove', document.getElementById('mapa')!, [180])
    expect(janela.style.transform).toBe('')
  })

  it('pinça (segundo dedo) cancela o arrasto e volta a janela', () => {
    tocar('touchstart', document.getElementById('texto')!, [100])
    tocar('touchmove', document.getElementById('texto')!, [140])
    tocar('touchmove', document.getElementById('texto')!, [160, 220])
    expect(janela.style.transform).toBe('')
    tocar('touchmove', document.getElementById('texto')!, [200])
    expect(janela.style.transform).toBe('')
  })

  it('lista com rolagem própria já rolada: puxar para baixo rola, não arrasta', () => {
    const lista = document.createElement('div')
    const item = document.createElement('p')
    lista.appendChild(item)
    janela.appendChild(lista)
    Object.defineProperty(lista, 'scrollTop', { value: 120, configurable: true })
    tocar('touchstart', item, [100])
    tocar('touchmove', item, [180])
    expect(janela.style.transform).toBe('')
    Object.defineProperty(lista, 'scrollTop', { value: 0, configurable: true })
    tocar('touchstart', item, [100])
    tocar('touchmove', item, [150])
    expect(janela.style.transform).toBe('translateY(50px)')
    tocar('touchend', item, [])
  })
})

describe('deveFechar', () => {
  it('fecha só depois de arrastar o bastante para baixo', () => {
    expect(deveFechar(LIMITE_FECHAR)).toBe(true)
    expect(deveFechar(LIMITE_FECHAR - 1)).toBe(false)
    expect(deveFechar(0)).toBe(false)
  })
})
