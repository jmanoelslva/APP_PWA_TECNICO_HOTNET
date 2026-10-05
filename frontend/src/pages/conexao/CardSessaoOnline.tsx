import type { CSSProperties } from 'react'
import { MdRefresh } from 'react-icons/md'
import Skeleton from '../../components/Skeleton'
import { CORES } from '../../utils/cores'
import { camposSessao } from './sessao'

/** Sessão RADIUS ativa agora (carregada pela tela junto com a conexão). */
export default function CardSessaoOnline({
  sessao,
  carregando,
  onAtualizar,
}: {
  sessao: Record<string, unknown> | null
  carregando: boolean
  onAtualizar: () => void
}) {
  const campos = camposSessao(sessao)
  return (
    <div className="conexao-card">
      <div className="conexao-sessao-topo">
        <h2>Sessão online</h2>
        <button
          className="botao botao-secundario botao-pequeno"
          style={{ '--botao-cor': CORES.conexao } as CSSProperties}
          onClick={onAtualizar}
          disabled={carregando}
        >
          <MdRefresh size={14} /> {carregando ? 'Consultando…' : 'Atualizar'}
        </button>
      </div>
      {carregando && !sessao && <Skeleton width="60%" height={14} />}
      {sessao && campos.length === 0 && <p className="conexao-sessao-vazio">Cliente sem sessão online no momento.</p>}
      {sessao &&
        campos.map(([rotulo, valor]) => (
          <div className="conexao-linha" key={rotulo}>
            <span>{rotulo}</span>
            <strong>{valor}</strong>
          </div>
        ))}
      {!carregando && !sessao && <p className="conexao-sessao-vazio">Não foi possível consultar a sessão online agora.</p>}
    </div>
  )
}
