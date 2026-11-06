#!/usr/bin/env bash
# Server hardening after the 6 Nov 2026 hack (owner: "security tight karo"). Run from the Mac:
#   ssh -i ~/.ssh/neuraledge_vps root@148.72.247.91 'bash -s' < scripts/harden-server.sh check    ← only looks, changes nothing
#   ssh -i ~/.ssh/neuraledge_vps root@148.72.247.91 'bash -s' < scripts/harden-server.sh apply    ← makes the changes below
# Every change keeps a backup and is checked before it takes effect; running it twice is harmless.
#   1. SSH: key only — no passwords (the bots tried thousands), root only with a key, 3 tries per connection.
#   2. MySQL / MariaDB: only from inside the server (it was open to the whole internet on port 3306).
#   3. IRC (port 6667 out) and the attacker's control server blocked for good, also after a restart.
#   4. Automatic security updates for the operating system (cPanel already updates itself nightly).
set -uo pipefail
MODE="${1:-check}"
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$*"; }
info() { printf '  · %s\n' "$*"; }
STAMP="$(date +%Y%m%d-%H%M%S)"

echo "== 1. SSH"
DROP=/etc/ssh/sshd_config.d/00-shubhora-hardening.conf
if [ "$(grep -c . /root/.ssh/authorized_keys 2>/dev/null)" -lt 1 ]; then bad "no SSH key for root — NOT changing SSH (you would be locked out)"; SKIP_SSH=1; else SKIP_SSH=0; fi
EFF="$(sshd -T 2>/dev/null)"
for k in passwordauthentication kbdinteractiveauthentication permitrootlogin maxauthtries; do info "$k = $(echo "$EFF" | awk -v k=$k '$1==k{print $2}')"; done
if [ "$MODE" = apply ] && [ "$SKIP_SSH" = 0 ]; then
  printf '%s\n' "# Shubhora hardening $STAMP (scripts/harden-server.sh). First file read, so it wins over the others." \
    "PasswordAuthentication no" "KbdInteractiveAuthentication no" "PermitRootLogin prohibit-password" "MaxAuthTries 3" "LoginGraceTime 30" "X11Forwarding no" > "$DROP.new"
  [ -f "$DROP" ] && cp "$DROP" "$DROP.bak-$STAMP"
  mv "$DROP.new" "$DROP"; chmod 600 "$DROP"
  if sshd -t; then systemctl reload sshd
    if [ "$(sshd -T 2>/dev/null | awk '$1=="passwordauthentication"{print $2}')" = no ]; then ok "SSH: key only (passwords off). Open sessions stay connected."
    else bad "sshd does not read $DROP (no Include line in sshd_config) — set 'PasswordAuthentication no' in WHM → SSH Password Authorization Tweak"; fi
  else bad "sshd config test failed — change undone"; rm -f "$DROP"; [ -f "$DROP.bak-$STAMP" ] && mv "$DROP.bak-$STAMP" "$DROP"; fi
fi

echo "== 2. MySQL / MariaDB (port 3306)"
if ss -tln | grep -qE "(0\.0\.0\.0|\[::\]|\*):3306 "; then bad "3306 is open to the internet"; else ok "3306 only inside the server"; fi
REMOTE="$(ss -tn state established '( sport = :3306 )' 2>/dev/null | awk 'NR>1{print $4}' | grep -vE '^(127\.0\.0\.1|\[::1\]|\[::ffff:127\.0\.0\.1\])' | head -5)"
[ -n "$REMOTE" ] && bad "outside connections to MySQL right now: $REMOTE (check these before applying)" || info "no outside connections to MySQL right now"
if [ "$MODE" = apply ]; then
  CNF=/etc/my.cnf
  if grep -qE '^\s*bind-address\s*=\s*127\.0\.0\.1' "$CNF" 2>/dev/null; then ok "bind-address already 127.0.0.1"
  elif [ -n "$REMOTE" ]; then bad "skipped: something outside uses MySQL now — ask before closing it"
  else
    cp "$CNF" "$CNF.bak-$STAMP"
    if grep -q '^\[mysqld\]' "$CNF"; then sed -i '/^\[mysqld\]/a bind-address=127.0.0.1' "$CNF"; else printf '\n[mysqld]\nbind-address=127.0.0.1\n' >> "$CNF"; fi
    if /scripts/restartsrv_mysql >/dev/null 2>&1 || systemctl restart mariadb; then sleep 3
      if ss -tln | grep -qE "(0\.0\.0\.0|\[::\]|\*):3306 "; then bad "still open after restart — restoring the backup"; cp "$CNF.bak-$STAMP" "$CNF"; /scripts/restartsrv_mysql >/dev/null 2>&1 || systemctl restart mariadb
      else ok "MySQL now listens only inside the server"; fi
    else bad "MySQL did not restart — restoring the backup"; cp "$CNF.bak-$STAMP" "$CNF"; /scripts/restartsrv_mysql >/dev/null 2>&1 || systemctl restart mariadb; fi
  fi
fi

echo "== 3. Block IRC (6667) and the attacker's server 217.60.184.63, permanently"
UNIT=/etc/systemd/system/shubhora-block.service
[ -f "$UNIT" ] && ok "block service installed" || bad "block not permanent yet (today's rule goes away on a restart)"
if [ "$MODE" = apply ]; then
  printf '%s\n' "[Unit]" "Description=Shubhora: block IRC bots and the 6 Nov 2026 attacker (scripts/harden-server.sh)" "After=network.target" "" "[Service]" "Type=oneshot" "RemainAfterExit=yes" \
    "ExecStart=/bin/sh -c 'iptables -C OUTPUT -p tcp --dport 6667 -j DROP 2>/dev/null || iptables -I OUTPUT -p tcp --dport 6667 -j DROP; iptables -C OUTPUT -d 217.60.184.63 -j DROP 2>/dev/null || iptables -I OUTPUT -d 217.60.184.63 -j DROP; iptables -C INPUT -s 217.60.184.63 -j DROP 2>/dev/null || iptables -I INPUT -s 217.60.184.63 -j DROP'" \
    "" "[Install]" "WantedBy=multi-user.target" > "$UNIT"
  systemctl daemon-reload && systemctl enable --now shubhora-block.service >/dev/null 2>&1 && ok "block active now and after every restart"
fi

echo "== 4. Automatic security updates"
if systemctl is-enabled dnf-automatic-install.timer >/dev/null 2>&1 || systemctl is-enabled dnf-automatic.timer >/dev/null 2>&1; then ok "on"; else bad "off"; fi
if [ "$MODE" = apply ]; then
  rpm -q dnf-automatic >/dev/null 2>&1 || dnf -y -q install dnf-automatic >/dev/null 2>&1
  if [ -f /etc/dnf/automatic.conf ]; then
    cp /etc/dnf/automatic.conf "/etc/dnf/automatic.conf.bak-$STAMP"
    sed -i -E 's/^upgrade_type\s*=.*/upgrade_type = security/; s/^apply_updates\s*=.*/apply_updates = yes/' /etc/dnf/automatic.conf
    systemctl enable --now dnf-automatic.timer >/dev/null 2>&1 && ok "security updates install themselves daily"
  else bad "dnf-automatic could not be installed"; fi
fi

echo "== Also look at (not changed by this script)"
ss -tln | grep -E ":(8080) " >/dev/null && info "port 8080 (mobile server, runs as root) is open to the internet — put it behind HTTPS and run it as a normal user"
info "the Shubhora app runs as root (pm2) — on the next server, run it as its own user"
echo "done ($MODE)"
