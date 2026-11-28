import type { CSSProperties } from 'react'
import { LuRefreshCw } from 'react-icons/lu'
import Skeleton from '../../components/Skeleton'
import LidoHa from '../../components/LidoHa'
import { CORES } from '../../utils/cores'
import IpComAcesso from '../../components/IpComAcesso'
import { ROTULOS_CODIGO, camposSessao } from './sessao'

/** Sessão RADIUS ativa agora (carregada pela tela junto com a conexão). */
export default function CardSessaoOnline({
  sessao,
  carregando,
  lidaEm,
  onAtualizar,
  portaRoteador,
}: {
  sessao: Record<string, unknown> | null
  carregando: boolean
  lidaEm: number | null
  onAtualizar: () => void
  // Porta do acesso ao roteador (cpe_access_port), para abrir pelo IPv4.
  portaRoteador?: number
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
          <LuRefreshCw size={16} /> {carregando ? 'Consultando…' : 'Atualizar'}
        </button>
      </div>
      {sessao && (
        <p className="conexao-sessao-lida">
          <LidoHa momento={lidaEm} />
        </p>
      )}
      {carregando && !sessao && <Skeleton width="60%" height={14} />}
      {sessao && campos.length === 0 && <p className="conexao-sessao-vazio">Cliente sem sessão online no momento.</p>}
      {sessao &&
        campos.map(([rotulo, valor]) => (
          <div className="conexao-linha conexao-linha-sessao" key={rotulo}>
            <span>{rotulo}</span>
            <strong className={ROTULOS_CODIGO.has(rotulo) ? 'conexao-valor-codigo' : undefined} title={valor}>
              {rotulo === 'IPv4' ? <IpComAcesso ip={valor} porta={portaRoteador} /> : valor}
            </strong>
          </div>
        ))}
      {!carregando && !sessao && <p className="conexao-sessao-vazio">Não foi possível consultar a sessão online agora.</p>}
    </div>
  )
}
