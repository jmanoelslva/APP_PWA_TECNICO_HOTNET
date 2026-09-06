import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MdContentCopy, MdVisibility, MdVisibilityOff, MdWifi } from 'react-icons/md'
import { ApiError, buscarCpe, buscarSessaoOnlineCpe, type CpeDto } from '../api/client'
import CabecalhoTela from '../components/CabecalhoTela'
import VoltarInicio from '../components/VoltarInicio'
import Skeleton from '../components/Skeleton'
import PullToRefresh from '../components/PullToRefresh'
import EstadoVazio from '../components/EstadoVazio'
import { useToast } from '../components/Toast/useToast'
import { CORES } from '../utils/cores'
import './Conexao.css'

export default function Conexao() {
  const [params] = useSearchParams()
  const cpePkParam = params.get('cpe_pk')
  const { toast } = useToast()

  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [cpe, setCpe] = useState<CpeDto | null>(null)
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [sessao, setSessao] = useState<Record<string, unknown> | null>(null)
  const [carregandoSessao, setCarregandoSessao] = useState(false)

  useEffect(() => {
    if (!cpePkParam) {
      setCarregando(false)
      return
    }
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cpePkParam])

  async function carregar() {
    setCarregando(true)
    setErro(null)
    try {
      const resposta = await buscarCpe({ cpe_pk: Number(cpePkParam) })
      setCpe(resposta.results[0] ?? null)
    } catch (excecao) {
      setErro(excecao instanceof ApiError ? excecao.message : 'Não foi possível carregar os dados de conexão.')
    } finally {
      setCarregando(false)
    }
  }

  async function verSessaoOnline() {
    if (!cpe?.pk) return
    setCarregandoSessao(true)
    try {
      const resposta = await buscarSessaoOnlineCpe(cpe.pk)
      setSessao(resposta.results[0] ?? {})
    } catch (excecao) {
      toast(excecao instanceof ApiError ? excecao.message : 'Não foi possível consultar a sessão online.')
    } finally {
      setCarregandoSessao(false)
    }
  }

  async function copiar(valor: string | undefined, rotulo: string) {
    if (!valor) return
    try {
      await navigator.clipboard.writeText(valor)
      toast(`${rotulo} copiado.`, 'sucesso')
    } catch {
      toast('Não foi possível copiar.')
    }
  }

  function campoSessao(chaves: string[]): string {
    if (!sessao) return '—'
    for (const chave of chaves) {
      const valor = sessao[chave]
      if (valor != null && valor !== '') return String(valor)
    }
    return '—'
  }

  return (
    <PullToRefresh aoAtualizar={carregar}>
      <div className="conexao-tela tela-entrada">
        <VoltarInicio />
        <CabecalhoTela icone={MdWifi} cor={CORES.conexao} titulo="Conexão" subtitulo="Dados de acesso e sessão do cliente." />

        {!cpePkParam && (
          <EstadoVazio icone={MdWifi} titulo="Nenhuma conexão selecionada" subtitulo="Acesse esta tela a partir dos detalhes de um cliente." />
        )}

        {cpePkParam && carregando && (
          <div className="conexao-card">
            <Skeleton width="50%" height={16} />
            <Skeleton width="70%" height={13} />
            <Skeleton width="40%" height={13} />
          </div>
        )}

        {cpePkParam && !carregando && erro && (
          <div className="conexao-status">
            <p>{erro}</p>
            <button onClick={carregar}>Tentar novamente</button>
          </div>
        )}

        {cpePkParam && !carregando && !erro && cpe && (
          <>
            <div className="conexao-card">
              <div className="conexao-linha">
                <span>Cliente</span>
                <strong>{cpe.client_complete_name ?? '—'}</strong>
              </div>
              <div className="conexao-linha">
                <span>Contrato</span>
                <strong>{cpe.contract_number ?? cpe.contract_pk ?? '—'}</strong>
              </div>
              <div className="conexao-linha">
                <span>Plano</span>
                <strong>{cpe.plan_name ?? '—'}</strong>
              </div>
            </div>

            <div className="conexao-card">
              <h2>Acesso PPPoE</h2>
              <div className="conexao-campo">
                <span>Usuário</span>
                <div className="conexao-campo-valor">
                  <strong>{cpe.username ?? cpe.access_login ?? '—'}</strong>
                  <button onClick={() => copiar(cpe.username ?? cpe.access_login, 'Usuário')} aria-label="Copiar usuário">
                    <MdContentCopy size={16} />
                  </button>
                </div>
              </div>
              <div className="conexao-campo">
                <span>Senha</span>
                <div className="conexao-campo-valor">
                  <strong>{mostrarSenha ? cpe.access_password ?? '—' : '••••••••'}</strong>
                  <button onClick={() => setMostrarSenha((v) => !v)} aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}>
                    {mostrarSenha ? <MdVisibilityOff size={16} /> : <MdVisibility size={16} />}
                  </button>
                  <button onClick={() => copiar(cpe.access_password, 'Senha')} aria-label="Copiar senha">
                    <MdContentCopy size={16} />
                  </button>
                </div>
              </div>
            </div>

            <div className="conexao-card">
              <h2>Rede</h2>
              <div className="conexao-linha">
                <span>IP</span>
                <strong>{cpe.v4_ip ?? cpe.v4_ip_last ?? '—'}</strong>
              </div>
              <div className="conexao-linha">
                <span>MAC</span>
                <strong>{cpe.mac ?? '—'}</strong>
              </div>
              <div className="conexao-linha">
                <span>Status</span>
                <strong>{cpe.status ?? cpe.state ?? '—'}</strong>
              </div>
            </div>

            <div className="conexao-card">
              <div className="conexao-sessao-topo">
                <h2>Sessão online</h2>
                <button className="conexao-btn-secundario" onClick={verSessaoOnline} disabled={carregandoSessao}>
                  {carregandoSessao ? 'Consultando…' : 'Ver sessão online agora'}
                </button>
              </div>
              {sessao && (
                <>
                  <div className="conexao-linha">
                    <span>IP</span>
                    <strong>{campoSessao(['session_v4_ip', 'v4_ip', 'ip'])}</strong>
                  </div>
                  <div className="conexao-linha">
                    <span>MAC</span>
                    <strong>{campoSessao(['session_mac', 'mac'])}</strong>
                  </div>
                  <div className="conexao-linha">
                    <span>Conectado desde</span>
                    <strong>{campoSessao(['session_date_add', 'date_add'])}</strong>
                  </div>
                  <div className="conexao-linha">
                    <span>Tempo de sessão</span>
                    <strong>{campoSessao(['session_acct_time', 'acct_time'])}</strong>
                  </div>
                </>
              )}
              {!sessao && <p className="conexao-sessao-vazio">Toque em "Ver sessão online agora" pra consultar em tempo real.</p>}
            </div>
          </>
        )}
      </div>
    </PullToRefresh>
  )
}
