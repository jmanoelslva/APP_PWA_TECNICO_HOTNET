import os

CONTROLLR_URL = os.environ.get("CONTROLLR_URL", "https://controllr.hotnet.net.br")

# Tempo de vida da sessão do técnico neste backend (não é o lease do
# Controllr, que é por requisição via Basic Auth — este TTL é só pra
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
