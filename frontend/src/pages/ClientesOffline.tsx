import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { MdSearch } from 'react-icons/md'
import { LuCable, LuMap, LuNetwork, LuPhone, LuSearchX, LuTriangleAlert, LuUser, LuWifiOff, LuX } from 'react-icons/lu'
import { ApiError, buscarDetalheCliente, listarCpeOffline, listarDps, type CpeDto, type DpDto } from '../api/client'
import CabecalhoTela from '../components/CabecalhoTela'
import EstadoVazio from '../components/EstadoVazio'
import EstadoErro from '../components/EstadoErro'
import PullToRefresh from '../components/PullToRefresh'
import Skeleton from '../components/Skeleton'
import { useToast } from '../components/Toast/useToast'
import { CORES } from '../utils/cores'
import { formatarDataHora, linkLigar } from '../utils/formatacao'
import { primeiroTelefone } from '../utils/minhasOs'
import {
  ORDEM_GRUPOS,
  ROTULO_GRUPO,
  ctosComVariosOffline,
  grupoOffline,
  instanteDaQueda,
  regiaoDaCto,
  tempoOffline,
  type GrupoOffline,
} from '../utils/offline'
import './ClientesOffline.css'

// A tela agrupa a lista inteira (tempo offline e CTO), então carrega em
// páginas grandes: normalmente uma ida só.
const TAMANHO_PAGINA = 200

type Periodo = 'todos' | GrupoOffline

interface ItemOffline {
  cpe: CpeDto
  instante: number | null
  grupo: GrupoOffline
  regiao: string
}

