import { FaWhatsapp } from 'react-icons/fa'
import { MdPhone } from 'react-icons/md'
import { formatarTelefone, linkLigar, linkWhatsapp, separarTelefones } from '../utils/formatacao'
import './AcoesContato.css'

/**
 * Botões "Ligar" e "WhatsApp" (só para celular). Aceita um texto com mais de
 * um número ("79999887766 / 7932221100"): cada número ganha os seus botões,
 * com o número escrito para saber qual é qual.
 */
export default function AcoesContato({ numero }: { numero: string | null | undefined }) {
  const numeros = separarTelefones(numero)
  const varios = numeros.length > 1
  if (numeros.length === 0) return null
  return (
    <div className="acoes-contato">
      {numeros.map((n) => {
        const ligar = linkLigar(n)
        const whatsapp = linkWhatsapp(n)
        if (!ligar) return null
        const sufixo = varios ? ` ${formatarTelefone(n)}` : ''
        return (
          <div key={n} className="acoes-contato-numero">
            <a href={ligar} className="acoes-contato-botao" aria-label={`Ligar${sufixo}`}>
              <MdPhone size={16} /> Ligar{sufixo}
            </a>
            {whatsapp && (
              <a
                href={whatsapp}
                target="_blank"
                rel="noreferrer"
                className="acoes-contato-botao acoes-contato-whatsapp"
                aria-label={`WhatsApp${sufixo}`}
              >
                <FaWhatsapp size={16} /> WhatsApp
              </a>
            )}
          </div>
        )
      })}
    </div>
  )
}
