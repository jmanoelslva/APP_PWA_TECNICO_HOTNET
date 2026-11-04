import { useEffect, useState } from 'react'
import { tempoDesde } from '../utils/statusCliente'

/** "Lido há 2 min" — quanto tempo faz que o app leu o dado; atualiza sozinho a cada 15 s. */
export default function LidoHa({ momento, prefixo = 'Lido' }: { momento: number | null; prefixo?: string }) {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    const intervalo = setInterval(() => setAgora(Date.now()), 15_000)
    return () => clearInterval(intervalo)
  }, [])
  if (momento == null) return null
  return (
    <span className="lido-ha">
      {prefixo} {tempoDesde(momento, Math.max(agora, momento))}
    </span>
  )
}
