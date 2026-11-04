import type { ReactNode } from 'react'
import { MdExpandMore } from 'react-icons/md'
import './SecaoRecolhivel.css'

/**
 * Seção que abre e fecha (details/summary nativo: teclado e leitor de tela
 * de graça). Fechada, mostra só o título e um resumo curto ("2 telefones")
 * — para as partes da tela que o técnico consulta pouco.
 */
export default function SecaoRecolhivel({
  titulo,
  resumo,
  className = '',
  abertaInicial = false,
  children,
}: {
  titulo: string
  resumo?: string
  className?: string
  abertaInicial?: boolean
  children: ReactNode
}) {
  return (
    <details className={`secao-recolhivel ${className}`} open={abertaInicial}>
      <summary className="secao-recolhivel-topo">
        <h2>{titulo}</h2>
        {resumo && <span className="secao-recolhivel-resumo">{resumo}</span>}
        <MdExpandMore size={22} className="secao-recolhivel-seta" aria-hidden="true" />
      </summary>
      <div className="secao-recolhivel-corpo">{children}</div>
    </details>
  )
}
