import type { IconType } from 'react-icons'
import { comAlpha } from '../utils/cores'
import './CabecalhoTela.css'

interface Props {
  icone: IconType
  cor: string
  titulo: string
  subtitulo: string
}

/** Cabeçalho padrão das telas internas: ícone num selo na cor da área + título. */
export default function CabecalhoTela({ icone: Icone, cor, titulo, subtitulo }: Props) {
  return (
    <header className="cabecalho-tela">
      <span className="cabecalho-tela-icone" style={{ background: comAlpha(cor, 14), color: cor }}>
        <Icone size={24} />
      </span>
      <div>
        <h1>{titulo}</h1>
        <p>{subtitulo}</p>
      </div>
    </header>
  )
}
