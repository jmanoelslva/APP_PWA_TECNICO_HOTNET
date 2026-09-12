import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import RotaProtegida from './components/RotaProtegida'
import BottomNav from './components/BottomNav'
import StatusBanners from './components/StatusBanners'
import Spinner from './components/Spinner'
import { useSessao } from './auth/useSessao'

// Uma página por chunk — carregada só quando o técnico navega até ela.
const BuscaCliente = lazy(() => import('./pages/BuscaCliente'))
const ClientesOffline = lazy(() => import('./pages/ClientesOffline'))
const Conexao = lazy(() => import('./pages/Conexao'))
const DetalheChamado = lazy(() => import('./pages/DetalheChamado'))
const DetalheCliente = lazy(() => import('./pages/DetalheCliente'))
const DetalheOrdemServico = lazy(() => import('./pages/DetalheOrdemServico'))
const Ferramentas = lazy(() => import('./pages/Ferramentas'))
const Financeiro = lazy(() => import('./pages/Financeiro'))
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
            path="/offline"
            element={
              <RotaProtegida>
                <ClientesOffline />
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
                <DetalheChamado />
              </RotaProtegida>
            }
          />
          <Route
            path="/os/:ticketPk"
            element={
              <RotaProtegida>
                <DetalheOrdemServico />
              </RotaProtegida>
            }
          />
          <Route
            path="/ferramentas"
            element={
              <RotaProtegida>
                <Ferramentas />
              </RotaProtegida>
            }
          />
          <Route
            path="/financeiro"
            element={
              <RotaProtegida>
                <Financeiro />
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
