import { useEffect, useState } from 'react'

/** Estado de conectividade do navegador — reage a 'online'/'offline'. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const aoFicarOnline = () => setOnline(true)
    const aoFicarOffline = () => setOnline(false)
    window.addEventListener('online', aoFicarOnline)
    window.addEventListener('offline', aoFicarOffline)
    return () => {
      window.removeEventListener('online', aoFicarOnline)
      window.removeEventListener('offline', aoFicarOffline)
    }
  }, [])

  return online
}
