import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LuArrowRight, LuCircleAlert, LuCircleCheck, LuLoaderCircle, LuTriangleAlert } from 'react-icons/lu'
import { buscarHistoricoSessoesCpe, type CpeDto, type OnuDto } from '../../api/client'
import { diagnosticar, type Diagnostico } from '../../utils/diagnostico'
import { periodoQuedas, resumirQuedas, type ResumoQuedas } from '../../utils/quedas'

const ICONE = {
  ok: LuCircleCheck,
  atencao: LuTriangleAlert,
  problema: LuCircleAlert,
  verificando: LuLoaderCircle,
} as const

const ROTULO_ATALHO: Record<NonNullable<Diagnostico['atalho']>, string> = {
  financeiro: 'Ver financeiro',
  onu: 'Abrir a ONU',
  cto: 'Ver a CTO',
  roteador: 'Ver o roteador',
  historico: 'Ver as quedas',
}

/**
 * "Por que está sem internet?" no topo do Resumo: um veredito com o
 * próximo passo (regra em utils/diagnostico.ts) e um atalho para ele.
 */
export default function CardDiagnostico({
  cpe,
  sessao,
  onu,
  carregandoOnu,
  onAba,
}: {
  cpe: CpeDto
  sessao: Record<string, unknown> | null
  onu: OnuDto | null
  carregandoOnu: boolean
  onAba: (aba: 'roteador' | 'cto' | 'historico') => void
}) {
  const [quedas, setQuedas] = useState<ResumoQuedas | null>(null)

  useEffect(() => {
    if (cpe.pk == null) return
    let cancelado = false
    setQuedas(null)
    buscarHistoricoSessoesCpe(cpe.pk, { ...periodoQuedas(), limit: 100 })
      .then((r) => !cancelado && setQuedas(resumirQuedas(r.results, r.total)))
      .catch(() => {})
    return () => {
      cancelado = true
    }
  }, [cpe.pk])

  const d = diagnosticar({
    contratoStatus: cpe.contract_status,
    cpeStatus: cpe.status,
    // {} = consultou e não há sessão; null = consultando ou falhou.
    sessaoOnline: sessao == null ? null : Object.keys(sessao).length > 0,
    onu: carregandoOnu
      ? undefined
      : onu && { state: onu.state, rx: onu.omddm_rx_power, ultimaQuedaMotivo: onu.last_down_reason },
    quedas,
  })
  const Icone = ICONE[d.gravidade]

  let atalho = null
  if (d.atalho === 'financeiro' && cpe.client_pk) {
    atalho = (
      <Link className="diagnostico-atalho" to={`/financeiro?client_pk=${cpe.client_pk}`} viewTransition>
        {ROTULO_ATALHO.financeiro} <LuArrowRight size={16} />
      </Link>
    )
  } else if (d.atalho === 'onu' && cpe.username) {
    atalho = (
      <Link className="diagnostico-atalho" to={`/onu?username=${encodeURIComponent(cpe.username)}&aba=sinal`} viewTransition>
        {ROTULO_ATALHO.onu} <LuArrowRight size={16} />
      </Link>
    )
  } else if (d.atalho === 'roteador' || d.atalho === 'cto' || d.atalho === 'historico') {
    const aba = d.atalho
    atalho = (
      <button type="button" className="diagnostico-atalho" onClick={() => onAba(aba)}>
        {ROTULO_ATALHO[aba]} <LuArrowRight size={16} />
      </button>
    )
  }

  return (
    <div className={`conexao-card diagnostico diagnostico-${d.gravidade}`} aria-live="polite">
      <div className="diagnostico-topo">
        <Icone size={22} aria-hidden className={d.gravidade === 'verificando' ? 'diagnostico-girando' : undefined} />
        <strong>{d.titulo}</strong>
      </div>
      <p className="diagnostico-passo">{d.passo}</p>
      {atalho}
    </div>
  )
}
