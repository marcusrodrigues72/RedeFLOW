#!/usr/bin/env bash
# deploy-prod.sh — Build e deploy para o servidor AWS (EC2)
# Uso: ./scripts/deploy-prod.sh
set -euo pipefail

EC2_USER="ubuntu"
EC2_HOST="54.145.212.36"
EC2_KEY="/Users/marcusrodrigues/Projetos/Redeflow/education-20260408.pem"
REMOTE_DIR="/home/ubuntu/redeflow"

echo "==> [1/4] Build do shared e da API..."
pnpm --filter shared build
pnpm --filter api build

echo "==> [2/4] Build do frontend (produção)..."
pnpm --filter web build:prod

echo "==> [3/4] Enviando frontend para o servidor..."
rsync -avz --delete \
  -e "ssh -i $EC2_KEY -o StrictHostKeyChecking=no" \
  apps/web/dist/ \
  "$EC2_USER@$EC2_HOST:$REMOTE_DIR/apps/web/dist/"

echo "==> [4/4] Enviando API e reiniciando..."
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.env' \
  -e "ssh -i $EC2_KEY -o StrictHostKeyChecking=no" \
  apps/api/dist/ \
  "$EC2_USER@$EC2_HOST:$REMOTE_DIR/apps/api/dist/"

ssh -i "$EC2_KEY" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" \
  "pm2 restart redeflow-api && pm2 save"

echo ""
echo "✅ Deploy concluído! https://flow.irede.org.br"
