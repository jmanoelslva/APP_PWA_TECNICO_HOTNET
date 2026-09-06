import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useSessao } from '../auth/useSessao'
import Spinner from './Spinner'

/** Redireciona pro login quem tentar acessar uma tela protegida sem sessão ativa. */
export default function RotaProtegida({ children }: { children: ReactNode }) {
  const { logado, verificando } = useSessao()
  // Enquanto confirma se o cookie de sessão ainda vale (ex: logo após um
  // F5), evita mandar pro login antes da hora.
  if (verificando) {
    return <Spinner tela />
  }
  if (!logado) return <Navigate to="/login" replace />
  return <>{children}</>
}
