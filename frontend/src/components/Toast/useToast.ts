import { useContext } from 'react'
import { ToastContext, type ToastContextValue } from './toast-context'

export function useToast(): ToastContextValue {
  const contexto = useContext(ToastContext)
  if (!contexto) throw new Error('useToast precisa estar dentro de <ToastProvider>')
  return contexto
}
