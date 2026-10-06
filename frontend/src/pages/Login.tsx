import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MdAccountCircle,
  MdDarkMode,
  MdErrorOutline,
  MdGetApp,
  MdKeyboardCapslock,
  MdLightMode,
  MdLock,
  MdTimer,
  MdVisibility,
  MdVisibilityOff,
} from 'react-icons/md'
import { useSessao } from '../auth/useSessao'
import ModalInstalarIos from '../components/ModalInstalarIos'
import { usePwaInstall } from '../hooks/usePwaInstall'
import { useTema } from '../hooks/useTema'
import './Login.css'

type Campo = 'usuario' | 'senha'

// Mensagem do backend quando o limite de tentativas bloqueou o login
// (backend/app/routers/auth.py): mostrada como aviso de espera, não como erro.
function ehBloqueio(mensagem: string): boolean {
  return mensagem.startsWith('Muitas tentativas')
}

export default function Login() {
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  // Campos deixados em branco ao tentar entrar (aviso no próprio campo, no
  // lugar do balão do navegador).
  const [vazios, setVazios] = useState<Set<Campo>>(new Set())
  // O erro do login some quando o técnico começa a corrigir.
  const [editouDepoisDoErro, setEditouDepoisDoErro] = useState(false)
  const senhaRef = useRef<HTMLInputElement>(null)
  const usuarioRef = useRef<HTMLInputElement>(null)
  const { entrar, carregando, erro } = useSessao()
  const navigate = useNavigate()
  const { tema, alternarTema } = useTema()
  const { podeInstalar, podeInstalarIos, aoClicarInstalar, modalIosAberto, fecharModalIos } = usePwaInstall()

  // Em iOS não existe prompt automático do navegador (ver usePwaInstall.ts)
  // — esse é o jeito de aparecer "sozinho" logo na tela de login.
  useEffect(() => {
    if (!podeInstalarIos) return
    aoClicarInstalar()
  }, [podeInstalarIos, aoClicarInstalar])

  function alterar(campo: Campo, valor: string) {
    if (campo === 'usuario') setUsuario(valor)
    else setSenha(valor)
    setEditouDepoisDoErro(true)
    if (valor && vazios.has(campo)) {
      const resto = new Set(vazios)
      resto.delete(campo)
      setVazios(resto)
    }
  }

  // Caps Lock: só teclado físico informa (no celular fica sempre falso).
  function conferirCapsLock(evento: KeyboardEvent<HTMLInputElement>) {
    setCapsLock(evento.getModifierState?.('CapsLock') ?? false)
  }

  // Enter no usuário vai para a senha, em vez de tentar entrar sem ela.
  function aoTeclarUsuario(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'Enter' && !senha) {
      evento.preventDefault()
      senhaRef.current?.focus()
    }
  }

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    const faltando = new Set<Campo>()
    if (!usuario.trim()) faltando.add('usuario')
    if (!senha) faltando.add('senha')
    setVazios(faltando)
    if (faltando.size > 0) {
      ;(faltando.has('usuario') ? usuarioRef : senhaRef).current?.focus()
      return
    }
    setEditouDepoisDoErro(false)
    const sucesso = await entrar(usuario, senha)
    if (!sucesso) return
    // Veio do Coletor de OLTs (/olt/) sem sessão: volta para onde estava.
    // Só aceita caminhos do coletor, para o parâmetro não virar um
    // redirecionamento para qualquer lugar.
    const voltar = new URLSearchParams(window.location.search).get('voltar')
    if (voltar && /^\/olt(\/|$)/.test(voltar) && !voltar.startsWith('//')) {
      window.location.assign(voltar)
      return
    }
    navigate('/', { viewTransition: true })
  }

  const erroVisivel = erro && !editouDepoisDoErro ? erro : null

  return (
    <div className="login-tela tela-entrada">
      <button
        type="button"
        className="login-tema"
        onClick={alternarTema}
        aria-label={tema === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
        title={tema === 'dark' ? 'Tema claro' : 'Tema escuro'}
      >
        {tema === 'dark' ? <MdLightMode size={20} /> : <MdDarkMode size={20} />}
      </button>

      <div className="login-card">
        <div className="login-marca">
          <img className="login-marca-logo" src="/icons/icon-512.png" alt="" />
          <strong>HOTNET</strong>
          <span className="login-marca-sub">Acesso do técnico</span>
        </div>

        <form onSubmit={aoEnviar} noValidate>
          <fieldset disabled={carregando} className="login-campos">
            <label htmlFor="usuario">
              <MdAccountCircle className="login-label-icone" /> Usuário
            </label>
            <input
              ref={usuarioRef}
              id="usuario"
              type="text"
              value={usuario}
              onChange={(evento) => alterar('usuario', evento.target.value)}
              onKeyDown={aoTeclarUsuario}
              placeholder="Seu usuário de acesso"
              autoComplete="username"
              // Teclado do celular não pode pôr maiúscula nem "corrigir" o login.
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              aria-invalid={vazios.has('usuario')}
              aria-describedby={vazios.has('usuario') ? 'usuario-vazio' : undefined}
            />
            {vazios.has('usuario') && (
              <span id="usuario-vazio" className="login-campo-aviso">
                Informe o usuário.
              </span>
            )}

            <label htmlFor="senha">
              <MdLock className="login-label-icone" /> Senha
            </label>
            <div className="login-campo-senha">
              <input
                ref={senhaRef}
                id="senha"
                type={mostrarSenha ? 'text' : 'password'}
                value={senha}
                onChange={(evento) => alterar('senha', evento.target.value)}
                onKeyDown={conferirCapsLock}
                onKeyUp={conferirCapsLock}
                onBlur={() => setCapsLock(false)}
                placeholder="Digite sua senha"
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
                aria-invalid={vazios.has('senha')}
                aria-describedby={vazios.has('senha') ? 'senha-vazia' : undefined}
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
            {vazios.has('senha') && (
              <span id="senha-vazia" className="login-campo-aviso">
                Informe a senha.
              </span>
            )}
            {capsLock && (
              <span className="login-capslock" role="status">
                <MdKeyboardCapslock size={16} /> Caps Lock ligado
              </span>
            )}
          </fieldset>

          {erroVisivel && (
            <div className={`login-mensagem${ehBloqueio(erroVisivel) ? ' login-mensagem-espera' : ''}`} role="alert">
              {ehBloqueio(erroVisivel) ? <MdTimer size={20} /> : <MdErrorOutline size={20} />}
              <span>{erroVisivel}</span>
            </div>
          )}

          <button type="submit" className="login-btn-entrar" disabled={carregando}>
            {carregando && <span className="login-girando" aria-hidden="true" />}
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
