#!/usr/bin/env bash
# Bring a white-label brand domain online, so every member subdomain works:
#   rajkumar.wellwalife.com, priya.wellwalife.com, … all serve their card.
#
#   add-brand.sh wellwalife.com
#
# The brand adds ONE wildcard DNS record (*.wellwalife.com → this server) and
# this script does the rest. Certificates are issued per subdomain on demand by
# add-domain.sh, so no wildcard certificate (and no registrar API access) is
# needed to get started — see the note at the bottom for the scale option.
#
# Installed at /opt/neuraledge/bin/add-brand.sh, called by the app via sudo.
set -euo pipefail

DOMAIN="${1:-}"
APP_PORT=3001
ACME_ROOT=/opt/neuraledge/acme
VHOST_DIR=/etc/apache2/conf.d/includes/neuraledge-domains

if ! [[ "$DOMAIN" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$ ]]; then
  echo "invalid domain: $DOMAIN" >&2
  exit 2
fi
case "$DOMAIN" in
  neuraledge.me|*.neuraledge.me|localhost) echo "refusing platform domain: $DOMAIN" >&2; exit 2 ;;
esac

mkdir -p "$ACME_ROOT/.well-known/acme-challenge" "$VHOST_DIR"

# :80 wildcard — lets Let's Encrypt validate any member subdomain, and sends
# real traffic to HTTPS.
#
# The 90- prefix keeps this AFTER the per-domain files: Apache takes the first
# vhost whose name matches, and cPanel's own vhosts (mail., webmail., cpanel.,
# the main site) are defined earlier in httpd.conf, so they keep winning. This
# only ever catches subdomains nobody else claimed.
cat > "$VHOST_DIR/90-$DOMAIN-brand-http.conf" <<HTTP
<VirtualHost 148.72.247.91:80>
    ServerName brand-$DOMAIN
    ServerAlias *.$DOMAIN
    Alias /.well-known/acme-challenge $ACME_ROOT/.well-known/acme-challenge
    <Directory "$ACME_ROOT">
        Require all granted
    </Directory>
    RewriteEngine On
    RewriteCond %{REQUEST_URI} !^/\.well-known/acme-challenge/
    RewriteRule ^(.*)\$ https://%{HTTP_HOST}\$1 [R=301,L]
</VirtualHost>
HTTP

# :443 wildcard, used only when a wildcard certificate exists. Without one we
# skip it: a vhost pointing at a missing certificate file fails configtest and
# would take the whole server's Apache down on the next reload.
WILDCARD_CERT="/etc/letsencrypt/live/$DOMAIN-wildcard/fullchain.pem"
if [ -f "$WILDCARD_CERT" ]; then
  cat > "$VHOST_DIR/91-$DOMAIN-brand-https.conf" <<HTTPS
<VirtualHost 148.72.247.91:443>
    ServerName brand-$DOMAIN
    ServerAlias *.$DOMAIN
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/$DOMAIN-wildcard/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/$DOMAIN-wildcard/privkey.pem
    ProxyPreserveHost On
    RequestHeader set X-Forwarded-Proto "https"
    ProxyPass / http://127.0.0.1:$APP_PORT/
    ProxyPassReverse / http://127.0.0.1:$APP_PORT/
</VirtualHost>
HTTPS
else
  rm -f "$VHOST_DIR/91-$DOMAIN-brand-https.conf"
fi

if ! apachectl configtest; then
  rm -f "$VHOST_DIR/90-$DOMAIN-brand-http.conf" "$VHOST_DIR/91-$DOMAIN-brand-https.conf"
  echo "apache config test failed; rolled back $DOMAIN" >&2
  exit 1
fi
systemctl reload httpd

echo "ok $DOMAIN"
echo "note: member subdomains get their own certificate on first publish."
echo "      for a wildcard certificate instead (no per-subdomain rate limit), run:"
echo "      certbot certonly --manual --preferred-challenges dns \\"
echo "        -d '*.$DOMAIN' --cert-name $DOMAIN-wildcard  # then re-run this script"
