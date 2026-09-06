import { createContext } from 'react'

export type TipoToast = 'info' | 'sucesso' | 'erro'

export interface ToastContextValue {
  toast: (mensagem: string, tipo?: TipoToast) => void
}

// Isolado num arquivo à parte (sem componente nenhum aqui) pra
// ToastContext.tsx (o Provider) e useToast.ts (o hook) poderem
// compartilhar o mesmo contexto sem misturar export de componente com
// export de função/valor — essa mistura quebra o Fast Refresh do Vite.
export const ToastContext = createContext<ToastContextValue | null>(null)
