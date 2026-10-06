import os

# Versão do projeto (Versionamento Semântico, https://semver.org/lang/pt-BR/)
# — mantida em sincronia com "version" em frontend/package.json, que é o
# valor exibido na tela de login. Ver CHANGELOG.md para o histórico.
APP_VERSION = "1.13.0"

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
# Um arquivo por mês (auditoria-AAAA-MM.jsonl); os mais antigos que isto são apagados.
AUDITORIA_RETENCAO_MESES = int(os.environ.get("AUDITORIA_RETENCAO_MESES", "12"))
# Usuários do Controllr que podem consultar a auditoria no app (separados por
# vírgula). "*" ou "todos" = qualquer técnico logado. Vazio = ninguém (o
# arquivo continua sendo gravado no servidor).
AUDITORIA_USUARIOS = {
    u.strip().lower() for u in os.environ.get("AUDITORIA_USUARIOS", "").split(",") if u.strip()
}

# Tentativas de login erradas antes de bloquear por LOGIN_BLOQUEIO_MINUTOS:
# por IP e por usuário (protege as senhas do Controllr de tentativa e erro).
LOGIN_TENTATIVAS_IP = int(os.environ.get("LOGIN_TENTATIVAS_IP", "5"))
LOGIN_TENTATIVAS_USUARIO = int(os.environ.get("LOGIN_TENTATIVAS_USUARIO", "10"))
LOGIN_BLOQUEIO_MINUTOS = int(os.environ.get("LOGIN_BLOQUEIO_MINUTOS", "15"))

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

# ------------------------------------------------------------------ avisos de OS nova
# Ver app/vigia_os.py. Sem usuário de consulta ou sem chaves VAPID, os avisos
# ficam desligados (o resto do app funciona igual).
#
# Usuário próprio do Controllr só para consulta: vê as OS de todos para
# descobrir as novas. A senha fica só aqui (backend.env, chmod 600).
CONTROLLR_CONSULTA_USUARIO = os.environ.get("CONTROLLR_CONSULTA_USUARIO", "")
CONTROLLR_CONSULTA_SENHA = os.environ.get("CONTROLLR_CONSULTA_SENHA", "")
# De quanto em quanto tempo procurar OS nova (segundos). Mínimo de 30.
AVISOS_INTERVALO_SEGUNDOS = max(30, int(os.environ.get("AVISOS_INTERVALO_SEGUNDOS", "60")))
# Chaves do Web Push (geradas pelo deploy/install.sh). A pública vai para o
# navegador; a privada assina cada envio. Contato: exigido pelos serviços de
# push (Google/Apple/Mozilla) para avisar em caso de problema.
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "")
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "")
VAPID_CONTATO = os.environ.get("VAPID_CONTATO", "mailto:suporte@hotnet.net.br")
# Celulares inscritos e OS já vistas (sobrevive a reinício do serviço).
AVISOS_DADOS_DIR = os.environ.get("AVISOS_DADOS_DIR", "dados")
