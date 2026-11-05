import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { LuChevronRight } from 'react-icons/lu'
import './DeslizarParaConfirmar.css'

// Fração do trilho que o polegar precisa percorrer para valer.
const LIMIAR = 0.9

/**
 * Confirmação por deslizar — para ação que derruba o cliente (reiniciar,
 * remover ONU). Um toque acidental não dispara; no teclado, Enter na alça
 * confirma (gesto deliberado).
 */
export default function DeslizarParaConfirmar({
  texto,
  cor,
  desabilitado = false,
  onConfirmar,
}: {
  texto: string
  cor: string
  desabilitado?: boolean
  onConfirmar: () => void
}) {
  const trilhoRef = useRef<HTMLDivElement>(null)
  const inicioRef = useRef<{ x: number; largura: number } | null>(null)
  const [fracao, setFracao] = useState(0)
  const [arrastando, setArrastando] = useState(false)

  function aoComecar(evento: PointerEvent<HTMLButtonElement>) {
    if (desabilitado || !trilhoRef.current) return
    const alca = evento.currentTarget
    alca.setPointerCapture(evento.pointerId)
    const largura = trilhoRef.current.clientWidth - alca.offsetWidth
    inicioRef.current = { x: evento.clientX, largura: Math.max(1, largura) }
    setArrastando(true)
  }

  function aoMover(evento: PointerEvent<HTMLButtonElement>) {
    if (!inicioRef.current) return
    const delta = evento.clientX - inicioRef.current.x
    setFracao(Math.min(1, Math.max(0, delta / inicioRef.current.largura)))
  }

  function aoSoltar() {
    if (!inicioRef.current) return
    inicioRef.current = null
    setArrastando(false)
    if (fracao >= LIMIAR) {
      setFracao(1)
      onConfirmar()
    } else {
      setFracao(0)
    }
  }

  function aoTeclar(evento: KeyboardEvent<HTMLButtonElement>) {
    if (desabilitado) return
    if (evento.key === 'Enter' || evento.key === ' ') {
      evento.preventDefault()
      setFracao(1)
      onConfirmar()
    }
  }

  return (
    <div
      ref={trilhoRef}
      className={`deslizar${desabilitado ? ' deslizar-desabilitado' : ''}${arrastando ? ' deslizar-arrastando' : ''}`}
      style={{ '--deslizar-cor': cor, '--deslizar-fracao': fracao } as CSSProperties}
    >
      <span className="deslizar-preenchimento" aria-hidden="true" />
      <span className="deslizar-texto" aria-hidden="true">
        {texto}
      </span>
      <button
        type="button"
        className="deslizar-alca"
        aria-label={`${texto} (deslize para a direita ou tecle Enter)`}
        disabled={desabilitado}
        onPointerDown={aoComecar}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerCancel={aoSoltar}
        onKeyDown={aoTeclar}
      >
        <LuChevronRight size={28} />
      </button>
    </div>
  )
}
