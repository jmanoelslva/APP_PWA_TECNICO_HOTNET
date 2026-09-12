import os

# Versão do projeto (Versionamento Semântico, https://semver.org/lang/pt-BR/)
# — mantida em sincronia com "version" em frontend/package.json, que é o
# valor exibido na tela de login. Ver CHANGELOG.md para o histórico.
APP_VERSION = "1.4.0"

# Acesso de staff/técnico (ACL) ao Controllr acontece pelo painel
# administrativo, numa porta própria (8443) — diferente do endpoint
# público em 443 que o app cliente usa para login de assinante. Todo
# endpoint chamado por este backend (login, clientes, endereços, cpe,
# onu, tickets) vive atrás dessa mesma porta administrativa.
CONTROLLR_URL = os.environ.get("CONTROLLR_URL", "https://controllr.hotnet.net.br:8443")

# Max-Age do cookie TECSESSION no navegador — não é a validade da sessão
# em si, decidida pelo Controllr (ver deps.py::get_current_session). Por
# isso pode e deve ser bem maior que a inatividade tolerada por ele.
SESSION_COOKIE_MAX_AGE_SECONDS = int(os.environ.get("SESSION_COOKIE_MAX_AGE_SECONDS", str(24 * 60 * 60)))

# De quanto em quanto tempo confirmar com o Controllr que a sessão do
# /login ainda está ativa lá (ver deps.py::get_current_session) — curto
# o bastante pra detectar rápido, longo o bastante pra não dobrar toda
# chamada deste backend com uma ida extra ao Controllr.
CONTROLLR_LIVENESS_CHECK_SECONDS = int(os.environ.get("CONTROLLR_LIVENESS_CHECK_SECONDS", "60"))

SESSION_COOKIE_NAME = "TECSESSION"

# Log de auditoria próprio (ver app/audit.py) — caminho do arquivo JSON
# Lines onde cada ação sensível é gravada (técnico, IP real, ação, alvo).
AUDIT_LOG_PATH = os.environ.get("AUDIT_LOG_PATH", "logs/auditoria.jsonl")

# Origens permitidas em dev (Vite) — em produção o frontend é servido
# pela mesma origem do backend (ou por um reverse proxy), então CORS
# deixa de ser necessário; mantido configurável via env.
CORS_ALLOW_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("CORS_ALLOW_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

# Chave da API de geolocalização por IP (geo.ipify.org) — usada pela
# ferramenta "Meu IP" (backend/app/routers/ferramentas.py). Vazia por
# padrão: a rota responde 503 até a chave ser configurada no servidor.
IPIFY_API_KEY = os.environ.get("IPIFY_API_KEY", "")
