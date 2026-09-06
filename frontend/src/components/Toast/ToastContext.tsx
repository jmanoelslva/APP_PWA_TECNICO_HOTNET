import { useCallback, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type TipoToast } from './toast-context'
import './Toast.css'

interface ItemToast {
  id: number
  mensagem: string
  tipo: TipoToast
}

const DURACAO_MS = 3500

/** Toasts no estilo de app (em vez de window.alert()) — empilham no rodapé, com cor por tipo, e somem sozinhos. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [itens, setItens] = useState<ItemToast[]>([])
  const proximoId = useRef(0)

  const toast = useCallback((mensagem: string, tipo: TipoToast = 'erro') => {
    const id = proximoId.current++
    setItens((atual) => [...atual, { id, mensagem, tipo }])
    setTimeout(() => {
      setItens((atual) => atual.filter((item) => item.id !== id))
    }, DURACAO_MS)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-pilha">
        {itens.map((item) => (
          <div key={item.id} className={`toast toast-${item.tipo}`}>
            {item.mensagem}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
