import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { MdPeopleAlt, MdWifiOff } from 'react-icons/md'
import { ApiError, listarCpeOffline, type CpeDto } from '../api/client'
import CabecalhoTela from '../components/CabecalhoTela'
import EstadoVazio from '../components/EstadoVazio'
import PullToRefresh from '../components/PullToRefresh'
import Skeleton from '../components/Skeleton'
import { CORES } from '../utils/cores'
import { formatarDataHoraSegundos } from '../utils/formatacao'
import './ClientesOffline.css'

const TAMANHO_PAGINA = 20

export default function ClientesOffline() {
  const [cpes, setCpes] = useState<CpeDto[]>([])
  const [carregando, setCarregando] = useState(true)
  const [carregandoMais, setCarregandoMais] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    carregar()
  }, [])

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
      // "Carregar mais" falhar não deve apagar a lista já carregada — só
      // avisa e deixa o técnico tentar de novo.
      setErro(excecao instanceof ApiError ? excecao.message : 'Não foi possível carregar mais clientes.')
    } finally {
      setCarregandoMais(false)
    }
  }

  return (
    <PullToRefresh aoAtualizar={carregar}>
      <div className="clientes-offline-tela tela-entrada">
        <CabecalhoTela
          icone={MdWifiOff}
          cor={CORES.offline}
          titulo="Clientes Offline"
          subtitulo="Contrato ativo e CPE habilitado, mas sem sessão agora."
        />

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
            <p className="clientes-offline-total">{total} cliente(s) offline</p>
            <ul className="clientes-offline-lista">
              {cpes.map((cpe) => (
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

            {cpes.length < total && (
              <button
                className="botao botao-secundario clientes-offline-carregar-mais"
                style={{ '--botao-cor': CORES.offline } as CSSProperties}
                onClick={carregarMais}
                disabled={carregandoMais}
              >
                {carregandoMais ? 'Carregando…' : 'Carregar mais'}
              </button>
            )}
          </>
        )}
      </div>
    </PullToRefresh>
  )
}
