import { describe, expect, it } from 'vitest'
import { permiteMenuContexto } from './menuContexto'

describe('menu de contexto', () => {
  it('só nos campos de entrada', () => {
    document.body.innerHTML = `
      <a id="link" href="/os"><span id="dentro">OS</span></a>
      <button id="botao">Rota</button>
      <input id="campo" />
      <textarea id="texto"></textarea>
      <div contenteditable="true"><b id="editavel">x</b></div>
      <div contenteditable="false"><b id="travado">x</b></div>`
    const el = (id: string) => document.getElementById(id)
    expect(permiteMenuContexto(el('link'))).toBe(false)
    expect(permiteMenuContexto(el('dentro'))).toBe(false)
    expect(permiteMenuContexto(el('botao'))).toBe(false)
    expect(permiteMenuContexto(el('campo'))).toBe(true)
    expect(permiteMenuContexto(el('texto'))).toBe(true)
    expect(permiteMenuContexto(el('editavel'))).toBe(true)
    expect(permiteMenuContexto(el('travado'))).toBe(false)
    expect(permiteMenuContexto(null)).toBe(false)
  })
})
