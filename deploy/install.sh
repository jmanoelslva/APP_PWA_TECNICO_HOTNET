#!/usr/bin/env bash
#
# Instalador do PWA do Técnico HOTNET num servidor Debian — pensado pra
# rodar em PARALELO com o portal do cliente (HOTNET_WEB_APP, instalado via
# deploy/install.sh daquele projeto): usa outro diretório
# (/opt/hotnet-tecnico), outro vhost (tecnico.hotnet.net.br em vez de
# cliente.hotnet.net.br), outro backend próprio (nada de systemd/porta
# compartilhada com o app cliente, que nem tem backend próprio) e NUNCA
# mexe em site/vhost/serviço já existente no servidor.
#
# Diferença chave em relação ao instalador do app cliente: lá é só site
# estático fazendo reverse proxy DIRETO pro Controllr. Aqui tem duas
# partes: o build estático do frontend (Vite) E um processo Python
# (FastAPI/uvicorn) que fica rodando o tempo todo como serviço systemd —
# o Nginx/Apache faz proxy de /api/* pra esse processo LOCAL
# (127.0.0.1:$BACKEND_PORT), não pro Controllr direto.
#
# Uso:
#   sudo bash install.sh
#
# Rodar de novo (mesmo servidor) atualiza tudo: git pull, reinstala
# dependências Python/Node, rebuilda o frontend, reinicia o serviço do
# backend e republica o build — sem reemitir certificado nem reconfigurar
# o que já está pronto. Domínio e porta escolhidos na primeira vez ficam
# salvos em /etc/hotnet-tecnico/install.conf — só aparecem como sugestão
# (Enter aceita), não precisa redigitar toda vez.

set -euo pipefail

# --------------------------------------------------------------------------
# Configuração fixa
# --------------------------------------------------------------------------
REPO_URL="${REPO_URL:-https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET.git}"
CONTROLLR_URL="${CONTROLLR_URL:-https://controllr.hotnet.net.br:8443}"
INSTALL_DIR="/opt/hotnet-tecnico"
ACME_WEBROOT="/var/www/certbot-acme"
SERVICE_USER="hotnet-tecnico"
SERVICE_NAME="hotnet-tecnico-api"
ENV_FILE="/etc/hotnet-tecnico/backend.env"
# Guarda o domínio/porta escolhidos na primeira instalação, pra rodar de
# novo (atualização) não pedir de novo nem arriscar "esquecer" e voltar
# pro padrão — sem isso, quem escolheu uma porta não-padrão (ex: 8517)
# teria que digitá-la de cabeça em toda atualização futura.
STATE_FILE="/etc/hotnet-tecnico/install.conf"
DEFAULT_DOMAIN="tecnico.hotnet.net.br"
DEFAULT_PORT="8000"
if [ -f "$STATE_FILE" ]; then
  # shellcheck source=/dev/null
  source "$STATE_FILE"
  DEFAULT_DOMAIN="${DOMINIO_SALVO:-$DEFAULT_DOMAIN}"
  DEFAULT_PORT="${BACKEND_PORT_SALVO:-$DEFAULT_PORT}"
fi
# jsdom (devDependency do frontend, só usado por "npm test" — nunca em
# produção) exige Node 22.22.2+/24.15+/26+; Node 24 é a LTS "Active" atual
# e evita o aviso EBADENGINE do "npm ci" no passo de build abaixo (mesmo
# critério do install.sh do app cliente).
NODE_MAJOR="24"
PYTHON_BIN="python3"

# --------------------------------------------------------------------------
# Saída formatada
# --------------------------------------------------------------------------
if [ -t 1 ]; then
  C_INFO='\033[36m'; C_OK='\033[32m'; C_WARN='\033[33m'; C_ERR='\033[31m'; C_RESET='\033[0m'
else
  C_INFO=''; C_OK=''; C_WARN=''; C_ERR=''; C_RESET=''
