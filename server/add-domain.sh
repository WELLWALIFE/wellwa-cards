#!/usr/bin/env bash
# Bring a customer's custom domain online:
#   1. get a Let's Encrypt certificate for it (HTTP-01, served from the ACME dir)
#   2. write an Apache vhost proxying it to the NeuralEdge app
#   3. reload Apache
#
# Installed at /opt/neuraledge/bin/add-domain.sh and called by the app via sudo.
# Safe to re-run: certbot keeps the existing cert and the vhost is rewritten.
#
#   add-domain.sh card.somebusiness.com
set -euo pipefail

DOMAIN="${1:-}"
APP_PORT=3001
ACME_ROOT=/opt/neuraledge/acme
VHOST_DIR=/etc/apache2/conf.d/includes/neuraledge-domains
EMAIL="${LE_EMAIL:-wellwalife@gmail.com}"

# Reject anything that isn't a plain hostname — this runs as root via sudo, so
# the argument is never allowed to become shell.
if ! [[ "$DOMAIN" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$ ]]; then
  echo "invalid domain: $DOMAIN" >&2
  exit 2
fi
# Never let a caller mint a certificate for the platform's own hostnames.
case "$DOMAIN" in
  neuraledge.me|*.neuraledge.me|shubhora.com|*.shubhora.com|localhost) echo "refusing platform domain: $DOMAIN" >&2; exit 2 ;;
esac

# Never take over a site this server already serves (cPanel accounts such as wellwalife.com, or the platform's own
# vhosts): a customer typing someone else's domain must not replace that website with their card.
ESC="${DOMAIN//./\\.}"
BASE="${DOMAIN#www.}"; BESC="${BASE//./\\.}"
if grep -qiE "^(${ESC}|${BESC}):" /etc/userdomains 2>/dev/null \
   || grep -qsiE "^[[:space:]]*Server(Name|Alias)[[:space:]](.*[[:space:]])?${ESC}([[:space:]]|\$)" /etc/apache2/conf/httpd.conf /etc/apache2/conf.d/includes/*.conf; then
  echo "refusing: $DOMAIN is already served by another site on this server" >&2
  exit 3
fi

mkdir -p "$ACME_ROOT/.well-known/acme-challenge" "$VHOST_DIR"

# The :80 vhost must exist before certbot runs, so HTTP-01 validation has
# somewhere to land.
cat > "$VHOST_DIR/00-acme.conf" <<ACME
# Catch-all for custom domains on :80 — serves ACME challenges from disk and
# sends everything else to HTTPS. Listed first so it wins for unknown hosts.
<VirtualHost 148.72.247.91:80>
    ServerName neuraledge-acme.invalid
    Alias /.well-known/acme-challenge $ACME_ROOT/.well-known/acme-challenge
    <Directory "$ACME_ROOT">
        Require all granted
    </Directory>
</VirtualHost>
ACME

# --- 1. certificate -------------------------------------------------------
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  # Add the domain to the :80 catch-all so validation resolves here.
  cat > "$VHOST_DIR/10-$DOMAIN-http.conf" <<HTTP
<VirtualHost 148.72.247.91:80>
    ServerName $DOMAIN
    Alias /.well-known/acme-challenge $ACME_ROOT/.well-known/acme-challenge
    <Directory "$ACME_ROOT">
        Require all granted
    </Directory>
    RewriteEngine On
    RewriteCond %{REQUEST_URI} !^/\.well-known/acme-challenge/
    RewriteRule ^(.*)\$ https://$DOMAIN\$1 [R=301,L]
</VirtualHost>
HTTP
  apachectl configtest && systemctl reload httpd

  certbot certonly --webroot -w "$ACME_ROOT" -d "$DOMAIN" \
    --non-interactive --agree-tos -m "$EMAIL" --keep-until-expiring
fi

# --- 2. https vhost -------------------------------------------------------
cat > "$VHOST_DIR/20-$DOMAIN-https.conf" <<HTTPS
<VirtualHost 148.72.247.91:443>
    ServerName $DOMAIN
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/$DOMAIN/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/$DOMAIN/privkey.pem
    ProxyPreserveHost On
    RequestHeader set X-Forwarded-Proto "https"
    ProxyPass / http://127.0.0.1:$APP_PORT/
    ProxyPassReverse / http://127.0.0.1:$APP_PORT/
</VirtualHost>
HTTPS

# --- 3. reload ------------------------------------------------------------
# configtest first: a bad file must never take the other sites on this box down.
if ! apachectl configtest; then
  rm -f "$VHOST_DIR/20-$DOMAIN-https.conf" "$VHOST_DIR/10-$DOMAIN-http.conf"
  echo "apache config test failed; rolled back $DOMAIN" >&2
  exit 1
fi
systemctl reload httpd

echo "ok $DOMAIN"
