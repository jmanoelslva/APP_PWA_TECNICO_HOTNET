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

  // /aaa_ctl/session_online/list não tem documentação oficial (não achei
  // esse endpoint na doc do Controllr) — os nomes de campo abaixo são os
  // mesmos usados como search_term em session_online_list_wizard (esses
  // sim confirmados no pacote brbyteapi: session_callingid, nas_name,
  // session_v4_ip, session_v6_px, session_v6_pd, session_nas_port_id),
  // mais candidatos alternativos por padrão de nomenclatura, pra cada um
  // dos campos que o técnico realmente usa em campo (pedido explícito:
  // só estes, não "todos os dados").
  function formatarBytes(valor: unknown): string {
    const n = Number(valor)
    if (!Number.isFinite(n)) return String(valor)
    if (n < 1024) return `${n} B`
    const unidades = ['KB', 'MB', 'GB', 'TB']
    let i = -1
    let v = n
    do {
      v /= 1024
      i++
    } while (v >= 1024 && i < unidades.length - 1)
    return `${v.toFixed(v < 10 ? 2 : 1)} ${unidades[i]}`
  }

  function formatarDuracaoSegundos(segundos: number): string {
    const total = Math.max(0, Math.floor(segundos))
    const h = Math.floor(total / 3600)
    const m = Math.floor((total % 3600) / 60)
    const s = total % 60
    if (h > 0) return `${h}h ${m}min`
    if (m > 0) return `${m}min ${s}s`
    return `${s}s`
  }

  function formatarTempoConectado(valor: unknown, chave: string): string {
    const chaveMin = chave.toLowerCase()
    const n = Number(valor)
    if (chaveMin.includes('start') || chaveMin.includes('inicio')) {
      // valor é um instante (início da sessão), não uma duração — calcula
      // o tempo decorrido até agora. Aceita epoch (segundos) ou ISO.
      const inicioMs = /^\d+$/.test(String(valor)) ? n * 1000 : new Date(String(valor)).getTime()
      if (!Number.isFinite(inicioMs)) return String(valor)
      return formatarDuracaoSegundos((Date.now() - inicioMs) / 1000)
    }
    if (Number.isFinite(n)) return formatarDuracaoSegundos(n)
    return String(valor)
  }

  interface CampoDesejado {
    rotulo: string
    candidatos: string[]
    formatar?: (valor: unknown, chave: string) => string
  }

  const CAMPOS_DESEJADOS: CampoDesejado[] = [
    { rotulo: 'MAC da CPE', candidatos: ['session_callingid', 'session_calling_station_id', 'callingstationid', 'cpe_mac', 'mac'] },
    { rotulo: 'Status do contrato', candidatos: ['contract_status_name', 'client_contract_status_name', 'contract_status', 'client_contract_status'] },
    { rotulo: 'NAS (nome/identificador)', candidatos: ['nas_name', 'nas_identifier', 'session_nas_identifier'] },
    { rotulo: 'NAS (endereço/IP)', candidatos: ['nas_ip_address', 'nas_address', 'nas_addr', 'nas_ip'] },
    { rotulo: 'NAS (porta)', candidatos: ['session_nas_port_id', 'nas_port_id', 'session_nas_port'] },
    { rotulo: 'IPv4', candidatos: ['session_v4_ip', 'session_framed_ip_address', 'v4_ip'] },
    { rotulo: 'IPv6 (PX)', candidatos: ['session_v6_px', 'v6_px'] },
    { rotulo: 'IPv6 (PD)', candidatos: ['session_v6_pd', 'v6_pd'] },
    {
      rotulo: 'Tempo conectado',
      candidatos: ['session_uptime', 'session_duration', 'session_time', 'session_start', 'session_start_time', 'session_acct_start_time'],
      formatar: formatarTempoConectado,
    },
    {
      rotulo: 'Consumo (download)',
      candidatos: ['session_input_octets', 'session_rx_bytes', 'rx_bytes', 'input_octets'],
      formatar: formatarBytes,
    },
    {
      rotulo: 'Consumo (upload)',
      candidatos: ['session_output_octets', 'session_tx_bytes', 'tx_bytes', 'output_octets'],
      formatar: formatarBytes,
    },
  ]

  function camposSessao(): Array<[string, string]> {
    if (!sessao) return []
    const chavesPorNomeMinusculo = new Map(Object.keys(sessao).map((chave) => [chave.toLowerCase(), chave]))
    const resultado: Array<[string, string]> = []
    for (const campo of CAMPOS_DESEJADOS) {
      const chaveEncontrada = campo.candidatos.map((c) => chavesPorNomeMinusculo.get(c)).find((c) => c !== undefined)
      if (!chaveEncontrada) continue
      const valor = sessao[chaveEncontrada]
      if (valor == null || valor === '') continue
      resultado.push([campo.rotulo, campo.formatar ? campo.formatar(valor, chaveEncontrada) : String(valor)])
    }
    return resultado
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