fi
info()  { printf '%b[info]%b %s\n'  "$C_INFO" "$C_RESET" "$1"; }
ok()    { printf '%b[ok]%b %s\n'    "$C_OK"   "$C_RESET" "$1"; }
warn()  { printf '%b[atencao]%b %s\n' "$C_WARN" "$C_RESET" "$1"; }
err()   { printf '%b[erro]%b %s\n'  "$C_ERR"  "$C_RESET" "$1" >&2; exit 1; }
trap 'err "Instalação interrompida (linha $LINENO). Nada foi desfeito — corrija o problema acima e rode o script de novo, ele retoma de onde parou."' ERR

# --------------------------------------------------------------------------
# 1. Intro
# --------------------------------------------------------------------------
cat <<'BANNER'
==========================================================================
 Instalador do PWA do Técnico HOTNET
==========================================================================
 Este script vai, nesta ordem:
   1. Instalar dependências (Node.js, Python 3, git, rsync, Apache OU
      Nginx, certbot) — sem tocar em nada que já esteja instalado/rodando
   2. Clonar/atualizar o projeto, criar o venv Python do backend e gerar
      o build de produção do frontend
   3. Criar um usuário de sistema dedicado e um serviço systemd pro
      backend (FastAPI/uvicorn), rodando só em 127.0.0.1 — nunca exposto
      direto à internet
   4. Publicar o frontend e configurar o servidor web com reverse proxy
      pro backend LOCAL (não pro Controllr direto)
   5. Emitir um certificado Let's Encrypt pro domínio informado e ativar
      a renovação automática

 Feito pra rodar em PARALELO com o portal do cliente (HOTNET_WEB_APP), se
 já estiver no mesmo servidor: usa outro diretório, outro domínio, outro
 serviço — não mexe em nenhum site/vhost/serviço já existente, só
 adiciona os arquivos referentes a este app.
==========================================================================
BANNER

# --------------------------------------------------------------------------
# 2. Pré-requisitos básicos
# --------------------------------------------------------------------------
if [ "$(id -u)" -ne 0 ]; then
  err "Rode este script como root (ex: sudo bash install.sh)."
fi

if ! command -v apt-get >/dev/null 2>&1; then
  err "Este instalador é só pra Debian/Ubuntu (precisa de apt-get)."
fi

# --------------------------------------------------------------------------
# 3. Perguntas
# --------------------------------------------------------------------------
DOMAIN_REGEX='^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$'

if [ -f "$STATE_FILE" ]; then
  ok "Instalação existente detectada (domínio '$DEFAULT_DOMAIN', porta '$DEFAULT_PORT') — Enter mantém, ou digite um novo valor pra mudar."
fi

read -rp "Domínio deste portal (Enter pra usar '$DEFAULT_DOMAIN'): " DOMINIO
DOMINIO="${DOMINIO:-$DEFAULT_DOMAIN}"
if [[ ! "$DOMINIO" =~ $DOMAIN_REGEX ]]; then
  err "Domínio inválido: '$DOMINIO' (sem http://, sem barra no fim)."
fi

read -rp "Porta local do backend (Enter pra usar '$DEFAULT_PORT'): " BACKEND_PORT
BACKEND_PORT="${BACKEND_PORT:-$DEFAULT_PORT}"
if [[ ! "$BACKEND_PORT" =~ ^[0-9]+$ ]]; then
  err "Porta inválida: '$BACKEND_PORT'."
fi

# Numa atualização, o serviço já pode estar ouvindo nessa mesma porta —
# para ele ANTES de checar disponibilidade, senão a checagem abaixo
# sempre falharia achando que a porta está "ocupada por outro processo"
# quando na verdade é o nosso próprio serviço de uma instalação anterior.
if systemctl list-unit-files "$SERVICE_NAME.service" 2>/dev/null | grep -q "$SERVICE_NAME.service"; then
  info "Parando $SERVICE_NAME temporariamente pra liberar a porta durante a atualização..."
  systemctl stop "$SERVICE_NAME" || true
fi

if ss -ltn "( sport = :$BACKEND_PORT )" 2>/dev/null | grep -q LISTEN; then
  err "A porta $BACKEND_PORT já está em uso por outro processo neste servidor. Rode de novo escolhendo outra porta."
fi

