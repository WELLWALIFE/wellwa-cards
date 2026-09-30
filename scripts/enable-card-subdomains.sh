#!/usr/bin/env bash
# Card links as <name>.shubhora.com — one-time server setup. Run on the MAC:
#   bash "/Users/jsrao/Desktop/Wellwa Life/wellwa-cards/scripts/enable-card-subdomains.sh"
#
# Before running: GoDaddy → shubhora.com → DNS → Add record: Type A, Name *, Value 148.72.247.91, TTL 1 hour.
#
# What it does on the server (nothing else is touched):
#   1. checks that *.shubhora.com already points at the server
#   2. gets ONE certificate for shubhora.com + *.shubhora.com (Let's Encrypt DNS check: it prints a TXT value,
#      you add it in GoDaddy, wait a minute, press Enter)
#   3. adds a separate web-server site "zz-shubhora-cards" that sends every <name>.shubhora.com to the app
#      (the existing shubhora.com site config is not edited)
#
# Afterwards just deploy (bash deploy.sh): it sees the certificate and switches every card link to <name>.shubhora.com.
#
# Renewal: a wildcard certificate from the DNS check can't renew by itself. Run this same script again every
# ~80 days (it skips everything that's already done and only renews when fewer than 30 days are left).
set -euo pipefail

SERVER="root@148.72.247.91"
KEY="$HOME/.ssh/neuraledge_vps"
DOMAIN="shubhora.com"
SSH="ssh -i $KEY -o IdentitiesOnly=yes -o ConnectTimeout=60 -o ServerAliveInterval=30"

cat > /tmp/card-subdomains-remote.sh <<'REMOTE'
#!/usr/bin/env bash
set -euo pipefail
DOMAIN="shubhora.com"
IP="148.72.247.91"
CERT="shubhora-wild"
LIVE="/etc/letsencrypt/live/$CERT"

echo "→ 1/3 checking DNS for *.${DOMAIN}…"
probe="dns-check-$RANDOM.${DOMAIN}"
got=$(getent ahostsv4 "$probe" 2>/dev/null | awk 'NR==1{print $1}' || true)
if [ "$got" != "$IP" ]; then
  echo "!! $probe does not point at $IP yet (got: ${got:-nothing})."
  echo "   GoDaddy → $DOMAIN → DNS → Add: Type A, Name *, Value $IP. Wait 10–30 minutes and run again."
  exit 1
fi
echo "   ok — *.${DOMAIN} → $IP"

echo "→ 2/3 certificate for ${DOMAIN} + *.${DOMAIN}…"
command -v certbot >/dev/null || { apt-get update -qq && apt-get install -y -qq certbot; }
need=1
if [ -f "$LIVE/fullchain.pem" ] && openssl x509 -checkend $((30*86400)) -noout -in "$LIVE/fullchain.pem" >/dev/null 2>&1; then
  need=0; echo "   certificate is valid for 30+ more days — skipping"
fi
if [ "$need" = 1 ]; then
  echo
  echo "   certbot will now show a TXT value. In GoDaddy → $DOMAIN → DNS add:"
  echo "     Type TXT · Name _acme-challenge · Value <the value shown> · TTL 1/2 hour"
  echo "   (if it asks for a SECOND value, add a second TXT record with the same name — keep both)."
  echo "   Wait 1–2 minutes after saving, then press Enter in certbot."
  echo
  certbot certonly --manual --preferred-challenges dns --cert-name "$CERT" \
    -d "$DOMAIN" -d "*.$DOMAIN" --agree-tos --register-unsafely-without-email
fi
[ -f "$LIVE/fullchain.pem" ] || { echo "!! no certificate at $LIVE"; exit 1; }

echo "→ 3/3 web server site for *.${DOMAIN}…"
if command -v apache2ctl >/dev/null && systemctl is-active --quiet apache2; then
  PORT=$(grep -rhoE "ProxyPass[[:space:]]+/[[:space:]]+http://(127\.0\.0\.1|localhost):[0-9]+" /etc/apache2/sites-enabled/ 2>/dev/null \
         | grep -oE "[0-9]+$" | head -1)
  PORT=${PORT:-3000}
  a2enmod -q ssl proxy proxy_http headers rewrite >/dev/null
  # "zz-" loads it after the existing sites, so shubhora.com / www keep matching their own site first.
  cat > /etc/apache2/sites-available/zz-shubhora-cards.conf <<CONF
# <name>.shubhora.com → the Shubhora app (card subdomains). Written by scripts/enable-card-subdomains.sh.
<VirtualHost *:80>
  ServerName cards.${DOMAIN}
  ServerAlias *.${DOMAIN}
  RewriteEngine On
  RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
</VirtualHost>
<VirtualHost *:443>
  ServerName cards.${DOMAIN}
  ServerAlias *.${DOMAIN}
  SSLEngine on
  SSLCertificateFile ${LIVE}/fullchain.pem
  SSLCertificateKeyFile ${LIVE}/privkey.pem
  ProxyPreserveHost On
  ProxyRequests Off
  RequestHeader set X-Forwarded-Proto "https"
  ProxyPass / http://127.0.0.1:${PORT}/
  ProxyPassReverse / http://127.0.0.1:${PORT}/
</VirtualHost>
CONF
  a2ensite -q zz-shubhora-cards >/dev/null
  apache2ctl configtest
  systemctl reload apache2
  echo "   Apache site added (app on port $PORT)"
elif command -v nginx >/dev/null && systemctl is-active --quiet nginx; then
  PORT=$(grep -rhoE "proxy_pass[[:space:]]+http://(127\.0\.0\.1|localhost):[0-9]+" /etc/nginx/ 2>/dev/null | grep -oE "[0-9]+$" | head -1)
  PORT=${PORT:-3000}
  cat > /etc/nginx/sites-available/zz-shubhora-cards <<CONF
# <name>.shubhora.com → the Shubhora app (card subdomains). Written by scripts/enable-card-subdomains.sh.
server { listen 80; server_name *.${DOMAIN}; return 301 https://\$host\$request_uri; }
server {
  listen 443 ssl; server_name *.${DOMAIN};
  ssl_certificate ${LIVE}/fullchain.pem; ssl_certificate_key ${LIVE}/privkey.pem;
  client_max_body_size 50m;
  location / {
    proxy_pass http://127.0.0.1:${PORT};
    proxy_set_header Host \$host; proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for; proxy_set_header X-Real-IP \$remote_addr;
  }
}
CONF
  ln -sf /etc/nginx/sites-available/zz-shubhora-cards /etc/nginx/sites-enabled/zz-shubhora-cards
  nginx -t
  systemctl reload nginx
  echo "   nginx site added (app on port $PORT)"
else
  echo "!! neither Apache nor nginx is running — nothing configured"; exit 1
fi

echo
code=$(curl -s -o /dev/null -w "%{http_code}" --resolve "setup-test.${DOMAIN}:443:127.0.0.1" "https://setup-test.${DOMAIN}/" --max-time 20 || true)
echo "✓ done — https://setup-test.${DOMAIN}/ answers $code (404 'card not found' is fine: no card has that name)."
echo "  Now deploy from the Mac (bash deploy.sh) — card links switch to <name>.shubhora.com automatically."
REMOTE

scp -q -i "$KEY" -o IdentitiesOnly=yes /tmp/card-subdomains-remote.sh "$SERVER:/root/card-subdomains-remote.sh"
$SSH -t "$SERVER" "bash /root/card-subdomains-remote.sh"
