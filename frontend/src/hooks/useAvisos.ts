import { useCallback, useEffect, useState } from 'react'
import { ApiError, configAvisos, inscreverAvisos, removerAvisos } from '../api/client'
import { useToast } from '../components/Toast/useToast'
import { base64UrlParaBytes } from '../utils/base64'
import { ehIos, jaInstalado } from './usePwaInstall'

/**
 * Avisos de OS nova neste celular (Web Push) — interruptor no menu do avatar
 * (Home.tsx). Quem detecta OS nova e manda o aviso é o backend
 * (app/vigia_os.py); aqui só se pede a permissão e se cadastra o celular.
 *
 * - indisponivel: servidor sem avisos configurados (o item nem aparece);
 * - sem-suporte: navegador sem notificação;
 * - instalar: iPhone só recebe com o app instalado na tela inicial;
 * - bloqueado: o técnico negou a permissão (só volta pelas configurações).
 */
export type EstadoAvisos = 'carregando' | 'indisponivel' | 'sem-suporte' | 'instalar' | 'bloqueado' | 'desligado' | 'ligado'

function navegadorSuporta(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

async function inscricaoAtual(): Promise<PushSubscription | null> {
  const registro = await navigator.serviceWorker.getRegistration()
  return (await registro?.pushManager.getSubscription()) ?? null
}

/** Desliga os avisos deste celular (interruptor do avatar). Nunca falha. */
export async function desligarAvisosDesteCelular(): Promise<void> {
  try {
    if (!navegadorSuporta()) return
    const inscricao = await inscricaoAtual()
    if (!inscricao) return
    await removerAvisos(inscricao.endpoint).catch(() => {})
    await inscricao.unsubscribe()
  } catch {
    /* sair do app não pode travar por causa dos avisos */
  }
}

export function useAvisos() {
  const { toast } = useToast()
  const [estado, setEstado] = useState<EstadoAvisos>('carregando')
  const [chave, setChave] = useState('')
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    let cancelado = false
    ;(async () => {
      try {
        const config = await configAvisos()
        if (cancelado) return
        if (!config.disponivel) return setEstado('indisponivel')
        setChave(config.chave)
        if (!navegadorSuporta()) return setEstado('sem-suporte')
        if (ehIos() && !jaInstalado()) return setEstado('instalar')
        if (Notification.permission === 'denied') return setEstado('bloqueado')
        const inscricao = await inscricaoAtual()
        if (cancelado) return
        if (inscricao && Notification.permission === 'granted') {
          // Reassocia este celular a quem está logado agora (outro técnico
          // pode ter entrado no mesmo aparelho) — sem aviso de confirmação.
          await inscreverAvisos(inscricao.toJSON()).catch(() => {})
          setEstado('ligado')
        } else {
          setEstado('desligado')
        }
      } catch {
        if (!cancelado) setEstado('indisponivel')
      }
    })()
    return () => {
      cancelado = true
    }
  }, [])

  const ligar = useCallback(async () => {
    setOcupado(true)
    try {
      const permissao = await Notification.requestPermission()
      if (permissao !== 'granted') {
        setEstado(permissao === 'denied' ? 'bloqueado' : 'desligado')
        toast('Sem permissão de notificação, os avisos não chegam.')
        return
      }
      const registro = await navigator.serviceWorker.getRegistration()
      if (!registro) {
        toast('Não foi possível ativar os avisos agora. Feche e abra o app e tente de novo.')
        return
      }
      const opcoes = { userVisibleOnly: true, applicationServerKey: base64UrlParaBytes(chave) }
      let inscricao: PushSubscription
      try {
        inscricao = await registro.pushManager.subscribe(opcoes)
      } catch {
        // Inscrição antiga feita com outra chave do servidor: refaz.
        await (await registro.pushManager.getSubscription())?.unsubscribe()
        inscricao = await registro.pushManager.subscribe(opcoes)
      }
      await inscreverAvisos(inscricao.toJSON(), true)
      setEstado('ligado')
      toast('Avisos de OS ativados neste celular.', 'sucesso')
    } catch (excecao) {
      toast(excecao instanceof ApiError ? excecao.message : 'Não foi possível ativar os avisos.')
    } finally {
      setOcupado(false)
    }
  }, [chave, toast])

  const desligar = useCallback(async () => {
    setOcupado(true)
    try {
      await desligarAvisosDesteCelular()
      setEstado('desligado')
      toast('Avisos de OS desligados neste celular.', 'info')
    } finally {
      setOcupado(false)
    }
  }, [toast])

  return { estado, ocupado, ligar, desligar }
}
