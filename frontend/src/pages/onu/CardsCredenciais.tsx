import { useState } from 'react'
import { LuCopy, LuEye, LuEyeOff, LuQrCode } from 'react-icons/lu'
import { FaWhatsapp } from 'react-icons/fa'
import type { OnuDto } from '../../api/client'
import { useCopiar } from '../../hooks/useCopiar'
import { mensagemWifi } from '../../utils/wifiQr'
import ModalQrWifi from '../../components/ModalQrWifi'

/**
 * PPPoE e Wi-Fi configurados na própria ONU. A senha PPPoE aparece de
 * propósito: o técnico configura o equipamento com ela. Um só "mostrar
 * senha" para os dois cartões.
 */
export default function CardsCredenciais({ onu }: { onu: OnuDto }) {
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [qrAberto, setQrAberto] = useState(false)
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
              <button onClick={() => copiar(onu.wancfg_pppoe_username, 'Usuário')} aria-label="Copiar usuário">
                <LuCopy size={16} />
              </button>
            </div>
          </div>
          {onu.wancfg_pppoe_passwd && (
            <div className="onu-campo">
              <span>Senha</span>
              <div className="onu-campo-valor">
                <strong>{mostrarSenha ? onu.wancfg_pppoe_passwd : '••••••••'}</strong>
                <button onClick={() => setMostrarSenha((v) => !v)} aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}>
                  {mostrarSenha ? <LuEyeOff size={16} /> : <LuEye size={16} />}
                </button>
                <button onClick={() => copiar(onu.wancfg_pppoe_passwd, 'Senha')} aria-label="Copiar senha">
                  <LuCopy size={16} />
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
                <LuCopy size={16} />
              </button>
            </div>
          </div>
          {onu.wificfg_password && (
            <div className="onu-campo">
              <span>Senha</span>
              <div className="onu-campo-valor">
                <strong>{mostrarSenha ? onu.wificfg_password : '••••••••'}</strong>
                <button onClick={() => setMostrarSenha((v) => !v)} aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}>
                  {mostrarSenha ? <LuEyeOff size={16} /> : <LuEye size={16} />}
                </button>
                <button onClick={() => copiar(onu.wificfg_password, 'Senha da rede')} aria-label="Copiar senha da rede">
                  <LuCopy size={16} />
                </button>
              </div>
            </div>
          )}
          {/* Para o cliente: conectar pela câmera ou receber os dados no WhatsApp. */}
          <div className="acoes-cartao">
            <button type="button" className="botao botao-secundario acao-rede" onClick={() => setQrAberto(true)}>
              <LuQrCode size={20} /> QR Code
            </button>
            <a
              className="botao botao-secundario acao-contato"
              href={`https://wa.me/?text=${encodeURIComponent(mensagemWifi(onu.wificfg_name, onu.wificfg_password))}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FaWhatsapp size={20} /> Enviar
            </a>
          </div>
          <ModalQrWifi
            aberto={qrAberto}
            rede={onu.wificfg_name}
            senha={onu.wificfg_password}
            onFechar={() => setQrAberto(false)}
          />
        </div>
      )}
    </>
  )
}
