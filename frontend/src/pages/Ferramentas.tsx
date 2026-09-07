import { MdConstruction, MdOpenInNew, MdSpeed } from 'react-icons/md'
import CabecalhoTela from '../components/CabecalhoTela'
import { CORES } from '../utils/cores'
import './Ferramentas.css'

interface Ferramenta {
  nome: string
  descricao: string
  url: string
}

const FERRAMENTAS: Ferramenta[] = [
  { nome: 'Speedtest', descricao: 'speedtest.net — teste de velocidade Ookla', url: 'https://www.speedtest.net/' },
  { nome: 'Fast.com', descricao: 'Teste de velocidade da Netflix', url: 'https://fast.com/' },
  { nome: 'ISP Focus (IPv6)', descricao: 'tcp6.ispfocus.net.br', url: 'https://tcp6.ispfocus.net.br/' },
  { nome: 'ISP Focus (IPv4)', descricao: 'tcp4.ispfocus.net.br', url: 'https://tcp4.ispfocus.net.br/' },
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
                <MdSpeed size={22} />
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
