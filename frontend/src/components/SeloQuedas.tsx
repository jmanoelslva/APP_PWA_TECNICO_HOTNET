import { useEffect, useState } from 'react'
import { LuActivity } from 'react-icons/lu'
import { buscarHistoricoSessoesCpe } from '../api/client'
import { DIAS_QUEDAS, periodoQuedas, resumirQuedas, type ResumoQuedas } from '../utils/quedas'

/**
 * "Caiu N vezes em 7 dias" — sessões encerradas no histórico do PPPoE.
 * Só aparece a partir de 3 quedas; abaixo disso, ou se a consulta falhar,
 * não mostra nada (não é um erro para o técnico).
 */
export default function SeloQuedas({ cpePk }: { cpePk: number }) {
  const [resumo, setResumo] = useState<ResumoQuedas | null>(null)

  useEffect(() => {
    let cancelado = false
    setResumo(null)
    const periodo = periodoQuedas()
    buscarHistoricoSessoesCpe(cpePk, { ...periodo, limit: 100 })
      .then((resposta) => {
        if (!cancelado) setResumo(resumirQuedas(resposta.results, resposta.total))
      })
      .catch(() => {})
    return () => {
      cancelado = true
    }
  }, [cpePk])

  if (!resumo || resumo.nivel === 'normal') return null
  return (
    <p className={`selo-quedas ${resumo.nivel}`}>
      <LuActivity size={16} aria-hidden />
      <span>
        Caiu <strong>{resumo.total} vezes</strong> em {DIAS_QUEDAS} dias
        {resumo.perdaDeLink > 0 && ` · ${resumo.perdaDeLink} por perda de link (fibra ou energia)`}
      </span>
    </p>
  )
}
