import type { CSSProperties } from 'react'
import { MdCloudOff } from 'react-icons/md'
import './EstadoVazio.css'

interface Props {
  mensagem: string
  // Cor da área da tela (ex.: CORES.conexao), usada no botão.
  cor: string
  onTentarDeNovo: () => void
}

/** Erro ao carregar uma tela: mesmo visual do estado vazio, com "Tentar novamente". */
export default function EstadoErro({ mensagem, cor, onTentarDeNovo }: Props) {
  return (
    <div className="estado-vazio estado-erro" role="alert">
      <span className="estado-vazio-icone">
        <MdCloudOff size={32} />
      </span>
      <p className="estado-vazio-titulo">{mensagem}</p>
      <button
        className="botao botao-secundario"
        style={{ '--botao-cor': cor } as CSSProperties}
        onClick={() => onTentarDeNovo()}
      >
        Tentar novamente
      </button>
    </div>
  )
}
