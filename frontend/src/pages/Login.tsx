import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { MdAccountCircle, MdGetApp, MdLock, MdVisibility, MdVisibilityOff } from 'react-icons/md'
import { useSessao } from '../auth/useSessao'
import ModalInstalarIos from '../components/ModalInstalarIos'
import { usePwaInstall } from '../hooks/usePwaInstall'
import './Login.css'

export default function Login() {
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const { entrar, carregando, erro } = useSessao()
  const navigate = useNavigate()
  const { podeInstalar, podeInstalarIos, aoClicarInstalar, modalIosAberto, fecharModalIos } = usePwaInstall()

  // Em iOS não existe prompt automático do navegador (ver usePwaInstall.ts)
  // — esse é o jeito de aparecer "sozinho" logo na tela de login.
  useEffect(() => {
    if (!podeInstalarIos) return
    aoClicarInstalar()
  }, [podeInstalarIos, aoClicarInstalar])

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    const sucesso = await entrar(usuario, senha)
    if (sucesso) navigate('/', { viewTransition: true })
  }

  return (
    <div className="login-tela tela-entrada">
      <div className="login-card">
        <div className="login-marca">
          <img className="login-marca-logo" src="/icons/icon-512.png" alt="HOTNET" />
          <strong>HOTNET</strong>
        </div>

        <form onSubmit={aoEnviar}>
          <label htmlFor="usuario">
            <MdAccountCircle className="login-label-icone" /> Usuário
          </label>
          <input
            id="usuario"
            type="text"
            value={usuario}
            onChange={(evento) => setUsuario(evento.target.value)}
            placeholder="Seu usuário de acesso"
            autoComplete="username"
            required
          />

          <label htmlFor="senha">
            <MdLock className="login-label-icone" /> Senha
          </label>
          <div className="login-campo-senha">
            <input
              id="senha"
              type={mostrarSenha ? 'text' : 'password'}
              value={senha}
              onChange={(evento) => setSenha(evento.target.value)}
              placeholder="Digite sua senha"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="login-toggle-senha"
              onClick={() => setMostrarSenha((v) => !v)}
              aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {mostrarSenha ? <MdVisibilityOff size={20} /> : <MdVisibility size={20} />}
            </button>
          </div>

          {erro && <p className="login-erro">{erro}</p>}

          <button type="submit" className="login-btn-entrar" disabled={carregando}>
            {carregando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        {podeInstalar && (
          <button type="button" className="login-btn-instalar" onClick={aoClicarInstalar}>
            <MdGetApp size={18} /> Instalar app
          </button>
        )}

        <p className="login-versao">v{__APP_VERSION__}</p>
      </div>

      <ModalInstalarIos aberto={modalIosAberto} onFechar={fecharModalIos} />
    </div>
  )
}
