import { useState, type CSSProperties } from 'react'
import type { IconType } from 'react-icons'
import {
  MdBolt,
  MdConstruction,
  MdLooks4,
  MdLooks6,
  MdNetworkCheck,
  MdOpenInNew,
  MdPublic,
  MdSettingsEthernet,
  MdSpeed,
  MdWifiTethering,
} from 'react-icons/md'
import { ApiError, consultarMeuIp, type MeuIpResponse } from '../api/client'
import CabecalhoTela from '../components/CabecalhoTela'
import { CORES } from '../utils/cores'
import './Ferramentas.css'

// api.ipify.org/api6.ipify.org são públicos, sem chave, e servem
// exatamente para isso: descobrir o IPv4 e o IPv6 do dispositivo que faz
// a chamada, direto do navegador — api6 falha (não cai para IPv4) quando
// o dispositivo não tem conectividade IPv6. Timeout curto porque uma
// rede sem IPv6 não retorna erro rápido sozinha, só fica pendurada.
async function buscarIpPublico(url: string, timeoutMs = 4000): Promise<string | null> {
  const controlador = new AbortController()
  const temporizador = setTimeout(() => controlador.abort(), timeoutMs)
  try {
    const resposta = await fetch(url, { signal: controlador.signal })
    if (!resposta.ok) return null
    const dados = (await resposta.json()) as { ip?: string }
    return dados.ip ?? null
  } catch {
    return null
  } finally {
    clearTimeout(temporizador)
  }
}

interface Ferramenta {
  nome: string
  descricao: string
  url: string
  Icone: IconType
}

const FERRAMENTAS: Ferramenta[] = [
  { nome: 'Speedtest', descricao: 'speedtest.net — teste de velocidade Ookla', url: 'https://www.speedtest.net/', Icone: MdSpeed },
  { nome: 'Fast.com', descricao: 'Teste de velocidade da Netflix', url: 'https://fast.com/', Icone: MdBolt },
  { nome: 'ISP Focus (IPv6)', descricao: 'tcp6.ispfocus.net.br', url: 'https://tcp6.ispfocus.net.br/', Icone: MdLooks6 },
  { nome: 'ISP Focus (IPv4)', descricao: 'tcp4.ispfocus.net.br', url: 'https://tcp4.ispfocus.net.br/', Icone: MdLooks4 },
  {
    nome: 'Teste de Bufferbloat',
    descricao: 'waveform.com — detecta latência sob carga (jogo/chamada travando)',
    url: 'https://www.waveform.com/tools/bufferbloat',
    Icone: MdNetworkCheck,
  },
  {
    nome: 'Verificador de porta aberta',
    descricao: 'yougetsignal.com — útil pra DVR/câmera não acessando remoto',
    url: 'https://www.yougetsignal.com/tools/open-ports/',
    Icone: MdSettingsEthernet,
  },
  {
    nome: 'SIMET (NIC.br)',
    descricao: 'top.nic.br — teste de qualidade da conexão',
    url: 'https://top.nic.br/connection/',
    Icone: MdWifiTethering,
  },
]

