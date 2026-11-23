import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, SessaoExpiradaError, aoExpirarSessao, buscarTecnicoAtual, login, normalizarSinalOnu } from './client'

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
// para senha errada — sempre 200 com {success:false} (ver backend). Um 401
// em QUALQUER rota (login incluso, já que o backend não usa esse status
// para credencial inválida) significa sessão ausente/expirada de verdade.
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
    mockFetchUmaVez({ status: 200, ok: true, json: { username: 'tecnico1' } })
    const resultado = await buscarTecnicoAtual()
    expect(resultado).toEqual({ username: 'tecnico1' })
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

describe('falhas de servidor e de sinal', () => {
  it('502 sem JSON (backend reiniciando) vira mensagem clara', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 502, ok: false, json: async () => { throw new SyntaxError('html') } }),
    )
    await expect(buscarTecnicoAtual()).rejects.toThrow('Servidor em atualização. Tente de novo em alguns segundos.')
  })

  it('consulta que passa do tempo-limite vira ApiError de sinal fraco', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('tempo', 'TimeoutError')))
    const erro = await buscarTecnicoAtual().catch((e: unknown) => e)
    expect(erro).toBeInstanceOf(ApiError)
    expect((erro as ApiError).message).toMatch(/sinal está fraco/)
  })

  it('outra falha de rede continua como erro de rede (fila de anexos depende disso)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const erro = await buscarTecnicoAtual().catch((e: unknown) => e)
    expect(erro).toBeInstanceOf(TypeError)
  })
})

describe('normalizarSinalOnu', () => {
  it('0 dBm vira sem leitura; leitura real fica', () => {
    const onu = normalizarSinalOnu({ omddm_rx_power: 0, olt_omddm_rx_power: -23.5 } as Parameters<typeof normalizarSinalOnu>[0])
    expect(onu.omddm_rx_power).toBeUndefined()
    expect(onu.olt_omddm_rx_power).toBe(-23.5)
  })
})
