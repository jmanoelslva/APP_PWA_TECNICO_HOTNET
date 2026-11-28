import { useState } from 'react'
import { LuCopy, LuEye, LuEyeOff } from 'react-icons/lu'
import type { CpeDto } from '../../api/client'
import { useCopiar } from '../../hooks/useCopiar'

/** Login PPPoE do cliente (usuário e senha de internet). */
export default function CardPppoe({ cpe }: { cpe: CpeDto }) {
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const copiar = useCopiar()

  return (
    <div className="conexao-card">
      <h2>Acesso PPPoE (login do cliente)</h2>
      <div className="conexao-campo">
        <span>Usuário</span>
        <div className="conexao-campo-valor">
          <strong>{cpe.username ?? '—'}</strong>
          <button onClick={() => copiar(cpe.username, 'Usuário')} aria-label="Copiar usuário">
            <LuCopy size={16} />
          </button>
        </div>
      </div>
      <div className="conexao-campo">
        <span>Senha</span>
        <div className="conexao-campo-valor">
          <strong>{mostrarSenha ? cpe.password ?? '—' : '••••••••'}</strong>
          <button onClick={() => setMostrarSenha((v) => !v)} aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}>
            {mostrarSenha ? <LuEyeOff size={16} /> : <LuEye size={16} />}
          </button>
          <button onClick={() => copiar(cpe.password, 'Senha')} aria-label="Copiar senha">
            <LuCopy size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
