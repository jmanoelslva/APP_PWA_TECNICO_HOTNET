import { useRegisterSW } from 'virtual:pwa-register/react'
import { useOnline } from '../hooks/useOnline'
import './StatusBanners.css'

/** Faixa fixa no topo: sem internet, ou versão nova do app disponível. */
export default function StatusBanners() {
  const online = useOnline()
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
    return <div className="status-banner status-banner-offline">Sem conexão com a internet</div>
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
