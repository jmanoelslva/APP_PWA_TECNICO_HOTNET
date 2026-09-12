import os

# Versão do projeto (Versionamento Semântico, https://semver.org/lang/pt-BR/)
# — mantida em sincronia com "version" em frontend/package.json, que é o
# valor exibido na tela de login. Ver CHANGELOG.md para o histórico.
APP_VERSION = "1.3.0"

# Acesso de staff/técnico (ACL) ao Controllr acontece pelo painel
# administrativo, numa porta própria (8443) — diferente do endpoint
# público em 443 que o app cliente usa para login de assinante. Todo
# endpoint chamado por este backend (login, clientes, endereços, cpe,
# onu, tickets) vive atrás dessa mesma porta administrativa.
CONTROLLR_URL = os.environ.get("CONTROLLR_URL", "https://controllr.hotnet.net.br:8443")

# Tempo de vida da sessão do técnico neste backend (não é o lease do
# Controllr, que é por requisição via Basic Auth — este TTL é só para
# forçar um novo login depois de um período de inatividade).
SESSION_TTL_SECONDS = int(os.environ.get("SESSION_TTL_SECONDS", str(12 * 60 * 60)))

# De quanto em quanto tempo confirmar com o Controllr que a sessão criada
# no /login ainda está ativa lá (ver deps.py::get_current_session) — sem
# isso, um admin encerrando a sessão do técnico manualmente pelo painel
# nunca seria percebido por este backend, porque as demais chamadas usam
# Basic Auth por requisição, que não depende de sessão nenhuma no
# Controllr (CONTROLLR_API_NOTES.md, seção 8.5). Curto o bastante pra
# detectar rápido, longo o bastante pra não dobrar toda chamada deste
# backend com uma ida extra ao Controllr.
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
