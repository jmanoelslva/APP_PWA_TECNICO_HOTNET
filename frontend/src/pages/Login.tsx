import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LuArrowBigUp,
  LuArrowRight,
  LuCircleAlert,
  LuDownload,
  LuEye,
  LuEyeOff,
  LuLock,
  LuMoon,
  LuArrowLeftRight,
  LuSun,
  LuTimer,
  LuUser,
} from 'react-icons/lu'
import { useSessao } from '../auth/useSessao'
import ModalInstalarIos from '../components/ModalInstalarIos'
import { usePwaInstall } from '../hooks/usePwaInstall'
import { useTema } from '../hooks/useTema'
import './Login.css'

type Campo = 'usuario' | 'senha'
// Login em duas etapas: o usuário (só quando o aparelho não lembra nenhum)
// e a senha ("Olá, fulano" + senha).
type Etapa = 'usuario' | 'senha'

// Mensagem do backend quando o limite de tentativas bloqueou o login
// (backend/app/routers/auth.py): mostrada como aviso de espera, não como erro.
function ehBloqueio(mensagem: string): boolean {
  return mensagem.startsWith('Muitas tentativas')
}

// "Lembrar meu usuário": só o nome de usuário fica no aparelho, nunca a senha.
const CHAVE_USUARIO = 'hotnet-tecnico-usuario-lembrado'

// Suporte de acesso (troca de senha é feita no Controllr pelo escritório).
const WHATSAPP_SUPORTE = '5582981414870'

export function linkSuporte(motivo: 'senha' | 'acesso', usuario: string): string {
  const quem = usuario.trim() ? ` (usuário: ${usuario.trim()})` : ''
  const texto =
    motivo === 'senha'
      ? `Olá! Esqueci minha senha do app do técnico${quem}.`
      : `Olá! Estou com problema para acessar o app do técnico${quem}.`
  return `https://wa.me/${WHATSAPP_SUPORTE}?text=${encodeURIComponent(texto)}`
}

function lerUsuarioLembrado(): string {
  try {
    return localStorage.getItem(CHAVE_USUARIO) ?? ''
  } catch {
    return ''
  }
}

function salvarUsuarioLembrado(usuario: string | null) {
  try {
    if (usuario) localStorage.setItem(CHAVE_USUARIO, usuario)
    else localStorage.removeItem(CHAVE_USUARIO)
  } catch {
    // sem armazenamento: só não lembra
  }
}

/**
 * Área visível acima do teclado. No Android (Chrome) e no iPhone o teclado
 * cobre a página sem encolhê-la; a tela de login segue o visualViewport
 * para tudo caber no que sobra e o Entrar poder ficar à vista.
 */
function useAreaVisivel(): { estilo: CSSProperties | undefined; altura: number | null } {
  const [area, setArea] = useState<{ altura: number; topo: number } | null>(null)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const atualizar = () => setArea({ altura: vv.height, topo: vv.offsetTop })
    atualizar()
    vv.addEventListener('resize', atualizar)
    vv.addEventListener('scroll', atualizar)
    return () => {
      vv.removeEventListener('resize', atualizar)
      vv.removeEventListener('scroll', atualizar)
    }
  }, [])
  if (!area) return { estilo: undefined, altura: null }
  return {
    estilo: { '--login-altura': `${area.altura}px`, '--login-topo': `${area.topo}px` } as CSSProperties,
    altura: area.altura,
  }
}

