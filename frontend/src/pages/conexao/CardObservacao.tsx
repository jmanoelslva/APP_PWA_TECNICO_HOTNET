import { useState, type CSSProperties } from 'react'
import { MdSave } from 'react-icons/md'
import { ApiError, atualizarDetalhesCpe, type CpeDto } from '../../api/client'
import { useToast } from '../../components/Toast/useToast'
import { CORES } from '../../utils/cores'
import BlocoRecolhivel from './BlocoRecolhivel'

/** cpe_obs, doc oficial de /aaa_ctl/cpe/update. Salvar próprio, separado da CTO. */
export default function CardObservacao({
  cpe,
  aberto,
  onAlternar,
  onAtualizado,
}: {
  cpe: CpeDto
  aberto: boolean
  onAlternar: () => void
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
    <BlocoRecolhivel titulo="Observação do CPE" aberto={aberto} onAlternar={onAlternar}>
      <div className="conexao-campo">
        <textarea
          className="conexao-input conexao-textarea"
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          placeholder="Sem observação"
          rows={3}
        />
      </div>
      <button
        className="botao botao-secundario botao-pequeno"
        style={{ '--botao-cor': CORES.conexao } as CSSProperties}
        onClick={salvar}
        disabled={salvando}
      >
        <MdSave size={14} /> {salvando ? 'Salvando…' : 'Salvar observação'}
      </button>
    </BlocoRecolhivel>
  )
}