mkdir -p "$(dirname "$STATE_FILE")"
cat > "$STATE_FILE" <<EOF
DOMINIO_SALVO=$DOMINIO
BACKEND_PORT_SALVO=$BACKEND_PORT
EOF

read -rp "E-mail pra avisos do Let's Encrypt (opcional, Enter pra pular): " EMAIL

if getent hosts "$DOMINIO" >/dev/null 2>&1; then
  ok "$DOMINIO resolve no DNS."
else
  warn "$DOMINIO não resolveu no DNS deste servidor agora. Se o registro"
  warn "ainda não propagou, a emissão do certificado abaixo vai falhar."
  read -rp "Continuar mesmo assim? [s/N] " resposta
  [[ "${resposta,,}" == "s" ]] || err "Cancelado — ajuste o DNS e rode de novo."
fi

# Detecta automaticamente o servidor web já em uso no servidor (ex: pelo
# app cliente já instalado) em vez de perguntar e arriscar um choque —
# "rodar em paralelo" significa usar o MESMO Apache/Nginx que já está de
# pé, só com mais um vhost. Só pergunta se nenhum dos dois estiver ativo.
apache_rodando()  { command -v apache2ctl >/dev/null 2>&1 && systemctl is-active --quiet apache2; }
nginx_rodando()   { command -v nginx      >/dev/null 2>&1 && systemctl is-active --quiet nginx; }

WEBSERVER=""
if apache_rodando && nginx_rodando; then
  err "Apache e Nginx estão os dois ativos neste servidor — situação incomum, escolha manualmente rodando com WEBSERVER=apache ou WEBSERVER=nginx no ambiente antes do script."
elif apache_rodando; then
  WEBSERVER="apache"
  ok "Apache já está rodando neste servidor (provavelmente do portal do cliente) — vou usar o mesmo, só adicionando o vhost de $DOMINIO."
elif nginx_rodando; then
  WEBSERVER="nginx"
  ok "Nginx já está rodando neste servidor (provavelmente do portal do cliente) — vou usar o mesmo, só adicionando o vhost de $DOMINIO."
else
  while [ -z "$WEBSERVER" ]; do
    read -rp "Nenhum servidor web ativo ainda. Usar Apache ou Nginx? [apache/nginx] " resposta
    case "${resposta,,}" in
      apache) WEBSERVER="apache" ;;
      nginx)  WEBSERVER="nginx" ;;
      *) warn "Digite 'apache' ou 'nginx'." ;;
    esac
  done
fi

WWW_ROOT="/var/www/$DOMINIO"
PUBLISH_DIR="$WWW_ROOT/dist"
TEMPLATE_DIR="$INSTALL_DIR/deploy"

echo
info "Domínio:            $DOMINIO"
info "Backend Controllr:  $CONTROLLR_URL (fixo, ver backend/.env.example)"
info "Backend local:      127.0.0.1:$BACKEND_PORT (serviço systemd $SERVICE_NAME)"
info "Servidor web:       $WEBSERVER"
info "Build publicado em: $PUBLISH_DIR"
echo

# --------------------------------------------------------------------------
# 4. Dependências base
# --------------------------------------------------------------------------
info "Atualizando lista de pacotes..."
apt-get update -y

info "Instalando dependências base (curl, git, rsync, certbot, Python 3)..."
apt-get install -y curl git rsync ca-certificates gnupg certbot python3 python3-venv python3-pip

# --------------------------------------------------------------------------
# 5. Clonar/atualizar o projeto
# --------------------------------------------------------------------------
if [ -d "$INSTALL_DIR/.git" ]; then
  info "Projeto já clonado em $INSTALL_DIR, atualizando..."
  # Esta pasta é só um artefato de deploy, nunca editada à mão — descarta
  # qualquer modificação local antes de atualizar (mesmo critério do
  # install.sh do app cliente: evita "pull --ff-only" falhar exigindo
  # intervenção manual por causa de um lockfile reescrito no servidor).
  if [ -n "$(git -C "$INSTALL_DIR" status --porcelain)" ]; then
    warn "Descartando alterações locais em $INSTALL_DIR (artefato de deploy, não deveria ter edição manual)..."
    git -C "$INSTALL_DIR" checkout -- .
  fi
  git -C "$INSTALL_DIR" pull --ff-only
