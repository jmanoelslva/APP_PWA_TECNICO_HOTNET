import { useCallback, useState, useSyncExternalStore } from 'react'
import { useToast } from '../components/Toast/useToast'

interface EventoInstalarPwa extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function ehIos(): boolean {
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return true
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}

function jaInstalado(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/**
 * `beforeinstallprompt` só dispara UMA VEZ por carregamento de página
 * inteiro — por isso o evento capturado vive em módulo, não em useState.
 */
let eventoCapturado: EventoInstalarPwa | null = null
let instaladoCompartilhado = typeof window === 'undefined' ? false : jaInstalado()
const ouvintesMudanca = new Set<() => void>()

function notificarMudanca() {
  ouvintesMudanca.forEach((ouvir) => ouvir())
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    eventoCapturado = e as EventoInstalarPwa
    notificarMudanca()
  })
  window.addEventListener('appinstalled', () => {
    instaladoCompartilhado = true
    eventoCapturado = null
    notificarMudanca()
  })
}

function inscrever(ouvir: () => void): () => void {
  ouvintesMudanca.add(ouvir)
  return () => ouvintesMudanca.delete(ouvir)
}

export function usePwaInstall() {
  const evento = useSyncExternalStore(inscrever, () => eventoCapturado)
  const instalado = useSyncExternalStore(inscrever, () => instaladoCompartilhado)
  const [modalIosAberto, setModalIosAberto] = useState(false)
  const { toast } = useToast()

  const podeInstalarNativo = evento != null && !instalado
  const podeInstalarIos = ehIos() && !instalado
  const podeInstalar = podeInstalarNativo || podeInstalarIos

  const instalar = useCallback(async (): Promise<'accepted' | 'dismissed' | 'indisponivel'> => {
    if (!eventoCapturado) return 'indisponivel'
    await eventoCapturado.prompt()
    const escolha = await eventoCapturado.userChoice
    eventoCapturado = null
    notificarMudanca()
    return escolha.outcome
  }, [])

  const aoClicarInstalar = useCallback(async () => {
    if (podeInstalarNativo) {
      const resultado = await instalar()
      if (resultado === 'accepted') toast('App instalado!', 'sucesso')
      return
    }
    setModalIosAberto(true)
  }, [podeInstalarNativo, instalar, toast])

  return {
    podeInstalarNativo,
    podeInstalarIos,
    podeInstalar,
    instalado,
    instalar,
    aoClicarInstalar,
    modalIosAberto,
    fecharModalIos: () => setModalIosAberto(false),
  }
}
