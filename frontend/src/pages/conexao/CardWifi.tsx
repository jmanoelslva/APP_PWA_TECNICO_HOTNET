import { useState, type CSSProperties } from 'react'
import { MdSave, MdVisibility, MdVisibilityOff } from 'react-icons/md'
import { ApiError, atualizarWifiCpe, type CpeDto } from '../../api/client'
import { useToast } from '../../components/Toast/useToast'
import { CORES } from '../../utils/cores'
import { OPCOES_CRIPTOGRAFIA_WIFI } from '../../utils/formatacao'
import BlocoRecolhivel from './BlocoRecolhivel'

/**
 * cpe_wifi_encryption_type/password (doc oficial do Controllr; valores:
 * 0 Nenhum, 1 WEP, 2 WPA, 3 EAP). Com "Nenhum" não faz sentido ter senha —
 * o campo fica desabilitado e é limpo nesse caso. Pré-preenchido com o que
 * o sistema fornecer; só é enviado ao Controllr quando o técnico salvar.
 */
export default function CardWifi({
  cpe,
  aberto,
  onAlternar,
  onAtualizado,
}: {
  cpe: CpeDto
  aberto: boolean
  onAlternar: () => void
  onAtualizado: (parcial: Partial<CpeDto>) => void
}) {
  const { toast } = useToast()
  // Sem "não informado" no seletor — assume Nenhum (0) até o técnico
  // escolher outra coisa, para manter o estado igual ao que a tela mostra.
  const [wifiTipo, setWifiTipo] = useState(cpe.wifi_encryption_type != null ? String(cpe.wifi_encryption_type) : '0')
  const [wifiSenha, setWifiSenha] = useState(cpe.wifi_encryption_password ?? '')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const semCriptografia = wifiTipo === '0'

  async function salvar() {
    if (!cpe.pk) return
    setSalvando(true)
    try {
      // Tipo 0 (Nenhum) não tem senha — se a criptografia é "Nenhum", o
      // Controllr não deve receber senha nenhuma.
      const senhaParaEnviar = semCriptografia ? '' : wifiSenha
      const tipo = wifiTipo.trim() ? Number(wifiTipo.trim()) : undefined
      await atualizarWifiCpe(cpe.pk, {
        wifi_encryption_type: tipo,
        wifi_encryption_password: senhaParaEnviar,
        auditoria: {
          cliente: cpe.client_complete_name,
          pppoe: cpe.username,
          wifi_tipo_anterior: cpe.wifi_encryption_type,
          senha_wifi_alterada: senhaParaEnviar !== (cpe.wifi_encryption_password ?? ''),
        },
      })
      setWifiSenha(senhaParaEnviar)
      onAtualizado({ wifi_encryption_type: tipo, wifi_encryption_password: senhaParaEnviar })
      toast('Wi-Fi do CPE atualizado.', 'sucesso')
    } catch (excecao) {
      toast(excecao instanceof ApiError ? excecao.message : 'Não foi possível atualizar o Wi-Fi.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <BlocoRecolhivel titulo="Wi-Fi do CPE (criptografia)" aberto={aberto} onAlternar={onAlternar}>
      <div className="conexao-campo">
        <span>Tipo de criptografia</span>
        <select
          className="conexao-input"
          value={wifiTipo}
          onChange={(e) => {
            setWifiTipo(e.target.value)
            if (e.target.value === '0') setWifiSenha('')
          }}
        >
          {OPCOES_CRIPTOGRAFIA_WIFI.map((opcao) => (
            <option key={opcao.valor} value={opcao.valor}>
              {opcao.rotulo}
            </option>
          ))}
        </select>
      </div>
      <div className="conexao-campo">
        <span>Senha do Wi-Fi</span>
        <div className="conexao-campo-valor">
          <input
            className="conexao-input"
            type={mostrarSenha ? 'text' : 'password'}
            value={semCriptografia ? '' : wifiSenha}
            onChange={(e) => setWifiSenha(e.target.value)}
            disabled={semCriptografia}
            placeholder={semCriptografia ? 'Sem criptografia — sem senha' : 'Não informado'}
          />
          <button
            onClick={() => setMostrarSenha((v) => !v)}
            disabled={semCriptografia}
            aria-label={mostrarSenha ? 'Ocultar senha do Wi-Fi' : 'Mostrar senha do Wi-Fi'}
          >
            {mostrarSenha ? <MdVisibilityOff size={16} /> : <MdVisibility size={16} />}
          </button>
        </div>
      </div>
      <button
        className="botao botao-secundario botao-pequeno"
        style={{ '--botao-cor': CORES.conexao } as CSSProperties}
        onClick={salvar}
        disabled={salvando}
      >
        <MdSave size={14} /> {salvando ? 'Salvando…' : 'Salvar Wi-Fi'}
      </button>
    </BlocoRecolhivel>
  )
}
