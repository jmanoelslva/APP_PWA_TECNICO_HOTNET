import { useSyncExternalStore } from 'react'
import {
  definirSol,
  definirTema,
  definirTextoGrande,
  escolhaTema,
  solLigado,
  temaAtual,
  textoGrande,
  type EscolhaTema,
  type Tema,
} from '../utils/tema'

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
export function useTema(): {
  tema: Tema
  alternarTema: () => void
  escolha: EscolhaTema
  escolherTema: (escolha: EscolhaTema) => void
  sol: boolean
  alternarSol: () => void
  grande: boolean
  alternarTextoGrande: () => void
} {
  const tema = useSyncExternalStore(inscrever, temaAtual)
  const escolha = useSyncExternalStore(inscrever, escolhaTema)
  const sol = useSyncExternalStore(inscrever, solLigado)
  const grande = useSyncExternalStore(inscrever, textoGrande)

  function escolherTema(nova: EscolhaTema) {
    definirTema(nova)
    notificarMudanca()
  }

  function alternarTextoGrande() {
    definirTextoGrande(!grande)
    notificarMudanca()
  }

  function alternarTema() {
    definirTema(tema === 'dark' ? 'light' : 'dark')
    notificarMudanca()
  }

  function alternarSol() {
    definirSol(!sol)
    notificarMudanca()
  }

  return { tema, alternarTema, escolha, escolherTema, sol, alternarSol, grande, alternarTextoGrande }
}
