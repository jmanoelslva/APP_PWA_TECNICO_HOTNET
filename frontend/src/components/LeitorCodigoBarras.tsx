import { useEffect, useRef, useState } from 'react'
import { MdClose, MdQrCodeScanner } from 'react-icons/md'
import './LeitorCodigoBarras.css'

interface Props {
  onDetectado: (valor: string) => void
  onFechar: () => void
}

// Formatos usados nas etiquetas de ONU/equipamento — Code128/Code39 nos
// modelos mais antigos, QR nos mais novos. EAN/UPC entram de brinde
// (mesma detecção, sem custo extra) caso apareça outro tipo de etiqueta.
const FORMATOS_SUPORTADOS = ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'codabar', 'itf']

const INTERVALO_LEITURA_MS = 300

/**
 * Leitor de código de barras/QR pela câmera — usa a Barcode Detection API
 * nativa (Chrome/Android, sem biblioteca externa: ver
 * src/types/barcode-detector.d.ts). Sem suporte no navegador, mostra
 * aviso e permite só fechar — o técnico continua podendo digitar o
 * serial manualmente no campo de busca.
 */
export default function LeitorCodigoBarras({ onDetectado, onFechar }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const suportado = typeof window !== 'undefined' && !!window.BarcodeDetector

  useEffect(() => {
    if (!suportado) return

    let cancelado = false
    let jaDetectado = false
    let temporizador: ReturnType<typeof setInterval> | null = null
    const detector = new BarcodeDetector({ formats: FORMATOS_SUPORTADOS })

    async function iniciar() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (cancelado) {
          stream.getTracks().forEach((faixa) => faixa.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        temporizador = setInterval(async () => {
          if (!videoRef.current || jaDetectado) return
          try {
            const codigos = await detector.detect(videoRef.current)
            if (codigos.length > 0 && !cancelado && !jaDetectado) {
              jaDetectado = true
              onDetectado(codigos[0].rawValue)
            }
          } catch {
            // Um frame ruim de vez em quando não é motivo pra parar de tentar.
          }
        }, INTERVALO_LEITURA_MS)
      } catch (excecao) {
        if (cancelado) return
        const negada = excecao instanceof DOMException && excecao.name === 'NotAllowedError'
        setErro(negada ? 'Permissão de câmera negada. Habilite o acesso à câmera para o navegador e tente novamente.' : 'Não foi possível acessar a câmera.')
      }
    }

    iniciar()

    return () => {
      cancelado = true
      if (temporizador) clearInterval(temporizador)
      streamRef.current?.getTracks().forEach((faixa) => faixa.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suportado])

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

      {!suportado && (
        <div className="leitor-codigo-aviso">
          <p>Este navegador não é compatível com leitura de código pela câmera.</p>
          <button className="botao botao-secundario" onClick={onFechar}>Fechar</button>
        </div>
      )}

      {suportado && erro && (
        <div className="leitor-codigo-aviso">
          <p>{erro}</p>
          <button className="botao botao-secundario" onClick={onFechar}>Fechar</button>
        </div>
      )}

      {suportado && !erro && (
        <>
          <video ref={videoRef} className="leitor-codigo-video" muted playsInline />
          <p className="leitor-codigo-dica">Aponte a câmera para o código na etiqueta do equipamento.</p>
        </>
      )}
    </div>
  )
}
