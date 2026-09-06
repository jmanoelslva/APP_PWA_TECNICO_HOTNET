import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { aoExpirarSessao, buscarTecnicoAtual, login as apiLogin, logout as apiLogout } from '../api/client'
import { useToast } from '../components/Toast/useToast'
import { SessionContext, type TecnicoLogado } from './session-context'

/**
 * Estado de sessão em memória — o cookie de sessão (TECSESSION) em si é do
 * navegador, não da nossa memória, então sobrevive a um F5. Por isso, ao
 * montar, confirmamos com o backend (GET /auth/me) se a sessão ainda vale
 * antes de mandar pro login.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [logado, setLogado] = useState(false)
  const [verificando, setVerificando] = useState(true)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [tecnico, setTecnico] = useState<TecnicoLogado | null>(null)
  const { toast } = useToast()
  // Espelha "logado" num ref porque o ouvinte de sessão expirada (efeito
  // abaixo) só registra a função uma vez — sem o ref ficaria preso ao
  // "logado" (sempre false) capturado no primeiro render.
  const logadoRef = useRef(false)

  useEffect(() => {
    logadoRef.current = logado
  }, [logado])

  useEffect(() => {
    buscarTecnicoAtual()
      .then((dado) => {
        setTecnico({ username: dado.username, userPk: dado.user_pk })
        setLogado(true)
      })
      .catch(() => {
        // Sem sessão válida (401) — segue pro login normalmente.
      })
      .finally(() => setVerificando(false))
  }, [])

  const entrar = useCallback(async (usuario: string, senha: string) => {
    setCarregando(true)
    setErro(null)
    try {
      const resposta = await apiLogin(usuario.trim(), senha)
      if (resposta.success && resposta.tecnico) {
        setLogado(true)
        setTecnico({ username: resposta.tecnico.username, userPk: resposta.tecnico.user_pk })
        return true
      }
      setErro(resposta.message ?? 'Usuário ou senha incorretos.')
      return false
    } catch {
      setErro('Não foi possível conectar. Tente novamente.')
      return false
    } finally {
      setCarregando(false)
    }
  }, [])

  const sair = useCallback(async () => {
    try {
      await apiLogout()
    } finally {
      setLogado(false)
      setTecnico(null)
    }
  }, [])

  // Ouvinte global de "sessão expirada" — dispara em qualquer 401 fora de
  // /auth/login e /auth/logout (ver src/api/client.ts), vindo de qualquer
  // tela. Só reage se já havia sessão de fato nesta aba — a checagem
  // inicial (useEffect acima) também bate 401 num visitante sem cookie
  // nenhum, e isso não é "sessão expirou", é só "nunca logou".
  useEffect(() => {
    aoExpirarSessao(() => {
      if (!logadoRef.current) return
      logadoRef.current = false
      toast('Sua sessão expirou. Faça login novamente.', 'info')
      sair().catch(() => {})
    })
    return () => aoExpirarSessao(null)
  }, [sair, toast])

  return (
    <SessionContext.Provider value={{ logado, verificando, carregando, erro, tecnico, entrar, sair }}>
      {children}
    </SessionContext.Provider>
  )
}
