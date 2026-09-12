import { createContext } from 'react'

export interface TecnicoLogado {
  username: string
  userPk: number | null
}

export interface SessionState {
  logado: boolean
  // true só durante a checagem inicial de sessão (ver useEffect em
  // SessionContext.tsx) — enquanto isso as rotas protegidas esperam em
  // vez de já mandar para o login (ver RotaProtegida.tsx).
  verificando: boolean
  carregando: boolean
  erro: string | null
  tecnico: TecnicoLogado | null
  entrar: (usuario: string, senha: string) => Promise<boolean>
  sair: () => Promise<void>
}

// Isolado num arquivo à parte (sem componente nenhum aqui) para
// SessionContext.tsx (o Provider) e useSessao.ts (o hook) poderem
// compartilhar o mesmo contexto sem misturar export de componente com
// export de função/valor — essa mistura quebra o Fast Refresh do Vite.
export const SessionContext = createContext<SessionState | null>(null)
