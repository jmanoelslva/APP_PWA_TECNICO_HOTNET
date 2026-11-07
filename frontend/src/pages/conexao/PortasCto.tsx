import { useEffect, useMemo, useState } from 'react'
import { LuArrowRight, LuUnlink } from 'react-icons/lu'
import { Link } from 'react-router-dom'
import { ApiError, atualizarDetalhesCpe, buscarCpe, type CpeDto } from '../../api/client'
import { useToast } from '../../components/Toast/useToast'
import { formatarStatusContrato } from '../../utils/formatacao'
import { gradeDePortas, ocupanteDaPorta, portasDaCto, type CasaPorta } from '../../utils/portasCto'


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
  const [recarga, setRecarga] = useState(0)

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
  }, [dpPk, recarga])

  // Porta liberada (ocupante com porta 0): relê a grade e já escolhe a porta.
  function aoLiberar(porta: number) {
    setRecarga((n) => n + 1)
    onEscolherPorta(String(porta))
  }

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
          <DetalhePorta key={vista ?? 0} casa={grade.find((casa) => casa.porta === vista)} cpePk={cpePk} onLiberada={aoLiberar} />
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

/** Contrato que não usa mais a porta: desativado ou cancelado. */
const CONTRATO_LIBERAVEL = new Set([0, 5])

function DetalhePorta({
  casa,
  cpePk,
  onLiberada,
}: {
  casa: CasaPorta | undefined
  cpePk: number | undefined
  onLiberada: (porta: number) => void
}) {
  const { toast } = useToast()
  // Dois toques: o primeiro arma, o segundo grava porta 0 no ocupante.
  const [confirmando, setConfirmando] = useState<number | null>(null)
  const [liberando, setLiberando] = useState(false)

  async function liberar(ocupante: { cpePk: number; usuario: string; porta: number }) {
    if (confirmando !== ocupante.cpePk) {
      setConfirmando(ocupante.cpePk)
      return
    }
    setLiberando(true)
    try {
      // 0 limpa CTO e porta no Controllr; relê para confirmar a CTO.
      await atualizarDetalhesCpe(ocupante.cpePk, { dp_pk: 0, cpe_dp_port: 0 })
      const relida = (await buscarCpe({ cpe_pk: ocupante.cpePk }).catch(() => null))?.results[0]
      if (relida?.dp_pk) {
        toast(`Porta ${ocupante.porta} liberada, mas a CTO continua gravada em ${ocupante.usuario}.`)
      } else {
        toast(`CTO e porta ${ocupante.porta} liberadas (limpas em ${ocupante.usuario}).`, 'sucesso')
      }
      setConfirmando(null)
      onLiberada(ocupante.porta)
    } catch (excecao) {
      toast(excecao instanceof ApiError ? excecao.message : 'Não foi possível liberar a porta.')
    } finally {
      setLiberando(false)
    }
  }

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
      {casa.ocupantes.map((o) => {
        const outra = o.cpePk !== cpePk
        const liberavel = outra && o.contrato != null && CONTRATO_LIBERAVEL.has(o.contrato)
        const armado = confirmando === o.cpePk
        return (
          <div key={o.cpePk} className="portas-cto-ocupante">
            <div className="portas-cto-ocupante-topo">
              <span className="portas-cto-numero" aria-hidden>
                {casa.porta}
              </span>
              <span className="item-duas-linhas">
                <strong>{o.usuario}</strong>
                {o.cliente && <small>{o.cliente}</small>}
              </span>
            </div>
            <div className="portas-cto-selos">
              {o.contrato != null && (
                <span className="portas-cto-selo">
                  <span className={`portas-cto-ponto contrato-${o.contrato}`} />
                  {formatarStatusContrato(o.contrato)}
                </span>
              )}
              <span className={`portas-cto-selo ${o.online ? 'online' : 'offline'}`}>
                {o.online ? 'Online' : 'Offline'}
              </span>
              {!outra && <span className="portas-cto-selo">Esta conexão</span>}
            </div>
            {armado && (
              <p className={o.online ? 'portas-cto-confirmar alerta' : 'portas-cto-confirmar'}>
                A CTO e a porta de <strong>{o.usuario}</strong> serão limpas. Toque de novo para confirmar.
                {o.online && ' Essa conexão está online: confira na CTO se o cabo foi retirado.'}
              </p>
            )}
            {outra && (
              <div className="acoes-cartao">
                {liberavel && (
                  // Contrato cancelado/desativado ainda com CPE habilitado prende a
                  // porta: grava CTO e porta 0 nele (limpa) para usá-la nesta conexão.
                  <button
                    type="button"
                    aria-busy={liberando}
                    disabled={liberando}
                    className={`botao botao-pequeno ${armado ? 'botao-perigo-cheio' : 'botao-perigo'}`}
                    onClick={() => void liberar(o)}
                  >
                    <LuUnlink size={16} />
                    {liberando ? 'Liberando…' : armado ? 'Confirmar' : `Liberar porta ${casa.porta}`}
                  </button>
                )}
                {armado ? (
                  <button type="button" className="botao botao-secundario botao-pequeno" onClick={() => setConfirmando(null)}>
                    Cancelar
                  </button>
                ) : (
                  // Para usar a porta, muda-se a do ocupante na própria conexão
                  // dele, como edição normal.
                  <Link to={`/conexao?cpe_pk=${o.cpePk}&aba=cto`} className="botao botao-secundario botao-pequeno" viewTransition>
                    Abrir conexão <LuArrowRight size={16} />
                  </Link>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
