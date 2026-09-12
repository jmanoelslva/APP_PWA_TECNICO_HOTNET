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
  const [resultado, setResultado] = useState<MeuIpResponse | null>(null)
  const [consultando, setConsultando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function consultar() {
    setConsultando(true)
    setErro(null)
    try {
      const resposta = await consultarMeuIp()
      setResultado(resposta)
    } catch (excecao) {
      setErro(excecao instanceof ApiError ? excecao.message : 'Não foi possível consultar o IP.')
    } finally {
      setConsultando(false)
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

        {resultado && (
          <div className="ferramentas-ip-resultado">
            <div>
              <span>IP</span>
              <strong>{resultado.ip}</strong>
            </div>
            {resultado.location?.city && (
              <div>
                <span>Cidade</span>
                <strong>{resultado.location.city}</strong>
              </div>
            )}
            {resultado.location?.region && (
              <div>
                <span>Estado</span>
                <strong>{resultado.location.region}</strong>
              </div>
            )}
            {resultado.location?.country && (
              <div>
                <span>País</span>
                <strong>{resultado.location.country}</strong>
              </div>
            )}
            {resultado.isp && (
              <div>
                <span>Provedor</span>
                <strong>{resultado.isp}</strong>
              </div>
            )}
          </div>
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
