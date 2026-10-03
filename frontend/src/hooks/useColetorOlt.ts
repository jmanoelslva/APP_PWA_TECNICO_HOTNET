import { useEffect, useState } from 'react'

/**
 * O Coletor de OLTs (projeto COLETA-OLT) é opcional: quando instalado no
 * mesmo servidor, fica em /olt/ e responde /olt/api/saude sem login. Sem ele,
 * /olt/ cai no próprio index.html do técnico (ou 404) — por isso confere o
 * JSON, e não só o status, antes de mostrar o menu "OLTs".
 */
export function useColetorOlt(): boolean {
  const [disponivel, setDisponivel] = useState(false)

  useEffect(() => {
    const controle = new AbortController()
    const limite = setTimeout(() => controle.abort(), 5000)
    fetch('/olt/api/saude', { credentials: 'same-origin', cache: 'no-store', signal: controle.signal })
      .then(async (resposta) => {
        if (!resposta.ok || !resposta.headers.get('content-type')?.includes('application/json')) return
        const corpo = (await resposta.json()) as { app?: string }
        setDisponivel(corpo.app === 'coletor-olt')
      })
      .catch(() => setDisponivel(false))
      .finally(() => clearTimeout(limite))
    return () => {
      clearTimeout(limite)
      controle.abort()
    }
  }, [])

  return disponivel
}
