import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MdCable, MdContentCopy, MdVisibility, MdVisibilityOff } from 'react-icons/md'
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
          {cpe.username && (
            <Link to={`/onu?username=${encodeURIComponent(cpe.username)}`} className="conexao-btn-link" aria-label="Ver ONU deste usuário" viewTransition>
              <MdCable size={16} />
            </Link>
          )}
          <button onClick={() => copiar(cpe.username, 'Usuário')} aria-label="Copiar usuário">
            <MdContentCopy size={16} />
          </button>
        </div>
      </div>
      <div className="conexao-campo">
        <span>Senha</span>
        <div className="conexao-campo-valor">
          <strong>{mostrarSenha ? cpe.password ?? '—' : '••••••••'}</strong>
          <button onClick={() => setMostrarSenha((v) => !v)} aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}>
            {mostrarSenha ? <MdVisibilityOff size={16} /> : <MdVisibility size={16} />}
          </button>
          <button onClick={() => copiar(cpe.password, 'Senha')} aria-label="Copiar senha">
            <MdContentCopy size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
