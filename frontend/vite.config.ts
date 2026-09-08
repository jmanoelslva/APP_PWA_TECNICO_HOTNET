import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registro manual via useRegisterSW (StatusBanners.tsx) — mesmo
      // motivo do app cliente: skipWaiting/clientsClaim trocam o service
      // worker sozinhos, mas isso não troca os módulos JS já carregados
      // numa aba aberta, então ainda é preciso avisar e deixar o técnico
      // decidir a hora de recarregar.
      injectRegister: false,
      workbox: {
        // Nunca cachear /api/* — dados dinâmicos e ligados à sessão do
        // técnico (clientes, OS, conexão, ONU).
        navigateFallbackDenylist: [/^\/api\//],
        skipWaiting: true,
        clientsClaim: true,
      },
      manifest: {
        name: 'HOTNET',
        short_name: 'HOTNET',
        description: 'Ferramentas de campo para técnicos HOTNET: dados de cliente, endereço, conexão, ONU e OS.',
        lang: 'pt-BR',
        start_url: '/',
        display: 'standalone',
        background_color: '#f5f5f5',
        theme_color: '#2a72b8',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: {
    // Escuta em todas as interfaces de rede — dá para abrir o app a partir
    // do celular do técnico na mesma Wi-Fi usando o IP local da máquina.
    host: true,
    proxy: {
      // Em desenvolvimento, o navegador só fala com o Vite — ele repassa
      // para o backend FastAPI local. Sem cookieDomainRewrite/xfwd: aqui é
      // proxy simples para o NOSSO backend (não o Controllr direto), que já
      // roda na mesma máquina.
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
