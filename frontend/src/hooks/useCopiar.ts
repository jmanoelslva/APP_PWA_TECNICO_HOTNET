import { useToast } from '../components/Toast/useToast'

/** Copia um valor para a área de transferência e avisa com um toast ("Usuário copiado."). */
export function useCopiar() {
  const { toast } = useToast()
  return async function copiar(valor: string | undefined, rotulo: string) {
    if (!valor) return
    try {
      await navigator.clipboard.writeText(valor)
      toast(`${rotulo} copiado.`, 'sucesso')
    } catch {
      toast('Não foi possível copiar.')
    }
  }
}
