import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, SessaoExpiradaError, aoExpirarSessao, buscarTecnicoAtual, login } from './client'

function mockFetchUmaVez(resposta: { status: number; ok: boolean; json: unknown }) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      status: resposta.status,
      ok: resposta.ok,
      json: async () => resposta.json,
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  aoExpirarSessao(null)
})

// Diferente do Controllr direto, aqui POST /auth/login nunca devolve 401
// pra senha errada — sempre 200 com {success:false} (ver backend). Um 401
// em QUALQUER rota (login incluso, já que o backend não usa esse status
// pra credencial inválida) significa sessão ausente/expirada de verdade.
describe('login — nunca trata credencial errada como sessão expirada', () => {
  it('resposta 200 com success:false é só falha de login normal', async () => {
    mockFetchUmaVez({ status: 200, ok: true, json: { success: false, message: 'Usuário ou senha incorretos.' } })
    const resultado = await login('tecnico', 'senha-errada')
    expect(resultado).toEqual({ success: false, message: 'Usuário ou senha incorretos.' })
  })
})

describe('get/post — tratamento de 401', () => {
  it('401 em qualquer rota autenticada lança SessaoExpiradaError', async () => {
    mockFetchUmaVez({ status: 401, ok: false, json: { detail: 'Sessão expirada ou inexistente.' } })
    await expect(buscarTecnicoAtual()).rejects.toBeInstanceOf(SessaoExpiradaError)
  })

  it('erro comum (não 401) lança ApiError com o detail do backend', async () => {
    mockFetchUmaVez({ status: 400, ok: false, json: { detail: 'Não foi possível buscar o cliente.' } })
    await expect(buscarTecnicoAtual()).rejects.toThrow(ApiError)
    mockFetchUmaVez({ status: 400, ok: false, json: { detail: 'Não foi possível buscar o cliente.' } })
    await expect(buscarTecnicoAtual()).rejects.toThrow('Não foi possível buscar o cliente.')
  })

  it('resposta de sucesso normal é devolvida sem lançar nada', async () => {
    mockFetchUmaVez({ status: 200, ok: true, json: { username: 'tecnico1', user_pk: 9 } })
    const resultado = await buscarTecnicoAtual()
    expect(resultado).toEqual({ username: 'tecnico1', user_pk: 9 })
  })
})

describe('get/post — ouvinte global de sessão expirada (aoExpirarSessao)', () => {
  it('é chamado quando um 401 acontece', async () => {
    const ouvinte = vi.fn()
    aoExpirarSessao(ouvinte)
    mockFetchUmaVez({ status: 401, ok: false, json: { detail: 'Sessão expirada.' } })
    await expect(buscarTecnicoAtual()).rejects.toBeInstanceOf(SessaoExpiradaError)
    expect(ouvinte).toHaveBeenCalledTimes(1)
  })

  it('NÃO é chamado numa resposta de login com success:false', async () => {
    const ouvinte = vi.fn()
    aoExpirarSessao(ouvinte)
    mockFetchUmaVez({ status: 200, ok: true, json: { success: false, message: 'Usuário ou senha incorretos.' } })
    await login('tecnico', 'senha-errada')
    expect(ouvinte).not.toHaveBeenCalled()
  })
})
