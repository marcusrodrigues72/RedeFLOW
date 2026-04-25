#!/usr/bin/env bash
# deploy-prod.sh — Build e deploy para o servidor AWS (EC2)
# Uso: ./scripts/deploy-prod.sh
set -euo pipefail

EC2_USER="ubuntu"
EC2_HOST="54.198.193.75"
EC2_KEY="/Users/marcusrodrigues/Projetos/Redeflow/education-20260408.pem"
REMOTE_DIR="/home/ubuntu/redeflow"

echo "==> [1/5] Build do shared e da API..."
pnpm --filter shared build
pnpm --filter api build

echo "==> [2/5] Build do frontend (produção)..."
pnpm --filter web build:prod

echo "==> [3/5] Enviando frontend para o servidor..."
rsync -avz --delete \
  -e "ssh -i $EC2_KEY -o StrictHostKeyChecking=no" \
  apps/web/dist/ \
  "$EC2_USER@$EC2_HOST:$REMOTE_DIR/apps/web/dist/"

echo "==> [4/5] Enviando API e schema Prisma..."
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.env' \
  -e "ssh -i $EC2_KEY -o StrictHostKeyChecking=no" \
  apps/api/dist/ \
  "$EC2_USER@$EC2_HOST:$REMOTE_DIR/apps/api/dist/"

# Envia schema.prisma para manter o Prisma Client em sincronia com o DB
rsync -avz \
  -e "ssh -i $EC2_KEY -o StrictHostKeyChecking=no" \
  apps/api/prisma/schema.prisma \
  "$EC2_USER@$EC2_HOST:$REMOTE_DIR/apps/api/prisma/schema.prisma"

echo "==> [5/5] Regenerando Prisma Client e reiniciando API..."
ssh -i "$EC2_KEY" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" \
  "cd $REMOTE_DIR/apps/api && source .env && npx prisma generate --schema prisma/schema.prisma && pm2 restart redeflow-api && pm2 save"

echo ""
echo "✅ Deploy concluído! https://flow.irede.org.br"
