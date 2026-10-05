import type { ReactNode } from 'react'
import { MdExpandLess, MdExpandMore } from 'react-icons/md'

/**
 * Cartão com título que abre/fecha. Acesso ao roteador, Observação e Wi-Fi
 * do CPE são usados bem menos que PPPoE/CTO/Rede — ficam recolhidos por
 * padrão pra não ocupar a tela à toa (mesmo padrão de "Contratos" em
 * DetalheCliente).
 */
export default function BlocoRecolhivel({
  titulo,
  aberto,
  onAlternar,
  children,
}: {
  titulo: string
  aberto: boolean
  onAlternar: () => void
  children: ReactNode
}) {
  return (
    <div className="conexao-card">
      <button type="button" className="conexao-card-toggle" onClick={onAlternar} aria-expanded={aberto}>
        <h2>{titulo}</h2>
        {aberto ? <MdExpandLess size={20} /> : <MdExpandMore size={20} />}
      </button>
      {aberto && children}
    </div>
  )
}
