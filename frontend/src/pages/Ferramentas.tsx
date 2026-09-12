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
  // Mostra o IP público de quem abrir a página — útil para o técnico
  // conferir no Wi-Fi do próprio cliente se ele está atrás de CGNAT/IP
  // duplo.
  { nome: 'Qual é meu IP', descricao: 'geo.ipify.org — IP público de quem acessar', url: 'https://geo.ipify.org/', Icone: MdPublic },
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
  return (
    <div className="ferramentas-tela tela-entrada">
      <CabecalhoTela
        icone={MdConstruction}
        cor={CORES.ferramentas}
        titulo="Ferramentas"
        subtitulo="Testes de velocidade e conectividade."
      />

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
