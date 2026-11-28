import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useOnline } from '../hooks/useOnline'
import { EVENTO_FILA, EVENTO_FILA_MUDOU, contarFila } from '../utils/filaAnexos'
import './StatusBanners.css'

/** Anexos aguardando envio, recontados a cada entrada/saída da fila. */
function useAnexosNaFila(): number {
  const [quantidade, setQuantidade] = useState(0)
  useEffect(() => {
    const recontar = () => void contarFila().then(setQuantidade)
    recontar()
    window.addEventListener(EVENTO_FILA, recontar)
    window.addEventListener(EVENTO_FILA_MUDOU, recontar)
    return () => {
      window.removeEventListener(EVENTO_FILA, recontar)
      window.removeEventListener(EVENTO_FILA_MUDOU, recontar)
    }
  }, [])
  return quantidade
}

function textoFila(n: number): string {
  return n === 1 ? '1 anexo aguardando envio' : `${n} anexos aguardando envio`
}

/** Faixa fixa no topo: sem internet (e anexos na fila), ou versão nova do app disponível. */
export default function StatusBanners() {
  const online = useOnline()
  const naFila = useAnexosNaFila()
  const {
    needRefresh: [precisaAtualizar],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      // O navegador só checa sw.js sozinho a cada navegação, no máximo 1x
      // a cada ~24h — registration.update() ignora esse limite, chamado
      // ao registrar e sempre que o app volta a primeiro plano.
      registration.update()
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update()
      })
    },
  })

  if (!online) {
    return (
      <div className="status-banner status-banner-offline" role="status">
        Sem conexão com a internet{naFila > 0 && ` · ${textoFila(naFila)}`}
      </div>
    )
  }

  if (naFila > 0) {
    return (
      <div className="status-banner status-banner-fila" role="status">
        {textoFila(naFila)}
      </div>
    )
  }

  if (precisaAtualizar) {
    return (
      <div className="status-banner status-banner-atualizar">
        <span>Nova versão disponível</span>
        <button onClick={() => updateServiceWorker(true)}>Atualizar</button>
      </div>
    )
  }

  return null
}
