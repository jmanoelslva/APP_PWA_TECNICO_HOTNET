import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import RotaProtegida from './components/RotaProtegida'
import BottomNav from './components/BottomNav'
import StatusBanners from './components/StatusBanners'
import Spinner from './components/Spinner'
import { useSessao } from './auth/useSessao'

// Uma página por chunk — carregada só quando o técnico navega até ela.
const BuscaCliente = lazy(() => import('./pages/BuscaCliente'))
const Conexao = lazy(() => import('./pages/Conexao'))
const DetalheCliente = lazy(() => import('./pages/DetalheCliente'))
const DetalheOS = lazy(() => import('./pages/DetalheOS'))
const Home = lazy(() => import('./pages/Home'))
const Login = lazy(() => import('./pages/Login'))
const OnuStatus = lazy(() => import('./pages/OnuStatus'))
const Suporte = lazy(() => import('./pages/Suporte'))

// Telas onde a barra de navegação não aparece: login (ainda sem sessão) e
// o chat de uma OS (já tem sua própria barra fixa de envio no rodapé).
function mostrarBottomNav(pathname: string): boolean {
  if (pathname === '/login') return false
  if (pathname.startsWith('/suporte/')) return false
  return true
}

function App() {
  const { logado } = useSessao()
  const location = useLocation()

  return (
    <>
      <StatusBanners />
      <Suspense fallback={<Spinner tela />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <RotaProtegida>
                <Home />
              </RotaProtegida>
            }
          />
          <Route
            path="/clientes"
            element={
              <RotaProtegida>
                <BuscaCliente />
              </RotaProtegida>
            }
          />
          <Route
            path="/clientes/:clientPk"
            element={
              <RotaProtegida>
                <DetalheCliente />
              </RotaProtegida>
            }
          />
          <Route
            path="/conexao"
            element={
              <RotaProtegida>
                <Conexao />
              </RotaProtegida>
            }
          />
          <Route
            path="/onu"
            element={
              <RotaProtegida>
                <OnuStatus />
              </RotaProtegida>
            }
          />
          <Route
            path="/suporte"
            element={
              <RotaProtegida>
                <Suporte />
              </RotaProtegida>
            }
          />
          <Route
            path="/suporte/:ticketPk"
            element={
              <RotaProtegida>
                <DetalheOS />
              </RotaProtegida>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>

      {logado && mostrarBottomNav(location.pathname) && <BottomNav />}
    </>
  )
}

export default App
