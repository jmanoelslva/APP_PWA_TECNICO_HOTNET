import { useSyncExternalStore } from 'react'
import { definirSol, definirTema, solLigado, temaAtual, type Tema } from '../utils/tema'

const ouvintesMudanca = new Set<() => void>()

function notificarMudanca() {
  ouvintesMudanca.forEach((ouvir) => ouvir())
}

function inscrever(ouvir: () => void): () => void {
  ouvintesMudanca.add(ouvir)
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', ouvir)
  return () => {
    ouvintesMudanca.delete(ouvir)
    mq.removeEventListener('change', ouvir)
  }
}

/** Tema efetivo atual + alternar — reativo a mudanças feitas por qualquer instância do hook. */
export function useTema(): { tema: Tema; alternarTema: () => void; sol: boolean; alternarSol: () => void } {
  const tema = useSyncExternalStore(inscrever, temaAtual)
  const sol = useSyncExternalStore(inscrever, solLigado)

  function alternarTema() {
    definirTema(tema === 'dark' ? 'light' : 'dark')
    notificarMudanca()
  }

  function alternarSol() {
    definirSol(!sol)
    notificarMudanca()
  }

  return { tema, alternarTema, sol, alternarSol }
}
