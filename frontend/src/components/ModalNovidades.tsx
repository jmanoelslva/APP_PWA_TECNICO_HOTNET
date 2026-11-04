import { useMemo } from 'react'
import { lerNovidades } from '../utils/novidades'
import './FolhaConfiguracoes.css'
import './ModalNovidades.css'

/**
 * O que mudou nesta atualização, lido do CHANGELOG no build (ver
 * vite.config.ts). Abre sozinho uma vez depois de atualizar (Home.tsx) e
 * também por Configurações → Novidades.
 */
export default function ModalNovidades({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const grupos = useMemo(() => (__NOVIDADES__ ? lerNovidades(__NOVIDADES__.texto) : []), [])
  if (!aberto || !__NOVIDADES__ || grupos.length === 0) return null

  return (
    <div className="folha-config-fundo" onClick={onFechar}>
      <div
        className="folha-config novidades"
        role="dialog"
        aria-modal="true"
        aria-labelledby="novidades-titulo"
        onClick={(evento) => evento.stopPropagation()}
      >
        <h2 id="novidades-titulo">{__NOVIDADES__.titulo}</h2>
        {grupos.map((grupo) => (
          <section key={grupo.titulo}>
            <h3>{grupo.titulo}</h3>
            <ul className="novidades-lista">
              {grupo.itens.map((item, indice) => (
                <li key={indice}>
                  {item.destaque && <strong>{item.destaque}</strong>}
                  <span>{item.texto}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <button type="button" className="botao botao-primario botao-bloco novidades-ok" onClick={onFechar}>
          Entendi
        </button>
      </div>
    </div>
  )
}

/** Há novidades para mostrar neste build. */
export function temNovidades(): boolean {
  return !!__NOVIDADES__ && lerNovidades(__NOVIDADES__.texto).length > 0
}
