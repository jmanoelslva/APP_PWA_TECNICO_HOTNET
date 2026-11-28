import { LuExternalLink } from 'react-icons/lu'
import { urlRoteador } from '../utils/roteador'

/**
 * IP do cliente com o ícone que abre o roteador no navegador, na porta
 * gravada no acesso ao roteador. Sem IPv4 válido mostra só o texto.
 */
export default function IpComAcesso({ ip, porta }: { ip: string | null | undefined; porta?: number | null }) {
  const url = urlRoteador(ip, porta)
  if (!url) return <>{ip || '—'}</>
  return (
    <span className="ip-com-acesso">
      <span className="ip-com-acesso-texto">{ip}</span>
      <a
        className="botao-icone botao-icone-fantasma ip-com-acesso-botao"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Abrir o roteador em ${url}`}
        title={url}
      >
        <LuExternalLink size={16} />
      </a>
    </span>
  )
}
