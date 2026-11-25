#!/usr/bin/env bash
# Run on the production host only after the 24.04 upgrade and reboot checks.
set -euo pipefail
test "$(id -u)" = 0 || { echo 'Run as root.' >&2; exit 1; }
. /etc/os-release
test "$ID:$VERSION_ID" = ubuntu:24.04 || { echo 'Requires Ubuntu 24.04.' >&2; exit 1; }
test ! -e /var/run/reboot-required || { echo 'Reboot before installing Docker.' >&2; exit 1; }
dpkg --audit
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl gnupg
install -d -m 0755 /etc/apt/keyrings
curl -fsSL --connect-timeout 10 --max-time 60 https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
fingerprint=$(gpg --batch --show-keys --with-colons /etc/apt/keyrings/docker.asc | awk -F: '$1=="fpr" {print $10; exit}')
test "$fingerprint" = 9DC858229FC7DD38854AE2D88D81803C0EBFCD88 || { echo 'Unexpected Docker signing key.' >&2; exit 1; }
chmod 0644 /etc/apt/keyrings/docker.asc
cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: noble
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
install -d -m 0700 /var/backups/finfolk-bootstrap
dpkg-query -W docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin > /var/backups/finfolk-bootstrap/docker-versions.txt
docker version
docker compose version
# A short-lived local container validates image pull and execution, without publishing ports.
docker run --rm hello-world
