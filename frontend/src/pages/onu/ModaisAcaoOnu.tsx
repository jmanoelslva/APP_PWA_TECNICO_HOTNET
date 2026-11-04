import { useState, type CSSProperties } from 'react'
import { CORES } from '../../utils/cores'
import DeslizarParaConfirmar from '../../components/DeslizarParaConfirmar'

/** Confirmação por deslizar de reiniciar/remover — os dois derrubam o cliente na hora. */
export function ModalConfirmarAcao({
  acao,
  executando,
  onConfirmar,
  onCancelar,
}: {
  acao: 'reiniciar' | 'remover'
  executando: boolean
  onConfirmar: () => void
  onCancelar: () => void
}) {
  return (
    <div className="onu-modal-fundo" onClick={() => !executando && onCancelar()}>
      <div className="onu-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{acao === 'reiniciar' ? 'Reiniciar esta ONU?' : 'Remover esta ONU?'}</h2>
        <p className="onu-modal-texto">
          {acao === 'reiniciar'
            ? 'O equipamento vai reiniciar agora — o cliente fica sem conexão por alguns instantes.'
            : 'A ONU sai do registro do painel — o cliente fica sem conexão até ela ser cadastrada de novo.'}
        </p>
        {/* Deslizar em vez de um segundo toque: toque acidental com luva
            ou no bolso não derruba o cliente. */}
        <DeslizarParaConfirmar
          texto={executando ? 'Aguarde…' : acao === 'reiniciar' ? 'Deslize para reiniciar' : 'Deslize para remover'}
          cor={acao === 'remover' ? CORES.erro : CORES.onu}
          desabilitado={executando}
          onConfirmar={onConfirmar}
        />
        <div className="onu-modal-acoes">
          <button className="botao botao-secundario botao-bloco" onClick={onCancelar} disabled={executando}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

/** Novo nome da ONU (POST /fiber_ctl/onu/apply_rename, ver CONTROLLR_API_NOTES.md). */
export function ModalRenomear({
  nomeAtual,
  salvando,
  onSalvar,
  onCancelar,
}: {
  nomeAtual: string
  salvando: boolean
  onSalvar: (nome: string) => void
  onCancelar: () => void
}) {
  const [novoNome, setNovoNome] = useState(nomeAtual)
  return (
    <div className="onu-modal-fundo" onClick={() => !salvando && onCancelar()}>
      <div className="onu-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Renomear ONU</h2>
        <input
          type="text"
          className="onu-modal-input"
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          maxLength={64}
          autoFocus
        />
        <div className="onu-modal-acoes">
          <button className="botao botao-secundario" onClick={onCancelar} disabled={salvando}>
            Cancelar
          </button>
          <button aria-busy={salvando}
            className="botao botao-primario"
            style={{ '--botao-cor': CORES.onu } as CSSProperties}
            disabled={salvando || !novoNome.trim()}
            onClick={() => onSalvar(novoNome.trim())}
          >
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
