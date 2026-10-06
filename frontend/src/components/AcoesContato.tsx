import { FaWhatsapp } from 'react-icons/fa'
import { MdPhone } from 'react-icons/md'
import { linkLigar, linkWhatsapp } from '../utils/formatacao'
import './AcoesContato.css'

/** Botões "Ligar" e "WhatsApp" (só para celular) de um número. */
export default function AcoesContato({ numero }: { numero: string | null | undefined }) {
  const ligar = linkLigar(numero)
  const whatsapp = linkWhatsapp(numero)
  if (!ligar) return null
  return (
    <div className="acoes-contato">
      <a href={ligar} className="acoes-contato-botao" aria-label="Ligar">
        <MdPhone size={16} /> Ligar
      </a>
      {whatsapp && (
        <a href={whatsapp} target="_blank" rel="noreferrer" className="acoes-contato-botao acoes-contato-whatsapp" aria-label="WhatsApp">
          <FaWhatsapp size={16} /> WhatsApp
        </a>
      )}
    </div>
  )
}
