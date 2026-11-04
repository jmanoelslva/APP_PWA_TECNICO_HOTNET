import { Link } from 'react-router-dom'
import type { IconType } from 'react-icons'
import './EstadoVazio.css'

/** Próximo passo claro para sair do vazio: um link (to) ou uma ação (onClick). */
export type AcaoEstadoVazio = { rotulo: string; to: string } | { rotulo: string; onClick: () => void }

interface Props {
  icone: IconType
  titulo: string
  subtitulo?: string
  acao?: AcaoEstadoVazio
}

/** Estado vazio com ícone — usado quando uma lista não tem nada para mostrar. */
export default function EstadoVazio({ icone: Icone, titulo, subtitulo, acao }: Props) {
  return (
    <div className="estado-vazio">
      <span className="estado-vazio-icone">
        <Icone size={32} />
      </span>
      <p className="estado-vazio-titulo">{titulo}</p>
      {subtitulo && <p className="estado-vazio-subtitulo">{subtitulo}</p>}
      {acao &&
        ('to' in acao ? (
          <Link to={acao.to} className="botao botao-secundario estado-vazio-acao" viewTransition>
            {acao.rotulo}
          </Link>
        ) : (
          <button type="button" className="botao botao-secundario estado-vazio-acao" onClick={acao.onClick}>
            {acao.rotulo}
          </button>
        ))}
    </div>
  )
}
