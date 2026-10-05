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
  // Encerra a sessão. Não mexe nos avisos de OS: continuam chegando neste
  // celular até o técnico desligar no interruptor (menu do avatar) ou outro
  // técnico entrar no aparelho (ver hooks/useAvisos.ts).
  sair: () => Promise<void>
}

// Isolado num arquivo à parte (sem componente nenhum aqui) para
// SessionContext.tsx (o Provider) e useSessao.ts (o hook) poderem
// compartilhar o mesmo contexto sem misturar export de componente com
// export de função/valor — essa mistura quebra o Fast Refresh do Vite.
export const SessionContext = createContext<SessionState | null>(null)
