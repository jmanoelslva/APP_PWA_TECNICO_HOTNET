import { useContext } from 'react'
import { SessionContext, type SessionState } from './session-context'

export function useSessao(): SessionState {
  const contexto = useContext(SessionContext)
  if (!contexto) throw new Error('useSessao precisa estar dentro de <SessionProvider>')
  return contexto
}
