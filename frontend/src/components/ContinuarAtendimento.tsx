import { Link } from 'react-router-dom'
import { LuArrowRight, LuWrench } from 'react-icons/lu'
import { NOME_TELA, lerAtendimento } from '../utils/atendimento'
import { CORES, comAlpha } from '../utils/cores'

/**
 * "Continuar atendimento" no Início: volta direto à última tela do cliente
 * que estava aberto (até 12 h; some ao sair da conta).
 */
export default function ContinuarAtendimento() {
  const atendimento = lerAtendimento()
  if (!atendimento?.caminho || !atendimento.tela) return null
  const quem = atendimento.cliente ?? atendimento.pppoe ?? 'Cliente'
  return (
    <nav className="home-atalhos home-continuar" aria-label="Atendimento em andamento">
      <Link to={atendimento.caminho} className="home-atalho" viewTransition>
        <span className="home-atalho-icone" style={{ background: comAlpha(CORES.primaria, 14), color: CORES.primariaEscura }}>
          <LuWrench size={22} />
        </span>
        <span className="home-atalho-texto">
          <strong>Continuar atendimento</strong>
          <span>
            {quem} · estava em {NOME_TELA[atendimento.tela]}
          </span>
        </span>
        <LuArrowRight size={20} className="home-atalho-seta" aria-hidden="true" />
      </Link>
    </nav>
  )
}
