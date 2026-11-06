import { useEffect, useMemo, useState } from 'react'
import { LuArrowRight } from 'react-icons/lu'
import { Link } from 'react-router-dom'
import { buscarCpe, type CpeDto } from '../../api/client'
import { formatarStatusContrato } from '../../utils/formatacao'
import { gradeDePortas, ocupanteDaPorta, portasDaCto, type CasaPorta } from '../../utils/portasCto'

const SITUACAO_CONTRATO: Record<number, string> = { 0: 'contrato desativado', 5: 'contrato cancelado' }

/**
 * Grade fixa com todas as portas da CTO escolhida: livre, ocupada (cheia,
 * bolinha na cor da situação do contrato), desta conexão ou em conflito. Tocar numa livre preenche o campo; tocar
 * numa ocupada mostra quem está nela, sem mudar o campo. Porta de contrato
 * com CPE desabilitado conta como livre, com o antigo ocupante no detalhe;
 * CPE habilitado ocupa mesmo com contrato cancelado (o Controllr recusa).
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
  const [vista, setVista] = useState<number | null>(null)

  useEffect(() => {
    setConexoes(null)
    setFalhou(false)
    setVista(null)
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
  const grade = useMemo(() => (portas ? gradeDePortas(portas, limite, cpePk) : []), [portas, limite, cpePk])
  // Legenda só com as situações de contrato presentes na grade.
  const contratosNaGrade = useMemo(
    () =>
      [...new Set(grade.flatMap((casa) => (casa.ocupantes.length === 1 ? [casa.ocupantes[0].contrato ?? 1] : [])))].sort(),
    [grade],
  )

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
      {grade.length > 0 && (
        <>
          <span className="portas-cto-titulo">
            Portas{limite != null && limite > 0 && ` · ${portas.livres.length} livre${portas.livres.length === 1 ? '' : 's'} de ${limite}`}
          </span>
          <div className="portas-cto-grade">
            {grade.map((casa) => {
              const escolhida = String(casa.porta) === porta.trim()
              const rotulo =
                casa.situacao === 'livre'
                  ? `Porta ${casa.porta}, livre`
                  : `Porta ${casa.porta}, ocupada por ${casa.ocupantes.map((o) => o.usuario).join(' e ')}`
              return (
                <button
                  key={casa.porta}
                  type="button"
                  aria-label={rotulo}
                  aria-pressed={casa.situacao === 'livre' ? escolhida : vista === casa.porta}
                  className={[
                    casa.situacao,
                    escolhida ? 'escolhida' : '',
                    vista === casa.porta ? 'vista' : '',
                    casa.anterior ? 'liberada' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => {
                    if (casa.situacao === 'livre') {
                      onEscolherPorta(String(casa.porta))
                      setVista(casa.anterior ? casa.porta : null)
                    } else {
                      setVista(vista === casa.porta ? null : casa.porta)
                    }
                  }}
                >
                  {casa.porta}
                  {casa.situacao !== 'livre' && casa.ocupantes.length === 1 && (
                    <span className={`portas-cto-ponto contrato-${casa.ocupantes[0].contrato ?? 1}`} />
                  )}
                </button>
              )
            })}
          </div>
          {contratosNaGrade.length > 0 && (
            <div className="portas-cto-legenda">
              {contratosNaGrade.map((contrato) => (
                <span key={contrato}>
                  <span className={`portas-cto-ponto contrato-${contrato}`} /> {formatarStatusContrato(contrato)}
                </span>
              ))}
            </div>
          )}
          <DetalhePorta casa={grade.find((casa) => casa.porta === vista)} cpePk={cpePk} />
        </>
      )}
      {limite != null && limite > 0 && portas.livres.length === 0 && (
        <p className="portas-cto-nota">Nenhuma porta livre nas {limite} da CTO.</p>
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

function DetalhePorta({ casa, cpePk }: { casa: CasaPorta | undefined; cpePk: number | undefined }) {
  if (!casa) return <p className="portas-cto-nota">Toque numa porta ocupada para ver quem está nela.</p>
  if (casa.situacao === 'livre') {
    const anterior = casa.anterior
    if (!anterior) return null
    return (
      <p className={anterior.online ? 'portas-cto-aviso' : 'portas-cto-detalhe'} role="status">
        Porta {casa.porta} livre: antes era de <strong>{anterior.usuario}</strong>
        {anterior.cliente && ` (${anterior.cliente})`}, conexão desabilitada.
        {anterior.online && ' Essa conexão ainda está online: confira na CTO se o cabo foi retirado antes de usar.'}
      </p>
    )
  }
  return (
    <div className="portas-cto-detalhe" role="status">
      {casa.ocupantes.map((o) => (
        <span key={o.cpePk} className="item-duas-linhas">
          <strong>
            Porta {casa.porta} · {o.usuario}
          </strong>
          <small>
            {[
              o.cliente,
              o.contrato != null && SITUACAO_CONTRATO[o.contrato],
              o.online ? 'online' : 'offline',
              o.cpePk === cpePk && 'esta conexão',
            ]
              .filter(Boolean)
              .join(' · ')}
          </small>
          {o.cpePk !== cpePk && (
            // Para usar a porta, muda-se a do ocupante (ex.: contrato
            // cancelado) na própria conexão dele, como edição normal.
            <Link
              to={`/conexao?cpe_pk=${o.cpePk}&aba=cto`}
              className="botao botao-secundario botao-pequeno botao-largo portas-cto-abrir"
              viewTransition
            >
              Abrir conexão de {o.usuario} <LuArrowRight size={16} />
            </Link>
          )}
        </span>
      ))}
    </div>
  )
}
