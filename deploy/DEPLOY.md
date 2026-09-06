# Deploy em produção — tecnico.hotnet.net.br

Pensado pra rodar **em paralelo** com o portal do cliente
(`HOTNET_WEB_APP`, em `cliente.hotnet.net.br`), no mesmo servidor ou em
outro — nenhum dos dois instaladores mexe no site/vhost/serviço do outro.

Diferença de fundo em relação ao app cliente: lá é só um site estático
fazendo reverse proxy **direto** pro Controllr (nenhum processo próprio
rodando em produção). Aqui tem duas partes:

1. O build estático do frontend (Vite) — igual ao app cliente.
2. Um **backend próprio** (FastAPI/uvicorn) que fica rodando o tempo todo
   como serviço systemd, na porta 8000 (só em `127.0.0.1`, nunca exposto
   direto) — é ele quem fala com o Controllr (HTTP Basic Auth do técnico
   logado), não o navegador. O servidor web faz proxy de `/api/*` pra
   esse processo LOCAL.

## Instalação automatizada (servidor Debian novo ou já em uso)

```bash
git clone https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET.git
sudo bash APP_PWA_TECNICO_HOTNET/deploy/install.sh
```

[`deploy/install.sh`](install.sh) pergunta o domínio (Enter aceita o
padrão `tecnico.hotnet.net.br`) e a porta local do backend (Enter aceita
`8000`), **detecta sozinho** se Apache ou Nginx já está rodando no
servidor (ex: por causa do app cliente já instalado) e usa o mesmo — só
pergunta qual usar se nenhum dos dois estiver ativo ainda. Não mexe em
nenhum vhost/serviço já existente, só adiciona os deste app.

Rodar de novo (mesmo servidor, mesmo domínio) atualiza tudo: `git pull`,
reinstala dependências Python (`pip install -r requirements.txt`) e Node
(`npm ci`), reconstrói o frontend, reinicia o serviço do backend e
republica o `dist/` — sem reemitir certificado nem reconfigurar o que já
está pronto.

O passo a passo manual abaixo continua válido pra quem preferir controle
fino, outro sistema operacional, ou não usar Debian.

## 1. Backend — venv, dependências e serviço

```bash
cd backend
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
```

Crie `/etc/hotnet-tecnico/backend.env` (fora do diretório de deploy, pra
sobreviver a um `git pull`):

```env
CONTROLLR_URL=https://controllr.hotnet.net.br
SESSION_TTL_SECONDS=43200
CORS_ALLOW_ORIGINS=https://tecnico.hotnet.net.br
```

Rode como serviço persistente (systemd, dedicado a um usuário sem login
— **nunca como root**), reiniciando sozinho em caso de queda. O
`install.sh` gera esse unit sozinho; pra fazer à mão, veja o bloco
`[Service]` que ele escreve em `/etc/systemd/system/hotnet-tecnico-api.service`
(comando `ExecStart`: `.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000`).

O backend nunca deve ficar acessível direto da internet — só em
`127.0.0.1`, alcançado exclusivamente através do reverse proxy do
servidor web (ver seção 3).

## 2. Frontend — gerar o build

```bash
cd frontend
npm install
npm run build
```

Isso gera `frontend/dist/` — só o conteúdo dela precisa ir pro diretório
que o servidor web serve (ex: `/var/www/hotnet-tecnico/dist`). Nada de
Node roda em produção (só o Python do backend).

## 3. Configurar o servidor web

Dois exemplos prontos nesta pasta:

- `nginx.conf.example`
- `apache-vhost.conf.example`

Ambos fazem as mesmas duas coisas obrigatórias:

1. Servem o conteúdo estático de `dist/`, com fallback pro `index.html`
   em qualquer rota que não seja um arquivo real (necessário pro
   react-router-dom — sem isso, recarregar a página numa rota interna
   como `/suporte/123` dá 404).
2. Fazem reverse proxy de `/api/*` pro **backend local**
   (`127.0.0.1:8000`) — **não** pro Controllr direto, diferente do app
   cliente. Não precisa reescrever domínio de cookie: o cookie de sessão
   (`TECSESSION`) é emitido pelo nosso próprio backend, sem domínio
   fixo, então já nasce certo pra `tecnico.hotnet.net.br`.

Ajuste nos dois exemplos: os caminhos do certificado TLS, o `root`/
`DocumentRoot` pro local real onde `dist/` for publicado, e a porta do
backend se não for a 8000.

## 4. Certificado TLS

`tecnico.hotnet.net.br` precisa de um certificado válido (ex: via
Certbot/Let's Encrypt) — os exemplos assumem esse caminho padrão. Sem
HTTPS, cookies com `Secure` (se o backend um dia passar a marcar assim)
não seriam nem enviados pelo navegador.

## 5. Checklist pra validar depois de publicar

- [ ] `systemctl status hotnet-tecnico-api` — serviço ativo, sem
      reiniciar em loop (`journalctl -u hotnet-tecnico-api -n 50` se não
      estiver).
- [ ] `curl -s http://127.0.0.1:8000/health` no próprio servidor —
      `{"ok":true}` (confirma o backend de pé antes de testar via HTTPS).
- [ ] Abrir `https://tecnico.hotnet.net.br/suporte` diretamente (sem
      passar pela home antes) — deve cair na tela de login (fallback de
      SPA funcionando) e, depois de logado, recarregar a página em
      `/suporte` não deve dar 404.
- [ ] Fazer login com um usuário técnico (ACL) real e confirmar que a
      sessão se mantém ao navegar entre Clientes/Suporte/Conexão (prova
      que o cookie `TECSESSION` está sendo aceito).
- [ ] DevTools → Application → Cookies e confirmar que `TECSESSION`
      aparece com o domínio `tecnico.hotnet.net.br`.
- [ ] Abrir uma OS, mandar uma mensagem, anexar uma foto e **fechar a
      OS** — cobre o fluxo mais crítico deste app.
- [ ] Testar "Instalar app" (Android/Chrome) e o passo a passo do iOS
      (Safari → compartilhar → Adicionar à Tela de Início).
- [ ] DevTools → Network → recarregar `/` → conferir `Cache-Control:
      no-cache` na resposta do `index.html`/`sw.js`, e `Cache-Control:
      public, max-age=31536000, immutable` numa requisição de
      `/assets/*.js` — sem isso, atualizações do app podem ficar
      escondidas no navegador do técnico por dias (ver "Aviso de nova
      versão" no README do frontend).
- [ ] Confirmar que o site do app **cliente** (`cliente.hotnet.net.br`,
      se estiver no mesmo servidor) continua funcionando normalmente —
      prova de que a instalação deste app não interferiu em nada.
