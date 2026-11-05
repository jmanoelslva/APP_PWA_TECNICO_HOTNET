import { useState, type CSSProperties } from 'react'
import { LuSave } from 'react-icons/lu'
import { ApiError, atualizarDetalhesCpe, type CpeDto } from '../../api/client'
import { useToast } from '../../components/Toast/useToast'
import { CORES } from '../../utils/cores'
import CartaoConexao from './CartaoConexao'

/** cpe_obs, doc oficial de /aaa_ctl/cpe/update. Salvar próprio, separado da CTO. */
export default function CardObservacao({
  cpe,
  onAtualizado,
}: {
  cpe: CpeDto
  onAtualizado: (parcial: Partial<CpeDto>) => void
}) {
  const { toast } = useToast()
  const [obs, setObs] = useState(cpe.obs ?? '')
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    if (!cpe.pk) return
    setSalvando(true)
    try {
      await atualizarDetalhesCpe(cpe.pk, { cpe_obs: obs })
      onAtualizado({ obs })
      toast('Observação atualizada.', 'sucesso')
    } catch (excecao) {
      toast(excecao instanceof ApiError ? excecao.message : 'Não foi possível atualizar a observação.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <CartaoConexao titulo="Observação do CPE">
      <div className="conexao-campo">
        <textarea
          className="conexao-input conexao-textarea"
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          placeholder="Sem observação"
          rows={3}
        />
      </div>
      <button aria-busy={salvando}
        className="botao botao-secundario botao-pequeno"
        style={{ '--botao-cor': CORES.conexao } as CSSProperties}
        onClick={salvar}
        disabled={salvando}
      >
        <LuSave size={16} /> {salvando ? 'Salvando…' : 'Salvar observação'}
      </button>
    </CartaoConexao>
  )
}