else
  info "Clonando $REPO_URL em $INSTALL_DIR..."
  git clone "$REPO_URL" "$INSTALL_DIR"
fi

# --------------------------------------------------------------------------
# 6. Node.js (só é usado aqui pra buildar o frontend — nada de Node roda
#    em produção; quem fica de pé o tempo todo é o backend Python)
# --------------------------------------------------------------------------
instalar_node() {
  if command -v node >/dev/null 2>&1; then
    local major
    major="$(node -v | sed -E 's/^v([0-9]+).*/\1/')"
    if [ "$major" -ge 22 ] 2>/dev/null; then
      ok "Node.js $(node -v) já instalado."
      return
    fi
  fi
  info "Instalando Node.js ${NODE_MAJOR}.x (NodeSource)..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
}
instalar_node

# --------------------------------------------------------------------------
# 7. Usuário de sistema dedicado pro backend (sem login, sem home de
#    verdade) — nunca roda o uvicorn como root nem reaproveita o
#    www-data do servidor web.
#    --home-dir aponta pro diretório backend/ do próprio projeto (que já
#    existe e vai ficar de propriedade deste usuário logo abaixo, ver
#    chown) em vez do padrão "/home/$SERVICE_USER" que o
#    --no-create-home NUNCA cria — sem isso, o $HOME do usuário aponta
#    pra um diretório inexistente/sem permissão e "pip install" (rodado
#    como esse usuário, ver passo 8) desliga o próprio cache sozinho com
#    um warning (~/.cache/pip sem onde escrever). "usermod" cobre quem
#    já tinha o usuário criado antes dessa correção — sem ele, uma
#    atualização não corrigiria o HOME de uma instalação já feita.
# --------------------------------------------------------------------------
if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
  info "Criando usuário de sistema '$SERVICE_USER'..."
  useradd --system --no-create-home --home-dir "$INSTALL_DIR/backend" --shell /usr/sbin/nologin "$SERVICE_USER"
else
  ok "Usuário '$SERVICE_USER' já existe."
  usermod --home "$INSTALL_DIR/backend" "$SERVICE_USER" 2>/dev/null || true
fi
chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR/backend"

# --------------------------------------------------------------------------
# 8. Backend: venv + dependências Python
# --------------------------------------------------------------------------
info "Preparando o ambiente Python do backend..."
if [ ! -d "$INSTALL_DIR/backend/.venv" ]; then
  sudo -H -u "$SERVICE_USER" "$PYTHON_BIN" -m venv "$INSTALL_DIR/backend/.venv"
fi
sudo -H -u "$SERVICE_USER" "$INSTALL_DIR/backend/.venv/bin/pip" install --quiet --upgrade pip
sudo -H -u "$SERVICE_USER" "$INSTALL_DIR/backend/.venv/bin/pip" install --quiet -r "$INSTALL_DIR/backend/requirements.txt"
ok "Dependências Python instaladas."

# --------------------------------------------------------------------------
# 9. Arquivo de ambiente do backend — mantido em /etc (não dentro do
#    diretório de deploy, que é sobrescrito a cada "git pull"), pra uma
#    reinstalação não apagar CORS_ALLOW_ORIGINS/CONTROLLR_URL já ajustados
#    manualmente por alguém depois.
# --------------------------------------------------------------------------
mkdir -p "$(dirname "$ENV_FILE")"
if [ ! -f "$ENV_FILE" ]; then
  info "Criando $ENV_FILE..."
  cat > "$ENV_FILE" <<EOF
CONTROLLR_URL=$CONTROLLR_URL
SESSION_TTL_SECONDS=43200
CORS_ALLOW_ORIGINS=https://$DOMINIO
EOF
else
  ok "$ENV_FILE já existe, mantendo como está (edite manualmente se precisar mudar algo)."
