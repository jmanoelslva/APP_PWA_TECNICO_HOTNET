import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // VitePWA precisa estar registrado aqui só para "virtual:pwa-register/react"
  // (usado em StatusBanners.tsx) existir como módulo resolvível — o teste
  // mocka o hook em si (vi.mock), não depende do plugin gerar nada de verdade.
  plugins: [react(), VitePWA({ injectRegister: false })],
  // Constantes que o vite.config.ts injeta no build.
  define: {
    __APP_VERSION__: JSON.stringify('0.0.0-teste'),
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
