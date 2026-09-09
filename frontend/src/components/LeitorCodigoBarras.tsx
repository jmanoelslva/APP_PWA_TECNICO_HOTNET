import { BrowserMultiFormatReader } from '@zxing/library'
import { useEffect, useRef, useState } from 'react'
import { MdClose, MdQrCodeScanner } from 'react-icons/md'
import './LeitorCodigoBarras.css'

interface Props {
  onDetectado: (valor: string) => void
  onFechar: () => void
}

/**
 * Leitor de código de barras/QR pela câmera — usa @zxing/library (decode
 * via canvas, puro JS) em vez da Barcode Detection API nativa do
 * navegador: essa API não existe no Safari/iOS (só Chrome/Android), e o
 * técnico usa os dois. zxing funciona em qualquer navegador com
 * getUserMedia, iPhone incluído.
 */
export default function LeitorCodigoBarras({ onDetectado, onFechar }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    let jaDetectado = false
    const leitor = new BrowserMultiFormatReader()

    async function iniciar() {
      if (!videoRef.current) return
      try {
        await leitor.decodeFromConstraints({ video: { facingMode: 'environment' } }, videoRef.current, (resultado) => {
          // O callback dispara a CADA frame, mesmo sem achar nada
          // (resultado vem undefined e a "exceção" é só um NotFoundException
          // de rotina) — só interessa aqui o frame que realmente achou algo.
          if (cancelado || jaDetectado || !resultado) return
          jaDetectado = true
          onDetectado(resultado.getText())
        })
      } catch (excecao) {
        if (cancelado) return
        const negada = excecao instanceof DOMException && excecao.name === 'NotAllowedError'
        setErro(
          negada
            ? 'Permissão de câmera negada. Habilite o acesso à câmera para o navegador e tente novamente.'
            : 'Não foi possível acessar a câmera.',
        )
      }
    }

    iniciar()

    return () => {
      cancelado = true
      leitor.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="leitor-codigo-fundo">
      <div className="leitor-codigo-topo">
        <span>
          <MdQrCodeScanner size={18} /> Ler código de barras/QR
        </span>
        <button type="button" className="leitor-codigo-fechar" onClick={onFechar} aria-label="Fechar leitor">
          <MdClose size={22} />
        </button>
      </div>

      {erro ? (
        <div className="leitor-codigo-aviso">
          <p>{erro}</p>
          <button className="botao botao-secundario" onClick={onFechar}>Fechar</button>
        </div>
      ) : (
        <>
          <video ref={videoRef} className="leitor-codigo-video" muted playsInline />
          <p className="leitor-codigo-dica">Aponte a câmera para o código na etiqueta do equipamento.</p>
        </>
      )}
    </div>
  )
}
