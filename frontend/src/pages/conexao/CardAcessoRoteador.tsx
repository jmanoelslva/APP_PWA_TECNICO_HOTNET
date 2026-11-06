import { useState, type CSSProperties } from 'react'
import { LuEye, LuEyeOff, LuSave } from 'react-icons/lu'
import { ApiError, atualizarDetalhesCpe, type CpeDto } from '../../api/client'
import { useToast } from '../../components/Toast/useToast'
import { CORES } from '../../utils/cores'
import CartaoConexao from './CartaoConexao'

/**
 * Credencial diferente do PPPoE — acesso administrativo ao próprio
 * roteador/CPE, não o login de internet do cliente (cpe_access_login/
 * password/port, doc oficial do Controllr). Editável.
 */
export default function CardAcessoRoteador({
  cpe,
  onAtualizado,
}: {
  cpe: CpeDto
  onAtualizado: (parcial: Partial<CpeDto>) => void
}) {
  const { toast } = useToast()
  const [acessoLogin, setAcessoLogin] = useState(cpe.access_login ?? '')
  const [acessoSenha, setAcessoSenha] = useState(cpe.access_password ?? '')
  const [acessoPorta, setAcessoPorta] = useState(cpe.access_port != null ? String(cpe.access_port) : '')
  // Separado do PPPoE — são credenciais diferentes, e um técnico pode
  // querer conferir uma sem revelar a outra sem querer.
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    if (!cpe.pk) return
    setSalvando(true)
    try {
      const porta = acessoPorta.trim() ? Number(acessoPorta.trim()) : undefined
      await atualizarDetalhesCpe(cpe.pk, {
        cpe_access_login: acessoLogin,
        cpe_access_password: acessoSenha,
        cpe_access_port: porta,
        auditoria: {
          cliente: cpe.client_complete_name,
          pppoe: cpe.username,
          login_anterior: cpe.access_login,
          porta_anterior: cpe.access_port,
          senha_acesso_alterada: acessoSenha !== (cpe.access_password ?? ''),
          senha_acesso_anterior: cpe.access_password ?? undefined,
        },
      })
      onAtualizado({ access_login: acessoLogin, access_password: acessoSenha, access_port: porta })
      toast('Acesso ao roteador atualizado.', 'sucesso')
    } catch (excecao) {
      toast(excecao instanceof ApiError ? excecao.message : 'Não foi possível atualizar o acesso ao roteador.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <CartaoConexao titulo="Acesso ao roteador (admin)">
      <div className="conexao-campo">
        <span>Usuário</span>
        <input autoCapitalize="none" autoCorrect="off" spellCheck={false} className="conexao-input" value={acessoLogin} onChange={(e) => setAcessoLogin(e.target.value)} placeholder="Não informado" />
      </div>
      <div className="conexao-campo">
        <span>Senha</span>
        <div className="conexao-campo-valor">
          <input
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="conexao-input"
            type={mostrarSenha ? 'text' : 'password'}
            value={acessoSenha}
            onChange={(e) => setAcessoSenha(e.target.value)}
            placeholder="Não informado"
          />
          <button
            onClick={() => setMostrarSenha((v) => !v)}
            aria-label={mostrarSenha ? 'Ocultar senha do roteador' : 'Mostrar senha do roteador'}
          >
            {mostrarSenha ? <LuEyeOff size={16} /> : <LuEye size={16} />}
          </button>
        </div>
      </div>
      <div className="conexao-campo">
        <span>Porta</span>
        <input
          className="conexao-input"
          type="number"
          value={acessoPorta}
          onChange={(e) => setAcessoPorta(e.target.value)}
          placeholder="Não informado"
        />
      </div>
      <button aria-busy={salvando}
        className="botao botao-secundario botao-pequeno botao-largo"
        style={{ '--botao-cor': CORES.conexao } as CSSProperties}
        onClick={salvar}
        disabled={salvando}
      >
        <LuSave size={16} /> {salvando ? 'Salvando…' : 'Salvar acesso'}
      </button>
    </CartaoConexao>
  )
}
