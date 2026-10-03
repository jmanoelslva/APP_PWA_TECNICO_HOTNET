import { useCallback, useEffect, useState } from 'react'
import { ApiError, historicoOnu, lerOnuNaOlt, type HistoricoOnuDto } from '../api/client'

/**
 * Histórico da ONU no Coletor de OLTs (opcional). "indisponivel" = coletor não
 * configurado neste servidor (a tela segue só com o Controllr); "fora" = ONU
 * fora das OLTs coletadas.
 */
export type EstadoHistorico =
  | { tipo: 'carregando' }
  | { tipo: 'indisponivel' }
  | { tipo: 'fora' }
  | { tipo: 'erro'; mensagem: string }
  // agora: hora da resposta — referência do gráfico ("últimas N horas") e do "há X min".
  | { tipo: 'ok'; dados: HistoricoOnuDto; agora: number }

export function classificarErro(e: unknown): EstadoHistorico {
  if (e instanceof ApiError && e.status === 503 && /não configurado/i.test(e.message)) return { tipo: 'indisponivel' }
  if (e instanceof ApiError && e.status === 404) return { tipo: 'fora' }
  return { tipo: 'erro', mensagem: e instanceof ApiError ? e.message : 'Não foi possível carregar o histórico.' }
}

export function useHistoricoOnu(sn: string | undefined, horas: number) {
  const [estado, setEstado] = useState<EstadoHistorico>({ tipo: 'carregando' })

  useEffect(() => {
    if (!sn) return
    let cancelado = false
    historicoOnu(sn, horas)
      .then((dados) => !cancelado && setEstado({ tipo: 'ok', dados, agora: Date.now() }))
      .catch((e) => !cancelado && setEstado(classificarErro(e)))
    return () => {
      cancelado = true
    }
  }, [sn, horas])

  /** Lê só esta ONU na OLT agora (segundos, sem reconectar a OLT). */
  const lerNaOlt = useCallback(async () => {
    if (!sn) return
    const dados = await lerOnuNaOlt(sn, horas)
    setEstado({ tipo: 'ok', dados, agora: Date.now() })
  }, [sn, horas])

  // Trocou de ONU: o histórico guardado é da anterior até o novo chegar.
  const atual: EstadoHistorico = !sn
    ? { tipo: 'indisponivel' }
    : estado.tipo === 'ok' && estado.dados.onu.sn !== sn.trim().toUpperCase()
      ? { tipo: 'carregando' }
      : estado
  return { estado: atual, lerNaOlt }
}