fi
chmod 600 "$ENV_FILE"
chown "$SERVICE_USER:$SERVICE_USER" "$ENV_FILE"

# --------------------------------------------------------------------------
# 10. Serviço systemd do backend
# --------------------------------------------------------------------------
info "Configurando o serviço systemd $SERVICE_NAME..."
cat > "/etc/systemd/system/$SERVICE_NAME.service" <<EOF
[Unit]
Description=HOTNET Técnico API (FastAPI/uvicorn)
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR/backend
EnvironmentFile=$ENV_FILE
ExecStart=$INSTALL_DIR/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port $BACKEND_PORT
Restart=on-failure
RestartSec=3

# Isolamento básico — o serviço só precisa escrever dentro do próprio
# diretório de instalação (nada aqui grava nada, na verdade, mas deixa
# preparado caso um dia precise, ex: upload temporário de anexo).
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$INSTALL_DIR

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

sleep 1
if ! systemctl is-active --quiet "$SERVICE_NAME"; then
  err "O serviço $SERVICE_NAME não subiu — rode 'journalctl -u $SERVICE_NAME -n 50' pra ver o erro."
fi
ok "Backend rodando em 127.0.0.1:$BACKEND_PORT (serviço $SERVICE_NAME)."

# --------------------------------------------------------------------------
# 11. Build do frontend
# --------------------------------------------------------------------------
info "Instalando dependências do frontend e gerando build de produção..."
# "npm ci" (não "npm install") instala exatamente o que está no
# package-lock.json commitado e nunca reescreve o arquivo.
( cd "$INSTALL_DIR/frontend" && npm ci && npm run build )
ok "Build gerado em $INSTALL_DIR/frontend/dist"

# --------------------------------------------------------------------------
# 12. Servidor web (instala só se ainda não estiver presente — ver
#     detecção automática no passo 3)
# --------------------------------------------------------------------------
if [ "$WEBSERVER" = "nginx" ]; then
  SERVICE_WEB="nginx"
  if ! dpkg -s nginx >/dev/null 2>&1; then
    info "Instalando Nginx..."
    apt-get install -y nginx
  else
    ok "Nginx já instalado."
  fi
else
  SERVICE_WEB="apache2"
  if ! dpkg -s apache2 >/dev/null 2>&1; then
    info "Instalando Apache..."
    apt-get install -y apache2
  else
    ok "Apache já instalado."
  fi
  a2enmod proxy proxy_http headers rewrite ssl >/dev/null
fi
systemctl enable --now "$SERVICE_WEB" >/dev/null

# --------------------------------------------------------------------------
# 13. Publica o build do frontend (estático — o único processo que roda o
#     tempo todo é o backend, via systemd, não o servidor web nem Node)
# --------------------------------------------------------------------------
info "Publicando o build em $PUBLISH_DIR..."
mkdir -p "$PUBLISH_DIR"
rsync -a --delete "$INSTALL_DIR/frontend/dist/" "$PUBLISH_DIR/"
chown -R www-data:www-data "$WWW_ROOT"

# --------------------------------------------------------------------------
# 14. Vhost provisório (só a porta 80, só pro desafio ACME do Let's
#     Encrypt) — não mexe em nenhum site já existente, só adiciona o
#     deste domínio.
# --------------------------------------------------------------------------
mkdir -p "$ACME_WEBROOT"

publicar_bootstrap_nginx() {
  cat > "/etc/nginx/sites-available/$DOMINIO.conf" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMINIO;

    location /.well-known/acme-challenge/ {
        root $ACME_WEBROOT;
    }

    location / {
        return 404;
    }
}
EOF
  ln -sf "/etc/nginx/sites-available/$DOMINIO.conf" "/etc/nginx/sites-enabled/$DOMINIO.conf"
  nginx -t
  systemctl reload nginx
}

publicar_bootstrap_apache() {
  cat > "/etc/apache2/sites-available/$DOMINIO.conf" <<EOF
<VirtualHost *:80>
    ServerName $DOMINIO
    DocumentRoot $ACME_WEBROOT
    <Directory $ACME_WEBROOT>
        Require all granted
    </Directory>
</VirtualHost>
EOF
  a2ensite "$DOMINIO" >/dev/null
  apache2ctl configtest
  systemctl reload apache2
}

