import { MdAddBox, MdIosShare } from 'react-icons/md'
import './ModalInstalarIos.css'

interface Props {
  aberto: boolean
  onFechar: () => void
}

/** Passo a passo manual de instalação pro iOS — Safari nunca dispara beforeinstallprompt. */
export default function ModalInstalarIos({ aberto, onFechar }: Props) {
  if (!aberto) return null

  return (
    <div className="modal-instalar-ios-fundo" onClick={onFechar}>
      <div className="modal-instalar-ios" onClick={(evento) => evento.stopPropagation()}>
        <h2>Instalar o app</h2>
        <ol className="modal-instalar-ios-passos">
          <li>
            Toque no ícone de compartilhar <MdIosShare size={16} /> na barra do Safari
          </li>
          <li>
            Escolha <strong>"Adicionar à Tela de Início"</strong> <MdAddBox size={16} />
          </li>
        </ol>
        <p className="modal-instalar-ios-obs">
          Só funciona pelo Safari — não abre pelo app do WhatsApp, Instagram ou outro navegador (Chrome, Firefox
          etc).
        </p>
        <button onClick={onFechar}>Entendi</button>
      </div>
    </div>
  )
}
