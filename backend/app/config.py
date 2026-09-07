import os

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

SESSION_COOKIE_NAME = "TECSESSION"

# Origens permitidas em dev (Vite) — em produção o frontend é servido
# pela mesma origem do backend (ou por um reverse proxy), então CORS
# deixa de ser necessário; mantido configurável via env.
CORS_ALLOW_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("CORS_ALLOW_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]