function normalizar(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

function bateBusca(cpe: CpeDto, termo: string): boolean {
  const alvo = [cpe.client_complete_name, cpe.username, cpe.dp_name, cpe.contract_number, cpe.contract_pk]
    .filter((v) => v != null)
    .map((v) => normalizar(String(v)))
  return alvo.some((v) => v.includes(termo))
}

function horaAgora(): string {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function ClientesOffline() {
  const { toast } = useToast()
  const [cpes, setCpes] = useState<CpeDto[]>([])
  const [carregando, setCarregando] = useState(true)
  const [carregandoMais, setCarregandoMais] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [atualizadoAs, setAtualizadoAs] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [periodo, setPeriodo] = useState<Periodo>('todos')
  const [regiao, setRegiao] = useState('')
  const [ctoFiltro, setCtoFiltro] = useState<{ pk: number; nome: string } | null>(null)
  // CTOs do Controllr: setor (região) e cor de cada uma. Complemento — se
  // falhar, a região sai da sigla do nome da CTO.
  const [dpsPorPk, setDpsPorPk] = useState<Map<number, DpDto>>(new Map())
  const [ligandoPk, setLigandoPk] = useState<number | null>(null)

  useEffect(() => {
    carregar()
    listarDps()
      .then((resposta) => setDpsPorPk(new Map(resposta.results.map((dp) => [dp.pk, dp]))))
      .catch(() => {})
  }, [])

  // Busca só filtra o que a lista já tem; o resto chega sozinho em segundo plano.
  useEffect(() => {
    if (carregando || carregandoMais || erro) return
    if (cpes.length < total) carregarMais()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregando, carregandoMais, cpes.length, total, erro])

  async function carregar() {
    setCarregando(true)
    setErro(null)
    try {
      const resposta = await listarCpeOffline({ start: 0, limit: TAMANHO_PAGINA })
      setCpes(resposta.results)
      setTotal(resposta.total)
      setAtualizadoAs(horaAgora())
    } catch (excecao) {
      setErro(excecao instanceof ApiError ? excecao.message : 'Não foi possível carregar os clientes offline.')
    } finally {
      setCarregando(false)
    }
  }

  async function carregarMais() {
    setCarregandoMais(true)
    try {
      const resposta = await listarCpeOffline({ start: cpes.length, limit: TAMANHO_PAGINA })
      setCpes((atual) => [...atual, ...resposta.results])
      setTotal(resposta.total)
    } catch (excecao) {
      // Falhar aqui não apaga a lista já carregada — só avisa e para de
      // buscar mais sozinho (puxar para atualizar recomeça).
      setErro(excecao instanceof ApiError ? excecao.message : 'Não foi possível carregar mais clientes.')
    } finally {
      setCarregandoMais(false)
    }
  }

  async function ligar(cpe: CpeDto) {
    if (!cpe.client_pk || ligandoPk != null) return
    setLigandoPk(cpe.client_pk)
    try {
      const detalhe = await buscarDetalheCliente(cpe.client_pk)
      const link = linkLigar(primeiroTelefone(detalhe.telefones, detalhe.cliente.client_phones))
      if (link) window.location.href = link
      else toast('Cliente sem telefone cadastrado.')
    } catch (excecao) {
      toast(excecao instanceof ApiError ? excecao.message : 'Não foi possível buscar o telefone.')
    } finally {
      setLigandoPk(null)
    }
  }

  // Todos os itens com grupo e região, do que caiu mais recente para o mais
  // antigo; "nunca conectou" no fim.
  const itens = useMemo<ItemOffline[]>(() => {
    const agora = Date.now()
    return cpes
      .map((cpe) => {
        const instante = instanteDaQueda(cpe)
        const dp = cpe.dp_pk != null ? dpsPorPk.get(cpe.dp_pk) : undefined
        return { cpe, instante, grupo: grupoOffline(instante, agora), regiao: regiaoDaCto(cpe.dp_name, dp?.setor) }
      })
      .sort((a, b) => (b.instante ?? -Infinity) - (a.instante ?? -Infinity))
  }, [cpes, dpsPorPk])

  const ctosVarios = useMemo(() => ctosComVariosOffline(cpes), [cpes])
  const offlinePorCto = useMemo(() => new Map(ctosVarios.map((cto) => [cto.dpPk, cto.quantidade])), [ctosVarios])
  const regioes = useMemo(() => {
    const contagem = new Map<string, number>()
    for (const item of itens) contagem.set(item.regiao, (contagem.get(item.regiao) ?? 0) + 1)
    return [...contagem.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
  }, [itens])

  const termoBusca = normalizar(busca.trim())
  // Busca, região e CTO valem para tudo; o período só escolhe o grupo.
  const filtrados = useMemo(
    () =>
      itens.filter(
        (item) =>
          (!termoBusca || bateBusca(item.cpe, termoBusca)) &&
          (!regiao || item.regiao === regiao) &&
          (!ctoFiltro || item.cpe.dp_pk === ctoFiltro.pk),
      ),
    [itens, termoBusca, regiao, ctoFiltro],
  )
  const porGrupo = useMemo(() => {
    const mapa = new Map<GrupoOffline, ItemOffline[]>(ORDEM_GRUPOS.map((g) => [g, []]))
    for (const item of filtrados) mapa.get(item.grupo)!.push(item)
    return mapa
  }, [filtrados])

  const abasPeriodo: { chave: Periodo; rotulo: string }[] = [
    { chave: 'todos', rotulo: `Todos (${filtrados.length})` },
    { chave: 'hoje', rotulo: `Hoje (${porGrupo.get('hoje')!.length})` },
    { chave: 'semana', rotulo: `1 a 7 dias (${porGrupo.get('semana')!.length})` },
    { chave: 'antigos', rotulo: `+7 dias (${porGrupo.get('antigos')!.length})` },
    { chave: 'nunca', rotulo: `Nunca (${porGrupo.get('nunca')!.length})` },
  ]
  const gruposVisiveis = periodo === 'todos' ? ORDEM_GRUPOS : [periodo]
  const visiveis = gruposVisiveis.reduce((soma, g) => soma + porGrupo.get(g)!.length, 0)
  const aindaCarregandoLista = cpes.length < total
  const filtroAtivo = Boolean(termoBusca || regiao || ctoFiltro || periodo !== 'todos')

  function limparFiltros() {
    setBusca('')
    setRegiao('')
    setCtoFiltro(null)
    setPeriodo('todos')
  }

  function cartao({ cpe, instante }: ItemOffline) {
    const dp = cpe.dp_pk != null ? dpsPorPk.get(cpe.dp_pk) : undefined
    const nestaCto = cpe.dp_pk != null ? offlinePorCto.get(cpe.dp_pk) : undefined
    return (
      <li key={cpe.pk} className="clientes-offline-card">
        <div className="clientes-offline-topo">
          <strong>{cpe.client_complete_name ?? cpe.username ?? `CPE #${cpe.pk}`}</strong>
          <span className="clientes-offline-tempo">{tempoOffline(instante)}</span>
        </div>
        {instante != null && (
          <p className="clientes-offline-ultima">Última conexão: {formatarDataHora(cpe.date_acct || cpe.date_auth)}</p>
        )}
        {cpe.dp_name ? (
          <div className="clientes-offline-cto">
            <i style={{ background: dp?.cor || '#555555' }} aria-hidden="true" />
            <span>
              {cpe.dp_name}
              {cpe.dp_port != null && ` · porta ${cpe.dp_port}`}
            </span>
            {nestaCto && <em className="clientes-offline-selo">{nestaCto} nesta CTO</em>}
          </div>
        ) : (
          <div className="clientes-offline-cto clientes-offline-sem-cto">Sem CTO gravada</div>
        )}
        <p>
          {(cpe.contract_number ?? cpe.contract_pk) != null && `Contrato ${cpe.contract_number ?? cpe.contract_pk}`}
          {cpe.username && ` · ${cpe.username}`}
        </p>
        {/* Uma linha só: ícone em cima, rótulo curto embaixo, colunas iguais. */}
        <div className="clientes-offline-acoes">
          <Link to={`/conexao?cpe_pk=${cpe.pk}`} style={{ '--acao-cor': CORES.conexao } as CSSProperties} viewTransition>
            <LuNetwork size={20} aria-hidden="true" />
            Conexão
          </Link>
          {cpe.username ? (
            <Link
              to={`/onu?username=${encodeURIComponent(cpe.username)}`}
              style={{ '--acao-cor': CORES.onu } as CSSProperties}
              viewTransition
            >
              <LuCable size={20} aria-hidden="true" />
              ONU
            </Link>
          ) : (
            <span className="desabilitada" aria-hidden="true">
              <LuCable size={20} />
              ONU
            </span>
          )}
          {cpe.client_pk ? (
            <>
              <Link to={`/mapa?cliente=${cpe.client_pk}`} style={{ '--acao-cor': CORES.endereco } as CSSProperties} viewTransition>
                <LuMap size={20} aria-hidden="true" />
                Mapa
              </Link>
              <button
                type="button"
                style={{ '--acao-cor': CORES.sucesso } as CSSProperties}
                onClick={() => void ligar(cpe)}
                aria-busy={ligandoPk === cpe.client_pk}
                disabled={ligandoPk != null}
              >
                <LuPhone size={20} aria-hidden="true" />
                Ligar
              </button>
              <Link to={`/clientes/${cpe.client_pk}`} style={{ '--acao-cor': CORES.cliente } as CSSProperties} viewTransition>
                <LuUser size={20} aria-hidden="true" />
                Cliente
              </Link>
            </>
          ) : null}
        </div>
      </li>
    )
  }

  return (
    <PullToRefresh aoAtualizar={carregar}>
      <div className="clientes-offline-tela tela-entrada">
        <CabecalhoTela
          icone={LuWifiOff}
          cor={CORES.offline}
          titulo="Clientes Offline"
          subtitulo="Contrato ativo e CPE habilitado, mas sem sessão agora."
        />

        {!carregando && (cpes.length > 0 || erro == null) && (
          <div className="clientes-offline-busca">
            <MdSearch size={18} />
            <input
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome, usuário, contrato ou CTO"
            />
          </div>
        )}

        {carregando && (
          <ul className="clientes-offline-lista">
            {[0, 1, 2].map((i) => (
              <li key={i} className="clientes-offline-card">
                <Skeleton width="60%" height={15} />
                <Skeleton width="40%" height={12} />
              </li>
            ))}
          </ul>
        )}

        {!carregando && erro && cpes.length === 0 && (
          <EstadoErro mensagem={erro} cor={CORES.offline} onTentarDeNovo={carregar} />
        )}

        {!carregando && !erro && cpes.length === 0 && (
          <EstadoVazio icone={LuWifiOff} titulo="Nenhum cliente offline" subtitulo="Todo mundo com contrato ativo está conectado." />
        )}

        {cpes.length > 0 && (
          <>
            <p className="clientes-offline-total">
              {total} cliente(s) offline
              {atualizadoAs && <span> · Atualizado às {atualizadoAs}</span>}
              {aindaCarregandoLista && <span> · carregando mais…</span>}
            </p>

            {/* Vários offline na mesma CTO: provável problema coletivo
                (fibra, CTO, splitter), não da casa do cliente. */}
            {ctosVarios.length > 0 && !ctoFiltro && (
              <section className="clientes-offline-alerta">
                <h2>
                  <LuTriangleAlert size={16} aria-hidden="true" /> CTOs com mais de um offline
                </h2>
                <ul>
                  {ctosVarios.map((cto) => (
                    <li key={cto.dpPk}>
                      <button type="button" onClick={() => setCtoFiltro({ pk: cto.dpPk, nome: cto.nome })}>
                        <i style={{ background: dpsPorPk.get(cto.dpPk)?.cor || '#555555' }} aria-hidden="true" />
                        <span>{cto.nome}</span>
                        <b>{cto.quantidade}</b>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {ctoFiltro && (
              <button type="button" className="clientes-offline-filtro-cto" onClick={() => setCtoFiltro(null)}>
                CTO {ctoFiltro.nome} <LuX size={16} aria-label="Tirar o filtro da CTO" />
              </button>
            )}

            {/* Botões que quebram linha em tela estreita, sem cortar o texto. */}
            <div className="clientes-offline-periodos" role="group" aria-label="Tempo offline">
              {abasPeriodo.map((aba) => (
                <button
                  key={aba.chave}
                  type="button"
                  aria-pressed={periodo === aba.chave}
                  className={periodo === aba.chave ? 'ativo' : undefined}
                  onClick={() => setPeriodo(aba.chave)}
                >
                  {aba.rotulo}
                </button>
              ))}
            </div>

            {regioes.length > 1 && (
              <select
                className="campo clientes-offline-regiao"
                value={regiao}
                onChange={(e) => setRegiao(e.target.value)}
                aria-label="Região"
              >
                <option value="">Todas as regiões</option>
                {regioes.map(([nome, quantidade]) => (
                  <option key={nome} value={nome}>
                    {nome} ({quantidade})
                  </option>
                ))}
              </select>
            )}

            {visiveis === 0 && (
              <EstadoVazio
                icone={LuSearchX}
                titulo="Nenhum cliente offline com esses filtros"
                acao={filtroAtivo ? { rotulo: 'Limpar filtros', onClick: limparFiltros } : undefined}
              />
            )}

            {gruposVisiveis.map((grupo) => {
              const lista = porGrupo.get(grupo)!
              if (lista.length === 0) return null
              return (
                <section key={grupo} className="clientes-offline-grupo">
                  {periodo === 'todos' && (
                    <h2 className={`clientes-offline-grupo-titulo grupo-${grupo}`}>
                      {ROTULO_GRUPO[grupo]} <span>{lista.length}</span>
                    </h2>
                  )}
                  <ul className="clientes-offline-lista">{lista.map(cartao)}</ul>
                </section>
              )
            })}

            {erro && <p className="clientes-offline-erro-mais">{erro}</p>}
          </>
        )}
      </div>
    </PullToRefresh>
  )
}
