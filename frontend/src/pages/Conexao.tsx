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
import { formatarStatusContrato } from '../utils/formatacao'
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

  // /aaa_ctl/session_online/list não tem documentação oficial, mas os
  // nomes de campo abaixo foram CONFIRMADOS capturando ao vivo a resposta
  // real da tela "Sessões Online" do próprio Controllr (mesma requisição,
  // mesmo backend). Formato real de uma sessão (campos usados aqui):
  // session_callingid (MAC), contract_status, nas_name/nas_addr,
  // session_nas_port_id, session_v4_ip, session_v6_px/pd,
  // session_acct_time (segundos conectado) e stats.total.rx_byte/tx_byte
  // — esses dois últimos vêm ANINHADOS dentro de "stats.total", e o valor
  // está em KB (não bytes, apesar do nome): confirmado batendo a conta
  // contra o "Rx Bytes"/"Tx Bytes" mostrado na tela real (346047 ->
  // 337,9 MB, bate com os 336,84 MB exibidos). Candidatos alternativos
  // ficam como fallback caso o formato mude.
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

  interface ValorEncontrado {
    valor: unknown
    chave: string
  }

  interface CampoDesejado {
    rotulo: string
    extrair: (sessao: Record<string, unknown>) => ValorEncontrado | undefined
    formatar?: (valor: unknown, chave: string) => string
  }

  function porCandidatos(candidatos: string[]): (sessao: Record<string, unknown>) => ValorEncontrado | undefined {
    return (sessao) => {
      const chavesPorNomeMinusculo = new Map(Object.keys(sessao).map((chave) => [chave.toLowerCase(), chave]))
      for (const candidato of candidatos) {
        const chave = chavesPorNomeMinusculo.get(candidato)
        if (chave !== undefined) return { valor: sessao[chave], chave }
      }
      return undefined
    }
  }

  function porConsumo(direcao: 'rx' | 'tx'): (sessao: Record<string, unknown>) => ValorEncontrado | undefined {
    const chaveAninhada = direcao === 'rx' ? 'rx_byte' : 'tx_byte'
    const candidatosPlanos = direcao === 'rx'
      ? ['session_input_octets', 'session_rx_bytes', 'rx_bytes', 'input_octets']
      : ['session_output_octets', 'session_tx_bytes', 'tx_bytes', 'output_octets']
    return (sessao) => {
      const stats = (sessao as { stats?: { total?: Record<string, unknown> } }).stats?.total
      const valorAninhado = stats?.[chaveAninhada]
      if (valorAninhado != null && valorAninhado !== '') {
        // stats.total.rx_byte/tx_byte vêm em KB, não bytes — converte antes de formatar.
        return { valor: Number(valorAninhado) * 1024, chave: chaveAninhada }
      }
      return porCandidatos(candidatosPlanos)(sessao)
    }
  }

  const CAMPOS_DESEJADOS: CampoDesejado[] = [
    { rotulo: 'MAC da CPE', extrair: porCandidatos(['session_callingid', 'cpe_mac', 'session_calling_station_id', 'mac']) },
    {
      rotulo: 'Status do contrato',
      extrair: porCandidatos(['contract_status', 'contract_status_name', 'client_contract_status']),
      formatar: (valor) => formatarStatusContrato(valor as number | string),
    },
    { rotulo: 'NAS (nome/identificador)', extrair: porCandidatos(['nas_name', 'session_nas_identifier', 'nas_identifier']) },
    { rotulo: 'NAS (endereço/IP)', extrair: porCandidatos(['nas_addr', 'session_nas_ip', 'nas_ip_address', 'nas_address']) },
    { rotulo: 'NAS (porta)', extrair: porCandidatos(['session_nas_port_id', 'nas_port_id']) },
    { rotulo: 'IPv4', extrair: porCandidatos(['session_v4_ip', 'v4_ip']) },
    { rotulo: 'IPv6 (PX)', extrair: porCandidatos(['session_v6_px', 'v6_px']) },
    { rotulo: 'IPv6 (PD)', extrair: porCandidatos(['session_v6_pd', 'v6_pd']) },
    {
      rotulo: 'Tempo conectado',
      extrair: porCandidatos(['session_acct_time', 'session_uptime', 'session_duration', 'session_time']),
      formatar: formatarTempoConectado,
    },
    // rx/tx aqui são do ponto de vista do NAS (padrão RADIUS accounting):
    // rx_byte = recebido PELO NAS vindo do cliente = upload do cliente;
    // tx_byte = enviado PELO NAS para o cliente = download do cliente.
    { rotulo: 'Consumo (download)', extrair: porConsumo('tx'), formatar: formatarBytes },
    { rotulo: 'Consumo (upload)', extrair: porConsumo('rx'), formatar: formatarBytes },
  ]

  function camposSessao(): Array<[string, string]> {
    if (!sessao) return []
    const resultado: Array<[string, string]> = []
    for (const campo of CAMPOS_DESEJADOS) {
      const encontrado = campo.extrair(sessao)
      if (!encontrado) continue
      const { valor, chave } = encontrado
      if (valor == null || valor === '') continue
      resultado.push([campo.rotulo, campo.formatar ? campo.formatar(valor, chave) : String(valor)])
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
