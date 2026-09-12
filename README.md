# HOTNET Técnico

PWA de campo para os técnicos da HOTNET: busca de dados de cliente,
atualização de endereço/localização, dados de conexão (usuário/senha,
IP/MAC, sessão online), status óptico da ONU e fechamento de OS/chamados
de suporte.

Irmão do portal do cliente (`HOTNET_WEB_APP`), mas com um backend próprio
em vez de falar direto com o Controllr — ver `PLANO` original em
`C:\Users\LOQ\.claude\plans\quirky-zooming-deer.md` para o raciocínio
completo da arquitetura.

## Estrutura

- `backend/` — API em FastAPI, usa o pacote `brbyteapi` (vendorizado em
  `backend/app/brbyteapi/`) para falar com o Controllr/BRbyte em nome do
  técnico logado (cookie de sessão do Controllr, ver `backend/app/sessions.py`).
- `frontend/` — PWA em Vite + React + TypeScript, mesma stack e padrões
  de engenharia do app cliente (sessão, toasts, tema, instalação PWA).

## Deploy em produção

Pensado para rodar em paralelo com o portal do cliente (`HOTNET_WEB_APP`,
`cliente.hotnet.net.br`), sem mexer no site/vhost dele: outro diretório,
outro domínio (`tecnico.hotnet.net.br`), outro serviço systemd para o
backend. Ver [`deploy/DEPLOY.md`](deploy/DEPLOY.md) para o passo a passo
manual e o checklist de validação, ou rode direto:

```bash
git clone https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET.git
sudo bash APP_PWA_TECNICO_HOTNET/deploy/install.sh
```

`deploy/install.sh` detecta sozinho se Apache ou Nginx já está rodando
no servidor e usa o mesmo, cria um usuário de sistema dedicado e um
serviço systemd para o backend (nunca root, nunca exposto direto à
internet), builda o frontend e configura o reverse proxy — sem tocar em
nada que já esteja instalado.

## Rodando localmente

### Backend

```bash
cd backend
python -m venv .venv
./.venv/Scripts/activate   # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Variáveis de ambiente (opcional, ver `.env.example`): `CONTROLLR_URL`
(padrão `https://controllr.hotnet.net.br:8443` — painel administrativo/
ACL de staff, porta própria e diferente da usada pelo app cliente),
`SESSION_COOKIE_MAX_AGE_SECONDS`, `CONTROLLR_LIVENESS_CHECK_SECONDS`,
`CORS_ALLOW_ORIGINS`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Abre em `http://localhost:5173`; o Vite repassa `/api/*` para o backend em
`http://localhost:8000` (ver `vite.config.ts`).

## Limitações conhecidas (v1)

- Sessão do técnico fica em memória no processo do backend — reiniciar o
  backend derruba todos os técnicos logados (aceitável para uso interno
  com poucos técnicos simultâneos; documentado no plano).
- O campo de login em `web_auth/acl_user` não é documentado pelo pacote
  `brbyteapi` — a resolução do `user_pk` do técnico (usado para filtrar
  "minhas OS") é feita por busca em memória nos resultados, não por um
  filtro `where` direto (ver `backend/app/routers/auth.py::_find_user_pk`).
  Validar contra a doc oficial (apidoc.brbyte.com) e ajustar se preciso.
- `controllrctl/addresses/*` não expõe um `address_list` puro por
  `client_pk` — o backend usa `address_list_combo` com esse filtro; a
  confirmar contra a API real.
