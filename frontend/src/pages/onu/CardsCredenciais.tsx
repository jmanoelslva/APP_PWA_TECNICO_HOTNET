import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MdContentCopy, MdVisibility, MdVisibilityOff, MdWifi } from 'react-icons/md'
import type { OnuDto } from '../../api/client'
import { useCopiar } from '../../hooks/useCopiar'

/**
 * PPPoE e Wi-Fi configurados na própria ONU. A senha PPPoE aparece de
 * propósito: o técnico configura o equipamento com ela. Um só "mostrar
 * senha" para os dois cartões.
 */
export default function CardsCredenciais({ onu }: { onu: OnuDto }) {
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const copiar = useCopiar()

  return (
    <>
      {onu.wancfg_pppoe_username && (
        <div className="onu-card">
          <h2>Acesso PPPoE (ONU)</h2>
          <div className="onu-campo">
            <span>Usuário</span>
            <div className="onu-campo-valor">
              <strong>{onu.wancfg_pppoe_username}</strong>
              <Link
                to={`/conexao?username=${encodeURIComponent(onu.wancfg_pppoe_username)}`}
                className="onu-btn-link"
                aria-label="Ver conexão deste usuário"
                viewTransition
              >
                <MdWifi size={16} />
              </Link>
              <button onClick={() => copiar(onu.wancfg_pppoe_username, 'Usuário')} aria-label="Copiar usuário">
                <MdContentCopy size={16} />
              </button>
            </div>
          </div>
          {onu.wancfg_pppoe_passwd && (
            <div className="onu-campo">
              <span>Senha</span>
              <div className="onu-campo-valor">
                <strong>{mostrarSenha ? onu.wancfg_pppoe_passwd : '••••••••'}</strong>
                <button onClick={() => setMostrarSenha((v) => !v)} aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}>
                  {mostrarSenha ? <MdVisibilityOff size={16} /> : <MdVisibility size={16} />}
                </button>
                <button onClick={() => copiar(onu.wancfg_pppoe_passwd, 'Senha')} aria-label="Copiar senha">
                  <MdContentCopy size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {onu.wificfg_name && (
        <div className="onu-card">
          <h2>Wi-Fi</h2>
          <div className="onu-campo">
            <span>Rede (SSID)</span>
            <div className="onu-campo-valor">
              <strong>{onu.wificfg_name}</strong>
              <button onClick={() => copiar(onu.wificfg_name, 'Nome da rede')} aria-label="Copiar nome da rede">
                <MdContentCopy size={16} />
              </button>
            </div>
          </div>
          {onu.wificfg_password && (
            <div className="onu-campo">
              <span>Senha</span>
              <div className="onu-campo-valor">
                <strong>{mostrarSenha ? onu.wificfg_password : '••••••••'}</strong>
                <button onClick={() => setMostrarSenha((v) => !v)} aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}>
                  {mostrarSenha ? <MdVisibilityOff size={16} /> : <MdVisibility size={16} />}
                </button>
                <button onClick={() => copiar(onu.wificfg_password, 'Senha da rede')} aria-label="Copiar senha da rede">
                  <MdContentCopy size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}
