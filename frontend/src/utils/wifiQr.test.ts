import { describe, expect, it } from 'vitest'
import { mensagemWifi, textoQrWifi } from './wifiQr'

describe('textoQrWifi', () => {
  it('rede com senha', () => {
    expect(textoQrWifi('Casa_5G', 'senha123')).toBe('WIFI:T:WPA;S:Casa_5G;P:senha123;;')
  })
  it('escapa os caracteres especiais', () => {
    expect(textoQrWifi('Rede;1', 'a:b,c"d\\e')).toBe('WIFI:T:WPA;S:Rede\\;1;P:a\\:b\\,c\\"d\\\\e;;')
  })
  it('rede aberta', () => {
    expect(textoQrWifi('Visitantes', '')).toBe('WIFI:T:nopass;S:Visitantes;;')
  })
})

describe('mensagemWifi', () => {
  it('nome e senha em linhas', () => {
    expect(mensagemWifi('Casa', '123')).toBe('Dados do seu Wi-Fi:\nRede: Casa\nSenha: 123')
  })
})
