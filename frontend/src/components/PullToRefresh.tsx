import { useEffect, useRef, useState, type ReactNode } from 'react'
import { MdRefresh } from 'react-icons/md'
import './PullToRefresh.css'

const LIMITE_ACIONAR_PX = 64
const DISTANCIA_MAXIMA_PX = 96

interface Props {
  aoAtualizar: () => Promise<void>
  children: ReactNode
}

/**
 * Puxar a tela pra baixo com a rolagem já no topo dispara uma atualização
 * — feito na mão (sem lib): só reage quando o toque começa com a página
 * no topo, usa listener nativo (preventDefault durante o arrasto exige
 * passive:false, que o React não oferece direto pra eventos de toque).
 */
export default function PullToRefresh({ aoAtualizar, children }: Props) {
  const [distancia, setDistancia] = useState(0)
  const [arrastando, setArrastando] = useState(false)
  const [atualizando, setAtualizando] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inicioYRef = useRef<number | null>(null)
  const atualizandoRef = useRef(false)
  const aoAtualizarRef = useRef(aoAtualizar)
  useEffect(() => {
    aoAtualizarRef.current = aoAtualizar
  })

  useEffect(() => {
    const elemento = containerRef.current
    if (!elemento) return

    function aoComecar(e: TouchEvent) {
      const podeComecar = window.scrollY <= 0 && !atualizandoRef.current
      inicioYRef.current = podeComecar ? e.touches[0].clientY : null
      if (podeComecar) setArrastando(true)
    }

    function aoMover(e: TouchEvent) {
      if (inicioYRef.current == null) return
      const delta = e.touches[0].clientY - inicioYRef.current
      if (delta <= 0 || window.scrollY > 0) {
        inicioYRef.current = null
        setArrastando(false)
        setDistancia(0)
        return
      }
      e.preventDefault()
      setDistancia(Math.min(delta * 0.5, DISTANCIA_MAXIMA_PX))
    }

    function aoSoltar() {
      setArrastando(false)
      if (inicioYRef.current == null) return
      inicioYRef.current = null
      setDistancia((atual) => {
        if (atual < LIMITE_ACIONAR_PX) return 0
        atualizandoRef.current = true
        setAtualizando(true)
        navigator.serviceWorker
          ?.getRegistration()
          .then((registration) => registration?.update())
          .catch(() => {})
        aoAtualizarRef.current().finally(() => {
          atualizandoRef.current = false
          setAtualizando(false)
          setDistancia(0)
        })
        return LIMITE_ACIONAR_PX
      })
    }

    elemento.addEventListener('touchstart', aoComecar, { passive: true })
    elemento.addEventListener('touchmove', aoMover, { passive: false })
    elemento.addEventListener('touchend', aoSoltar)
    elemento.addEventListener('touchcancel', aoSoltar)
    return () => {
      elemento.removeEventListener('touchstart', aoComecar)
      elemento.removeEventListener('touchmove', aoMover)
      elemento.removeEventListener('touchend', aoSoltar)
      elemento.removeEventListener('touchcancel', aoSoltar)
    }
  }, [])

  const progresso = Math.min(distancia / LIMITE_ACIONAR_PX, 1)

  return (
    <div ref={containerRef}>
      <div
        className="pull-to-refresh-indicador"
        style={{
          height: distancia,
          opacity: progresso,
          transition: arrastando ? 'none' : 'height 0.2s ease, opacity 0.2s ease',
        }}
      >
        <MdRefresh
          size={22}
          className={atualizando ? 'pull-to-refresh-girando' : ''}
          style={atualizando ? undefined : { transform: `rotate(${progresso * 180}deg)` }}
        />
      </div>
      {children}
    </div>
  )
}
