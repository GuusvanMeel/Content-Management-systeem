#!/bin/sh
# Creates a self-signed certificate for local development in nginx/certs/.
# Production needs a real certificate (for example Let's Encrypt) instead.
set -e

# Git Bash on Windows would otherwise rewrite "/CN=localhost" into a Windows path.
export MSYS_NO_PATHCONV=1

cd "$(dirname "$0")"
mkdir -p certs

openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
  -keyout certs/server.key \
  -out certs/server.crt \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

echo "Certificate written to nginx/certs/"