export default function Login() {
  const [usuario, setUsuario] = useState(lerUsuarioLembrado)
  const [etapa, setEtapa] = useState<Etapa>(() => (usuario ? 'senha' : 'usuario'))
  const [lembrar, setLembrar] = useState(true)
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  // Campos deixados em branco ao tentar seguir (aviso no próprio campo, no
  // lugar do balão do navegador).
  const [vazios, setVazios] = useState<Set<Campo>>(new Set())
  // O erro do login some quando o técnico começa a corrigir.
  const [editouDepoisDoErro, setEditouDepoisDoErro] = useState(false)
  const senhaRef = useRef<HTMLInputElement>(null)
  const usuarioRef = useRef<HTMLInputElement>(null)
  const entrarRef = useRef<HTMLButtonElement>(null)
  const { entrar, carregando, erro } = useSessao()
  const navigate = useNavigate()
  const { tema, alternarTema } = useTema()
  const { podeInstalar, podeInstalarIos, aoClicarInstalar, modalIosAberto, fecharModalIos } = usePwaInstall()
  const { estilo: estiloArea, altura: alturaVisivel } = useAreaVisivel()

  // Ao sair (ou com a sessão encerrada), as telas visitadas continuam no
  // histórico atrás do login: o "voltar" do Android passava por elas (cada
  // uma redireciona de novo para cá) em vez de fechar o app. Volta para a
  // primeira entrada do app nesta aba — o React Router guarda a posição em
  // history.state.idx — e ela redireciona para o login com replace; aí o
  // "voltar" fecha o app. Com ?voltar= (veio do Coletor de OLTs) não mexe,
  // para não perder o destino.
  const voltouAoInicio = useRef(false)
  useEffect(() => {
    if (voltouAoInicio.current) return
    const posicao = (window.history.state as { idx?: number } | null)?.idx ?? 0
    const temVoltar = new URLSearchParams(window.location.search).has('voltar')
    if (posicao > 0 && !temVoltar) {
      voltouAoInicio.current = true
      window.history.go(-posicao)
    }
  }, [])

  // O cursor vai para o campo da etapa (com usuário lembrado, já na senha).
  useEffect(() => {
    ;(etapa === 'senha' ? senhaRef : usuarioRef).current?.focus()
  }, [etapa])

  // Teclado abriu (área visível mudou) com um campo em foco: rola até o
  // botão Entrar ficar à vista, logo acima do teclado.
  useEffect(() => {
    const foco = document.activeElement
    if (!foco || (foco !== senhaRef.current && foco !== usuarioRef.current)) return
    const quadro = requestAnimationFrame(() => entrarRef.current?.scrollIntoView?.({ block: 'nearest' }))
    return () => cancelAnimationFrame(quadro)
  }, [alturaVisivel])

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

  function trocarUsuario() {
    setSenha('')
    setVazios(new Set())
    setEditouDepoisDoErro(true)
    setEtapa('usuario')
  }

  async function fazerLogin(login: string, senhaLogin: string) {
    setVazios(new Set())
    setEditouDepoisDoErro(false)
    const sucesso = await entrar(login, senhaLogin)
    if (!sucesso) return
    salvarUsuarioLembrado(lembrar ? login : null)
    // Veio do Coletor de OLTs (/olt/) sem sessão: volta para onde estava.
    // Só aceita caminhos do coletor, para o parâmetro não virar um
    // redirecionamento para qualquer lugar.
    const voltar = new URLSearchParams(window.location.search).get('voltar')
    if (voltar && /^\/olt(\/|$)/.test(voltar) && !voltar.startsWith('//')) {
      window.location.assign(voltar)
      return
    }
    // replace: o login sai do histórico — "voltar" na tela inicial fecha o
    // app em vez de mostrar o login de novo com a sessão aberta.
    navigate('/', { replace: true, viewTransition: true })
  }

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    if (etapa === 'usuario') {
      if (!usuario.trim()) {
        setVazios(new Set<Campo>(['usuario']))
        usuarioRef.current?.focus()
        return
      }
      setVazios(new Set())
      setUsuario(usuario.trim())
      setEtapa('senha')
      return
    }
    if (!senha) {
      setVazios(new Set<Campo>(['senha']))
      senhaRef.current?.focus()
      return
    }
    await fazerLogin(usuario.trim(), senha)
  }

  const erroVisivel = etapa === 'senha' && erro && !editouDepoisDoErro ? erro : null

  return (
    <div className="login-tela tela-entrada" style={estiloArea}>
      <div className="login-rolagem">
        <header className="login-cabecalho">
          <div className="login-cabecalho-linha">
            <strong className="login-cabecalho-nome">HOTNET</strong>
            <span className="login-selo">Área do Técnico</span>
          </div>
          {/* Desenho do técnico grande no meio do laranja (preenche o espaço
              acima do formulário, que fica embaixo para o polegar). */}
          <div className="login-cabecalho-centro">
            <img className="login-cabecalho-logo" src="/icons/icon-512.png" alt="" />
          </div>
          {etapa === 'senha' ? (
            <>
              {/* Trocar de usuário: só o ícone de troca ao lado do nome (outra pessoa
                  usando o mesmo celular). */}
              <h1 className="login-titulo">
                <span>Olá, {usuario}</span>
                <button
                  type="button"
                  className="login-trocar"
                  onClick={trocarUsuario}
                  aria-label="Trocar usuário"
                  title="Trocar usuário"
                >
                  <LuArrowLeftRight size={18} />
                </button>
              </h1>
            </>
          ) : (
            <h1 className="login-titulo">Bem-vindo de volta</h1>
          )}
        </header>

        <form className="login-cartao" onSubmit={aoEnviar} noValidate>
          <fieldset disabled={carregando} className="login-campos">
            {etapa === 'usuario' ? (
              <div className="login-campo">
                <label htmlFor="usuario">Usuário</label>
                <div className="login-entrada">
                  <LuUser className="login-entrada-icone" aria-hidden="true" />
                  <input
                    ref={usuarioRef}
                    id="usuario"
                    type="text"
                    value={usuario}
                    onChange={(evento) => alterar('usuario', evento.target.value)}
                    placeholder="Seu login do sistema"
                    autoComplete="username"
                    // Teclado do celular não pode pôr maiúscula nem "corrigir" o login.
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="next"
                    aria-invalid={vazios.has('usuario')}
                    aria-describedby={vazios.has('usuario') ? 'usuario-vazio' : undefined}
                  />
                </div>
                {vazios.has('usuario') && (
                  <span id="usuario-vazio" className="login-campo-aviso">
                    Informe o usuário.
                  </span>
                )}
              </div>
            ) : (
              <div className="login-campo">
                {/* Usuário no formulário (escondido) para o gerenciador de
                    senhas do celular reconhecer e preencher o par. */}
                <input
                  className="login-usuario-oculto"
                  type="text"
                  name="username"
                  autoComplete="username"
                  value={usuario}
                  readOnly
                  tabIndex={-1}
                  aria-hidden="true"
                />
                <label htmlFor="senha">Senha</label>
                <div className="login-entrada">
                  <LuLock className="login-entrada-icone" aria-hidden="true" />
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
                    className="login-olho"
                    onClick={() => setMostrarSenha((v) => !v)}
                    aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {mostrarSenha ? <LuEyeOff size={20} /> : <LuEye size={20} />}
                  </button>
                </div>
                {vazios.has('senha') && (
                  <span id="senha-vazia" className="login-campo-aviso">
                    Informe a senha.
                  </span>
                )}
                {capsLock && (
                  <span className="login-capslock" role="status">
                    <LuArrowBigUp size={16} /> Caps Lock ligado
                  </span>
                )}
              </div>
            )}

            <div className="login-linha-opcoes">
              <label className="login-lembrar">
                <input type="checkbox" checked={lembrar} onChange={(evento) => setLembrar(evento.target.checked)} />
                Lembrar meu usuário
              </label>
              <a className="login-link" href={linkSuporte('senha', usuario)} target="_blank" rel="noreferrer">
                Esqueci minha senha
              </a>
            </div>
          </fieldset>

          {erroVisivel && (
            <div className={`login-mensagem${ehBloqueio(erroVisivel) ? ' login-mensagem-espera' : ''}`} role="alert">
              {ehBloqueio(erroVisivel) ? <LuTimer size={20} /> : <LuCircleAlert size={20} />}
              <span>{erroVisivel}</span>
            </div>
          )}

          <button ref={entrarRef} type="submit" className="login-btn-entrar" disabled={carregando}>
            {carregando && <span className="login-girando" aria-hidden="true" />}
            {carregando ? 'Entrando…' : etapa === 'usuario' ? 'Continuar' : 'Entrar'}
            {!carregando && <LuArrowRight size={20} aria-hidden="true" />}
          </button>

          <footer className="login-rodape">
            <p>
              Problemas para acessar?{' '}
              <a className="login-link" href={linkSuporte('acesso', usuario)} target="_blank" rel="noreferrer">
                Fale com o suporte
              </a>
            </p>
            <div className="login-rodape-linha">
              <span className="login-versao">Versão {__APP_VERSION__}</span>
              <span className="login-rodape-acoes">
                {podeInstalar && (
                  <button type="button" className="login-btn-instalar" onClick={aoClicarInstalar}>
                    <LuDownload size={18} /> Instalar app
                  </button>
                )}
                <button
                  type="button"
                  className="login-tema"
                  onClick={alternarTema}
                  aria-label={tema === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
                  title={tema === 'dark' ? 'Tema claro' : 'Tema escuro'}
                >
                  {tema === 'dark' ? <LuSun size={20} /> : <LuMoon size={20} />}
                </button>
              </span>
            </div>
          </footer>
        </form>
      </div>

      <ModalInstalarIos aberto={modalIosAberto} onFechar={fecharModalIos} />
    </div>
  )
}
