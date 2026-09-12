/**
 * Barcode Detection API — não faz parte do lib.dom.d.ts do TypeScript
 * (TS 6.0.3 não declara "BarcodeDetector"), embora seja suportada em
 * Chrome/Android (usado no leitor de código de barras/QR da tela de
 * ONU, ver LeitorCodigoBarras.tsx). Declaração mínima, só com o que o
 * app usa.
 */
interface DetectedBarcode {
  rawValue: string
  format: string
}

declare class BarcodeDetector {
  constructor(options?: { formats?: string[] })
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>
}

interface Window {
  BarcodeDetector?: typeof BarcodeDetector
}