if [ ! -f "/etc/letsencrypt/live/$DOMINIO/fullchain.pem" ]; then
  info "Preparando vhost provisório na porta 80 (necessário pra validar o domínio com o Let's Encrypt)..."
  if [ "$WEBSERVER" = "nginx" ]; then publicar_bootstrap_nginx; else publicar_bootstrap_apache; fi
fi

# --------------------------------------------------------------------------
# 15. Certificado Let's Encrypt (certbot só emite — o vhost final é o
#     nosso, feito a partir do exemplo em deploy/, não o que o certbot
#     geraria sozinho com --nginx/--apache).
# --------------------------------------------------------------------------
if [ -f "/etc/letsencrypt/live/$DOMINIO/fullchain.pem" ]; then
  ok "Já existe certificado Let's Encrypt pra $DOMINIO, pulando emissão."
else
  info "Emitindo certificado Let's Encrypt pra $DOMINIO..."
  certbot_args=(certonly --webroot -w "$ACME_WEBROOT" -d "$DOMINIO"
    --non-interactive --agree-tos --deploy-hook "systemctl reload $SERVICE_WEB")
  if [ -n "$EMAIL" ]; then
    certbot_args+=(-m "$EMAIL" --no-eff-email)
  else
    certbot_args+=(--register-unsafely-without-email)
  fi
  certbot "${certbot_args[@]}"
  ok "Certificado emitido."
fi

systemctl enable --now certbot.timer >/dev/null 2>&1 || true

# --------------------------------------------------------------------------
# 16. Vhost final — a partir do exemplo em deploy/, com o domínio, o
#     caminho do build e a porta do backend substituídos.
# --------------------------------------------------------------------------
publicar_final_nginx() {
  sed \
    -e "s/tecnico\.hotnet\.net\.br/$DOMINIO/g" \
    -e "s#/var/www/hotnet-tecnico/dist#$PUBLISH_DIR#g" \
    -e "s/127\.0\.0\.1:8000/127.0.0.1:$BACKEND_PORT/g" \
    "$TEMPLATE_DIR/nginx.conf.example" > "/etc/nginx/sites-available/$DOMINIO.conf"
  nginx -t
  systemctl reload nginx
}

publicar_final_apache() {
  sed \
    -e "s/tecnico\.hotnet\.net\.br/$DOMINIO/g" \
    -e "s#/var/www/hotnet-tecnico/dist#$PUBLISH_DIR#g" \
    -e "s/127\.0\.0\.1:8000/127.0.0.1:$BACKEND_PORT/g" \
    "$TEMPLATE_DIR/apache-vhost.conf.example" > "/etc/apache2/sites-available/$DOMINIO.conf"
  apache2ctl configtest
  systemctl reload apache2
}

info "Publicando o vhost definitivo (HTTPS + reverse proxy pro backend local)..."
if [ "$WEBSERVER" = "nginx" ]; then publicar_final_nginx; else publicar_final_apache; fi

# --------------------------------------------------------------------------
# 17. Resumo
# --------------------------------------------------------------------------
echo
ok "Instalação concluída."
cat <<RESUMO

  Portal:          https://$DOMINIO
  Backend local:   127.0.0.1:$BACKEND_PORT (via reverse proxy /api/*)
  Backend real:    $CONTROLLR_URL (configurado em $ENV_FILE)
  Build em:        $PUBLISH_DIR
  Servidor web:    $WEBSERVER (compartilhado com outros sites já instalados)
  Serviço:         systemctl status $SERVICE_NAME
  Logs do backend: journalctl -u $SERVICE_NAME -f
  Certificado:     renovação automática via certbot.timer

  Pra atualizar depois (novo código + rebuild), rode este mesmo script de
  novo — ele detecta o que já está feito e só refaz o que mudou (git
  pull, pip install, npm ci, npm run build, reinicia o serviço, republica
  o dist/). Não reemite certificado nem mexe no vhost do app cliente.

RESUMO
