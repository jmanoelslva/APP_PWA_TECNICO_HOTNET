import { useMemo } from 'react'
import qrcode from 'qrcode-generator'
import { useFecharComVoltar } from '../hooks/useFecharComVoltar'
import { textoQrWifi } from '../utils/wifiQr'
import './ModalQrWifi.css'

/**
 * QR Code do Wi-Fi para o cliente apontar a câmera e conectar sem digitar
 * a senha. Gerado no próprio aparelho (nada sai do app).
 */
export default function ModalQrWifi({
  aberto,
  rede,
  senha,
  onFechar,
}: {
  aberto: boolean
  rede: string
  senha?: string | null
  onFechar: () => void
}) {
  useFecharComVoltar(aberto, onFechar)
  const svg = useMemo(() => {
    if (!aberto) return ''
    qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8']
    const qr = qrcode(0, 'M')
    qr.addData(textoQrWifi(rede, senha))
    qr.make()
    return qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true })
  }, [aberto, rede, senha])
  if (!aberto) return null

  return (
    <div className="modal-qr-wifi-fundo" onClick={onFechar}>
      <div className="modal-qr-wifi" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="QR Code do Wi-Fi">
        <h2>Aponte a câmera do celular</h2>
        {/* SVG montado pela biblioteca a partir dos módulos do QR: sem texto do usuário. */}
        <div className="modal-qr-wifi-codigo" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="modal-qr-wifi-rede">{rede}</p>
        <button className="botao botao-secundario botao-largo" onClick={onFechar}>
          Fechar
        </button>
      </div>
    </div>
  )
}