export default function Ferramentas() {
  const [resultadoV4, setResultadoV4] = useState<MeuIpResponse | null>(null)
  const [resultadoV6, setResultadoV6] = useState<MeuIpResponse | null>(null)
  // Só preenchido quando nem o IPv4 nem o IPv6 puderam ser descobertos
  // direto pelo navegador (ex: CSP do servidor bloqueando a saída para
  // api.ipify.org/api6.ipify.org) — nesse caso o único dado disponível é
  // o IP que o próprio backend detectar da conexão, sem saber a versão.
  const [resultadoGenerico, setResultadoGenerico] = useState<MeuIpResponse | null>(null)
  const [consultando, setConsultando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [jaConsultou, setJaConsultou] = useState(false)

  async function consultar() {
    setConsultando(true)
    setErro(null)
    setResultadoV4(null)
    setResultadoV6(null)
    setResultadoGenerico(null)
    try {
      const [ipv4, ipv6] = await Promise.all([
        buscarIpPublico('https://api.ipify.org?format=json'),
        buscarIpPublico('https://api6.ipify.org?format=json'),
      ])

      if (!ipv4 && !ipv6) {
        const resposta = await consultarMeuIp()
        setResultadoGenerico(resposta)
        return
      }

      const [respostaV4, respostaV6] = await Promise.allSettled([
        ipv4 ? consultarMeuIp(ipv4) : Promise.reject(new Error('sem IPv4')),
        ipv6 ? consultarMeuIp(ipv6) : Promise.reject(new Error('sem IPv6')),
      ])
      if (respostaV4.status === 'fulfilled') setResultadoV4(respostaV4.value)
      if (respostaV6.status === 'fulfilled') setResultadoV6(respostaV6.value)
    } catch (excecao) {
      setErro(excecao instanceof ApiError ? excecao.message : 'Não foi possível consultar o IP.')
    } finally {
      setConsultando(false)
      setJaConsultou(true)
    }
  }

  return (
    <div className="ferramentas-tela tela-entrada">
      <CabecalhoTela
        icone={MdConstruction}
        cor={CORES.ferramentas}
        titulo="Ferramentas"
        subtitulo="Testes de velocidade e conectividade."
      />

      <div className="ferramentas-ip-card">
        <div className="ferramentas-ip-topo">
          <span className="ferramentas-item-icone">
            <MdPublic size={22} />
          </span>
          <span className="ferramentas-item-texto">
            <strong>Meu IP</strong>
            <span>IP público e localização aproximada da rede atual</span>
          </span>
        </div>

        <button
          type="button"
          className="botao botao-primario ferramentas-ip-botao"
          style={{ '--botao-cor': CORES.ferramentas } as CSSProperties}
          onClick={consultar}
          disabled={consultando}
        >
          {consultando ? 'Consultando…' : 'Consultar'}
        </button>

        {erro && <p className="ferramentas-ip-erro">{erro}</p>}

        {resultadoGenerico && <ResultadoIp titulo="IP" resultado={resultadoGenerico} />}
        {resultadoV4 && <ResultadoIp titulo="IPv4" resultado={resultadoV4} />}
        {resultadoV6 && <ResultadoIp titulo="IPv6" resultado={resultadoV6} />}

        {jaConsultou && !consultando && !erro && !resultadoV4 && !resultadoV6 && !resultadoGenerico && (
          <p className="ferramentas-ip-erro">Não foi possível determinar o IP.</p>
        )}
      </div>

      <ul className="ferramentas-lista">
        {FERRAMENTAS.map((ferramenta) => (
          <li key={ferramenta.url}>
            <a href={ferramenta.url} target="_blank" rel="noreferrer" className="ferramentas-item">
              <span className="ferramentas-item-icone">
                <ferramenta.Icone size={22} />
              </span>
              <span className="ferramentas-item-texto">
                <strong>{ferramenta.nome}</strong>
                <span>{ferramenta.descricao}</span>
              </span>
              <MdOpenInNew size={18} className="ferramentas-item-seta" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ResultadoIp({ titulo, resultado }: { titulo: string; resultado: MeuIpResponse }) {
  const { location, as_info: asInfo } = resultado
  return (
    <div className="ferramentas-ip-resultado">
      <span className="ferramentas-ip-resultado-titulo">{titulo}</span>
      <div>
        <span>IP</span>
        <strong>{resultado.ip}</strong>
      </div>
      {location?.city && (
        <div>
          <span>Cidade</span>
          <strong>{location.city}</strong>
        </div>
      )}
      {location?.region && (
        <div>
          <span>Estado</span>
          <strong>{location.region}</strong>
        </div>
      )}
      {location?.country && (
        <div>
          <span>País</span>
          <strong>{location.country}</strong>
        </div>
      )}
      {location?.postalCode && (
        <div>
          <span>CEP</span>
          <strong>{location.postalCode}</strong>
        </div>
      )}
      {location?.timezone && (
        <div>
          <span>Fuso horário</span>
          <strong>UTC{location.timezone}</strong>
        </div>
      )}
      {resultado.isp && (
        <div>
          <span>Provedor</span>
          <strong>{resultado.isp}</strong>
        </div>
      )}
      {asInfo?.name && asInfo.name !== resultado.isp && (
        <div>
          <span>Rede (ASN)</span>
          <strong>
            {asInfo.name}
            {asInfo.asn ? ` (AS${asInfo.asn})` : ''}
          </strong>
        </div>
      )}
    </div>
  )
}
