import type { ReactNode } from 'react'
import { MdFormatSize, MdGetApp, MdLogout, MdNewReleases, MdNotificationsActive, MdWbSunny } from 'react-icons/md'
import { useTema } from '../hooks/useTema'
import type { EscolhaTema } from '../utils/tema'
import { temNovidades } from './ModalNovidades'
import type { useAvisos } from '../hooks/useAvisos'
import './FolhaConfiguracoes.css'

function Interruptor({
  icone,
  titulo,
  dica,
  ligado,
  desabilitado,
  onAlternar,
}: {
  icone: ReactNode
  titulo: string
  dica?: string | null
  ligado: boolean
  desabilitado?: boolean
  onAlternar: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      className="folha-config-linha"
      disabled={desabilitado}
      onClick={onAlternar}
    >
      <span className="folha-config-icone">{icone}</span>
      <span className="folha-config-texto">
        {titulo}
        {dica && <small>{dica}</small>}
      </span>
      <span className="home-interruptor" data-ligado={ligado} aria-hidden="true" />
    </button>
  )
}

const OPCOES_TEMA: { valor: EscolhaTema; rotulo: string }[] = [
  { valor: 'light', rotulo: 'Claro' },
  { valor: 'dark', rotulo: 'Escuro' },
  { valor: 'auto', rotulo: 'Automático' },
]

/**
 * Configurações do app (abre pelo avatar da tela inicial): aparência,
 * avisos de OS, instalar e sair, com a versão no rodapé. Substitui o menu
 * suspenso do avatar, que já tinha 5 itens e 2 interruptores.
 */
export default function FolhaConfiguracoes({
  aberto,
  usuario,
  avisos,
  dicaAvisos,
  podeInstalar,
  onInstalar,
  onNovidades,
  onSair,
  onFechar,
}: {
  aberto: boolean
  usuario: string | undefined
  avisos: ReturnType<typeof useAvisos>
  dicaAvisos: string | null
  podeInstalar: boolean
  onInstalar: () => void
  onNovidades: () => void
  onSair: () => void
  onFechar: () => void
}) {
  const { escolha, escolherTema, sol, alternarSol, grande, alternarTextoGrande } = useTema()
  if (!aberto) return null
  const avisosLigados = avisos.estado === 'ligado'
  const mostrarAvisos = avisos.estado !== 'indisponivel' && avisos.estado !== 'carregando'

  return (
    <div className="folha-config-fundo" onClick={onFechar}>
      <div
        className="folha-config"
        role="dialog"
        aria-modal="true"
        aria-label="Configurações"
        onClick={(evento) => evento.stopPropagation()}
      >
        <h2>Configurações</h2>
        {usuario && <p className="folha-config-usuario">Conectado como {usuario}</p>}

        <h3 id="folha-config-tema">Aparência</h3>
        {/* Automático segue o tema do celular (claro de dia, escuro à noite). */}
        <div className="folha-config-segmentos" role="radiogroup" aria-labelledby="folha-config-tema">
          {OPCOES_TEMA.map((opcao) => (
            <button
              key={opcao.valor}
              type="button"
              role="radio"
              aria-checked={escolha === opcao.valor}
              className="folha-config-segmento"
              onClick={() => escolherTema(opcao.valor)}
            >
              {opcao.rotulo}
            </button>
          ))}
        </div>
        <div className="folha-config-grupo">
          <Interruptor
            icone={<MdWbSunny size={20} />}
            titulo="Modo sol"
            dica="Alto contraste para tela no sol"
            ligado={sol}
            onAlternar={alternarSol}
          />
          <Interruptor
            icone={<MdFormatSize size={20} />}
            titulo="Texto grande"
            dica="Amplia todo o app"
            ligado={grande}
            onAlternar={alternarTextoGrande}
          />
        </div>

        {mostrarAvisos && (
          <>
            <h3>Avisos</h3>
            <div className="folha-config-grupo">
              <Interruptor
                icone={<MdNotificationsActive size={20} />}
                titulo="Avisos de OS nova"
                dica={dicaAvisos}
                ligado={avisosLigados}
                desabilitado={avisos.ocupado || avisos.estado === 'instalar' || avisos.estado === 'sem-suporte'}
                onAlternar={() => {
                  if (avisos.estado === 'bloqueado') return
                  void (avisosLigados ? avisos.desligar() : avisos.ligar())
                }}
              />
            </div>
          </>
        )}

        {(podeInstalar || temNovidades()) && (
          <div className="folha-config-grupo folha-config-acoes">
            {podeInstalar && (
              <button type="button" className="folha-config-linha" onClick={onInstalar}>
                <span className="folha-config-icone">
                  <MdGetApp size={20} />
                </span>
                <span className="folha-config-texto">Instalar app na tela inicial</span>
              </button>
            )}
            {temNovidades() && (
              <button type="button" className="folha-config-linha" onClick={onNovidades}>
                <span className="folha-config-icone">
                  <MdNewReleases size={20} />
                </span>
                <span className="folha-config-texto">Novidades desta versão</span>
              </button>
            )}
          </div>
        )}

        <div className="folha-config-grupo folha-config-acoes">
          <button type="button" className="folha-config-linha folha-config-sair" onClick={onSair}>
            <span className="folha-config-icone">
              <MdLogout size={20} />
            </span>
            <span className="folha-config-texto">Sair da conta</span>
          </button>
        </div>

        <p className="folha-config-versao">App Técnico HOTNET · v{__APP_VERSION__}</p>
      </div>
    </div>
  )
}
