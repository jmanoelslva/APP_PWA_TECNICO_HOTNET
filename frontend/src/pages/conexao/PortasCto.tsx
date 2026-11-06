import { useEffect, useMemo, useState } from 'react'
import { buscarCpe, type CpeDto } from '../../api/client'
import { ocupanteDaPorta, portasDaCto } from '../../utils/portasCto'

/**
 * Portas livres e ocupadas da CTO escolhida, pelas conexões gravadas nela.
 * Tocar numa porta livre preenche o campo; porta já usada por outra
 * conexão gera aviso antes de salvar.
 */
export default function PortasCto({
  dpPk,
  limite,
  porta,
  cpePk,
  onEscolherPorta,
}: {
  dpPk: number | null
  limite: number | null | undefined
  porta: string
  cpePk: number | undefined
  onEscolherPorta: (porta: string) => void
}) {
  const [conexoes, setConexoes] = useState<CpeDto[] | null>(null)
  const [falhou, setFalhou] = useState(false)

  useEffect(() => {
    setConexoes(null)
    setFalhou(false)
    if (dpPk == null) return
    let cancelado = false
    buscarCpe({ dp_pk: dpPk })
      .then((resposta) => {
        if (!cancelado) setConexoes(resposta.results)
      })
      .catch(() => {
        if (!cancelado) setFalhou(true)
      })
    return () => {
      cancelado = true
    }
  }, [dpPk])

  const portas = useMemo(() => (conexoes ? portasDaCto(conexoes, limite) : null), [conexoes, limite])

  if (dpPk == null) return null
  if (falhou) return <p className="portas-cto-nota">Não foi possível consultar as portas desta CTO.</p>
  if (!portas) return <p className="portas-cto-nota">Consultando portas…</p>

  const ocupante = ocupanteDaPorta(portas.ocupadas, porta, cpePk)

  return (
    <div className="portas-cto">
      {ocupante && (
        <p className="portas-cto-aviso" role="alert">
          A porta {ocupante.porta} já está gravada para <strong>{ocupante.usuario}</strong>
          {ocupante.cliente && ` (${ocupante.cliente})`}.
        </p>
      )}
      {portas.livres.length > 0 && (
        <>
          <span className="portas-cto-titulo">Livres</span>
          <div className="portas-cto-livres">
            {portas.livres.map((livre) => (
              <button
                key={livre}
                type="button"
                className={String(livre) === porta.trim() ? 'escolhida' : undefined}
                onClick={() => onEscolherPorta(String(livre))}
              >
                {livre}
              </button>
            ))}
          </div>
        </>
      )}
      {limite != null && limite > 0 && portas.livres.length === 0 && (
        <p className="portas-cto-nota">Nenhuma porta livre nas {limite} da CTO.</p>
      )}
      {portas.ocupadas.length > 0 && (
        <>
          <span className="portas-cto-titulo">Ocupadas</span>
          <ul className="portas-cto-ocupadas">
            {portas.ocupadas.map((item) => (
              <li
                key={`${item.porta}-${item.cpePk}`}
                className={[
                  item.cpePk === cpePk ? 'propria' : '',
                  portas.repetidas.includes(item.porta) ? 'repetida' : '',
                ]
                  .filter(Boolean)
                  .join(' ') || undefined}
              >
                <span className="portas-cto-numero">{item.porta}</span>
                <span className="item-duas-linhas">
                  <strong>{item.usuario}</strong>
                  <small>
                    {[item.cliente, item.online ? 'online' : 'offline', item.cpePk === cpePk && 'esta conexão']
                      .filter(Boolean)
                      .join(' · ')}
                  </small>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {portas.repetidas.length > 0 && (
        <p className="portas-cto-nota">Porta com mais de uma conexão: {portas.repetidas.join(', ')}.</p>
      )}
      {portas.semPorta > 0 && (
        <p className="portas-cto-nota">
          {portas.semPorta === 1 ? '1 conexão nesta CTO está' : `${portas.semPorta} conexões nesta CTO estão`} sem porta
          gravada.
        </p>
      )}
    </div>
  )
}
