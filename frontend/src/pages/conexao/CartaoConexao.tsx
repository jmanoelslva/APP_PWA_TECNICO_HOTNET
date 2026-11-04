import type { ReactNode } from 'react'

/**
 * Cartão com título da aba Roteador (Wi-Fi, acesso ao roteador e
 * observação). Antes abria e fechava; com a aba já separando a parte do
 * roteador, fica sempre aberto.
 */
export default function CartaoConexao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="conexao-card">
      <h2>{titulo}</h2>
      {children}
    </div>
  )
}
