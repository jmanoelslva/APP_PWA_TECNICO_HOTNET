import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { MdPeopleAlt, MdSearch, MdWifiOff } from 'react-icons/md'
import { ApiError, listarCpeOffline, type CpeDto } from '../api/client'
import CabecalhoTela from '../components/CabecalhoTela'
import EstadoVazio from '../components/EstadoVazio'
import PullToRefresh from '../components/PullToRefresh'
import Skeleton from '../components/Skeleton'
import { CORES } from '../utils/cores'
import { formatarDataHoraSegundos } from '../utils/formatacao'
import './ClientesOffline.css'

// Página grande de propósito — depois da primeira leva, o efeito abaixo
// já busca o resto sozinho em segundo plano, então poucas páginas grandes
// terminam mais rápido que muitas pequenas.
const TAMANHO_PAGINA = 50

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

export default function ClientesOffline() {
  const [cpes, setCpes] = useState<CpeDto[]>([])
  const [carregando, setCarregando] = useState(true)
  const [carregandoMais, setCarregandoMais] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [busca, setBusca] = useState('')

  useEffect(() => {
    carregar()
  }, [])

  // Busca só filtra o que a lista já tem — sem isso, digitar antes da
  // carga em segundo plano terminar escondia clientes que ainda iam
  // aparecer, parecendo que a busca "não achou" alguém que só ainda não
  // tinha chegado.
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
      // Falhar aqui não deve apagar a lista já carregada — só avisa e
      // para de tentar buscar mais sozinho (o pull-to-refresh recomeça).
      setErro(excecao instanceof ApiError ? excecao.message : 'Não foi possível carregar mais clientes.')
    } finally {
      setCarregandoMais(false)
    }
  }

  const termoBusca = normalizar(busca.trim())
  const cpesFiltrados = useMemo(
    () => (termoBusca ? cpes.filter((cpe) => bateBusca(cpe, termoBusca)) : cpes),
    [cpes, termoBusca],
  )
  const aindaCarregandoLista = cpes.length < total

  return (
    <PullToRefresh aoAtualizar={carregar}>
      <div className="clientes-offline-tela tela-entrada">
        <CabecalhoTela
          icone={MdWifiOff}
          cor={CORES.offline}
          titulo="Clientes Offline"
          subtitulo="Contrato ativo e CPE habilitado, mas sem sessão agora."
        />

        {!carregando && (cpes.length > 0 || erro == null) && (
          <div className="clientes-offline-busca">
            <MdSearch size={18} />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Filtrar por nome, usuário, contrato ou CTO"
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
          <div className="clientes-offline-status">
            <p>{erro}</p>
            <button className="botao botao-primario" style={{ '--botao-cor': CORES.offline } as CSSProperties} onClick={carregar}>
              Tentar novamente
            </button>
          </div>
        )}

        {!carregando && !erro && cpes.length === 0 && (
          <EstadoVazio icone={MdWifiOff} titulo="Nenhum cliente offline" subtitulo="Todo mundo com contrato ativo está conectado." />
        )}

        {cpes.length > 0 && (
          <>
            <p className="clientes-offline-total">
              {termoBusca ? `${cpesFiltrados.length} de ${total}` : `${total} cliente(s) offline`}
              {aindaCarregandoLista && ' — carregando mais…'}
            </p>

            {cpesFiltrados.length === 0 && (
              <EstadoVazio icone={MdSearch} titulo="Nenhum cliente offline bate com essa busca" />
            )}

            <ul className="clientes-offline-lista">
              {cpesFiltrados.map((cpe) => (
                <li key={cpe.pk} className="clientes-offline-card">
                  <div className="clientes-offline-topo">
                    <strong>{cpe.client_complete_name ?? cpe.username ?? `CPE #${cpe.pk}`}</strong>
                    {cpe.client_pk && (
                      <Link to={`/clientes/${cpe.client_pk}`} className="clientes-offline-link" viewTransition>
                        <MdPeopleAlt size={16} />
                      </Link>
                    )}
                  </div>
                  {(cpe.contract_number ?? cpe.contract_pk) != null && <p>Contrato: {cpe.contract_number ?? cpe.contract_pk}</p>}
                  {cpe.username && <p>Usuário: {cpe.username}</p>}
                  {cpe.dp_name && <p>CTO: {cpe.dp_name}</p>}
                  {cpe.date_auth && <p>Última autenticação: {formatarDataHoraSegundos(cpe.date_auth)}</p>}
                  <div className="clientes-offline-item-acoes">
                    <Link
                      to={`/conexao?cpe_pk=${cpe.pk}`}
                      className="botao botao-secundario botao-pequeno"
                      style={{ '--botao-cor': CORES.conexao } as CSSProperties}
                      viewTransition
                    >
                      Conexão
                    </Link>
                  </div>
                </li>
              ))}
            </ul>

            {erro && <p className="clientes-offline-erro-mais">{erro}</p>}
          </>
        )}
      </div>
    </PullToRefresh>
  )
}
