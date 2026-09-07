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
  // Estado separado do PPPoE acima — são credenciais diferentes, e um
  // técnico pode querer conferir uma sem revelar a outra sem querer.
  const [mostrarSenhaRoteador, setMostrarSenhaRoteador] = useState(false)
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

  // /aaa_ctl/session_online/list nem tem documentação oficial (não achei
  // esse endpoint na doc do Controllr) — em vez de arriscar cherry-pick
  // de 3-4 nomes de campo achados por analogia, mostra TODOS os campos
  // que a resposta trouxer, sem exceção, com um rótulo derivado do nome
  // técnico. Isso é o que garante "todos os dados" de verdade, mesmo
  // que o Controllr use nomes diferentes do esperado ou adicione campos
  // novos no futuro.
  function rotulo(chave: string): string {
    return chave
      .replace(/^session_/, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  }

  function camposSessao(): Array<[string, string]> {
    if (!sessao) return []
    return Object.entries(sessao)
      .filter(([, valor]) => valor != null && valor !== '')
      .map(([chave, valor]) => [rotulo(chave), String(valor)])
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
              <h2>Acesso PPPoE (login do cliente)</h2>
              <div className="conexao-campo">
                <span>Usuário</span>
                <div className="conexao-campo-valor">
                  <strong>{cpe.username ?? '—'}</strong>
                  <button onClick={() => copiar(cpe.username, 'Usuário')} aria-label="Copiar usuário">
                    <MdContentCopy size={16} />
                  </button>
                </div>
              </div>
              <div className="conexao-campo">
                <span>Senha</span>
                <div className="conexao-campo-valor">
                  <strong>{mostrarSenha ? cpe.password ?? '—' : '••••••••'}</strong>
                  <button onClick={() => setMostrarSenha((v) => !v)} aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}>
                    {mostrarSenha ? <MdVisibilityOff size={16} /> : <MdVisibility size={16} />}
                  </button>
                  <button onClick={() => copiar(cpe.password, 'Senha')} aria-label="Copiar senha">
                    <MdContentCopy size={16} />
                  </button>
                </div>
              </div>
            </div>

            {(cpe.access_login || cpe.access_password) && (
              <div className="conexao-card">
                {/* Credencial DIFERENTE do PPPoE acima — acesso administrativo
                    ao próprio roteador/CPE, não o login de internet do
                    cliente (confirmado na doc oficial do Controllr). */}
                <h2>Acesso ao roteador (admin)</h2>
                <div className="conexao-campo">
                  <span>Usuário</span>
                  <div className="conexao-campo-valor">
                    <strong>{cpe.access_login ?? '—'}</strong>
                    <button onClick={() => copiar(cpe.access_login, 'Usuário')} aria-label="Copiar usuário do roteador">
                      <MdContentCopy size={16} />
                    </button>
                  </div>
                </div>
                <div className="conexao-campo">
                  <span>Senha</span>
                  <div className="conexao-campo-valor">
                    <strong>{mostrarSenhaRoteador ? cpe.access_password ?? '—' : '••••••••'}</strong>
                    <button
                      onClick={() => setMostrarSenhaRoteador((v) => !v)}
                      aria-label={mostrarSenhaRoteador ? 'Ocultar senha do roteador' : 'Mostrar senha do roteador'}
                    >
                      {mostrarSenhaRoteador ? <MdVisibilityOff size={16} /> : <MdVisibility size={16} />}
                    </button>
                    <button onClick={() => copiar(cpe.access_password, 'Senha do roteador')} aria-label="Copiar senha do roteador">
                      <MdContentCopy size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )}

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
              {sessao && camposSessao().length === 0 && (
                <p className="conexao-sessao-vazio">Cliente sem sessão online no momento.</p>
              )}
              {sessao &&
                camposSessao().map(([rotulo, valor]) => (
                  <div className="conexao-linha" key={rotulo}>
                    <span>{rotulo}</span>
                    <strong>{valor}</strong>
                  </div>
                ))}
              {!sessao && <p className="conexao-sessao-vazio">Toque em "Ver sessão online agora" pra consultar em tempo real.</p>}
            </div>
          </>
        )}
      </div>
    </PullToRefresh>
  )
}
