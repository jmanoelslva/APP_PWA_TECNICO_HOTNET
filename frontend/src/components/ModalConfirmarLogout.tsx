import './ModalConfirmarLogout.css'

interface Props {
  aberto: boolean
  onCancelar: () => void
  onConfirmar: () => void
}

/** Confirmação antes de sair de verdade — evita deslogar sem querer num toque acidental. */
export default function ModalConfirmarLogout({ aberto, onCancelar, onConfirmar }: Props) {
  if (!aberto) return null

  return (
    <div className="modal-confirmar-logout-fundo" onClick={onCancelar}>
      <div className="modal-confirmar-logout" onClick={(evento) => evento.stopPropagation()}>
        <h2>Sair da conta?</h2>
        <p>Você vai precisar informar usuário e senha de novo para entrar.</p>
        <div className="modal-confirmar-logout-acoes">
          <button className="botao botao-secundario" onClick={onCancelar}>Cancelar</button>
          <button className="botao botao-primario" onClick={onConfirmar}>
            Sair
          </button>
        </div>
      </div>
    </div>
  )
}
