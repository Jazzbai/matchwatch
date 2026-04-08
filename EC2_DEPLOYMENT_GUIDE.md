# MatchWatch EC2 Deployment Guide (HTTPS + rsync)

This is the exact flow for your setup:
- Domain: `matchwatch.us`
- EC2 Elastic IP: `44.215.158.165`
- SSH key: `~/matchwatch.pem`
- Deploy method: `rsync` (no GitHub)
- SSL: Nginx + Certbot

## 1. AWS checks first

Security Group inbound rules:
- `SSH` TCP `22` from your IP only
- `HTTP` TCP `80` from `0.0.0.0/0`
- `HTTPS` TCP `443` from `0.0.0.0/0`

DNS records:
- `A` record `@` -> `44.215.158.165`
- `CNAME` record `www` -> `@`

## 2. Local machine prep

```bash
chmod 400 ~/matchwatch.pem
ssh -i ~/matchwatch.pem ubuntu@44.215.158.165 "mkdir -p ~/JazzB-watchparty"
```

## 3. Install Docker + Nginx + Certbot on EC2

```bash
ssh -i ~/matchwatch.pem ubuntu@44.215.158.165
```

```bash
set -e
sudo apt update
sudo apt install -y ca-certificates curl gnupg lsb-release rsync nginx certbot python3-certbot-nginx

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
$(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo usermod -aG docker $USER
newgrp docker
```

## 4. rsync code to EC2

Run on local machine from project root:

```bash
cd ~/JazzB-watchparty
rsync -azP --delete \
  --filter=':- .gitignore' \
  --exclude='.git/' \
  --exclude='**/node_modules/' \
  --exclude='**/.next/' \
  --exclude='**/dist/' \
  --exclude='**/build/' \
  --exclude='**/coverage/' \
  --exclude='.env' \
  --exclude='.env.*' \
  --exclude='*.log' \
  -e "ssh -i ~/matchwatch.pem" \
  ./ ubuntu@44.215.158.165:~/JazzB-watchparty/
```

## 5. Create server `.env`

```bash
ssh -i ~/matchwatch.pem ubuntu@44.215.158.165
cd ~/JazzB-watchparty
cat > .env << 'EOF'
# ─── Database ────────────────────────────────────
DATABASE_URL=postgresql://matchwatch:matchwatch_dev@postgres:5432/matchwatch

# ─── Redis ───────────────────────────────────────
REDIS_URL=redis://redis:6379

# ─── API Server ──────────────────────────────────
PORT=4000
NODE_ENV=production
LOG_LEVEL=info

# ─── JWT (production) ────────────────────────────
JWT_SECRET=CHANGE_THIS_TO_A_LONG_RANDOM_SECRET
COOKIE_SECURE=true
AUTO_VERIFY_EMAIL=true
AUTH_RATE_LIMIT_MAX=200
PUBLIC_RATE_LIMIT_MAX=2000
MATCH_SYNC_PROVIDER=API_FOOTBALL
THE_SPORTS_DB_API_KEY=
JOLPICA_BASE_URL=https://api.jolpi.ca/ergast

# ─── CORS / App URL (HTTPS) ──────────────────────
CORS_ORIGINS=https://matchwatch.us,https://www.matchwatch.us
APP_URL=https://matchwatch.us

# ─── Frontend Proxy ──────────────────────────────
NEXT_PUBLIC_API_URL=/api/v1
API_PROXY_TARGET=http://api:4000

# ─── Match API keys ──────────────────────────────
FOOTBALL_DATA_API_KEY=YOUR_FOOTBALL_DATA_KEY
API_FOOTBALL_API_KEY=YOUR_API_FOOTBALL_KEY

# ─── AWS S3 ──────────────────────────────────────
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET=matchwatch-uploads
CDN_URL=

# ─── Email (Resend) ─────────────────────────────
RESEND_API_KEY=
EMAIL_FROM=noreply@matchwatch.us

# ─── Firebase Cloud Messaging ───────────────────
FCM_PROJECT_ID=
FCM_PRIVATE_KEY=
FCM_CLIENT_EMAIL=
SUPER_ADMIN_USERNAME=superadmin
SUPER_ADMIN_PASSWORD=
SUPER_ADMIN_PASSWORD_HASH=
SUPER_ADMIN_SESSION_SECRET=CHANGE_THIS_TO_A_LONG_RANDOM_SECRET
EOF
```

## 6. Start containers

```bash
cd ~/JazzB-watchparty
docker compose up -d --build
docker compose ps
```

Expected:
- `frontend` listening on host `3000`
- `api` listening on host `4000`

## 7. Configure Nginx reverse proxy

```bash
sudo tee /etc/nginx/sites-available/matchwatch >/dev/null << 'EOF'
server {
    listen 80;
    server_name matchwatch.us www.matchwatch.us;

    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/matchwatch /etc/nginx/sites-enabled/matchwatch
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx
```

## 8. Issue SSL certificate

```bash
sudo certbot --nginx -d matchwatch.us -d www.matchwatch.us --redirect
sudo certbot renew --dry-run
```

## 9. Verify HTTPS

```bash
curl -I http://matchwatch.us
curl -I https://matchwatch.us
curl -s https://matchwatch.us/api/v1/health || true
```

Expected:
- `http://` returns `301` redirect to `https://`
- `https://` returns `200`

## 10. Update deploy flow (resync + restart)

### Resync command (run on local machine)

```bash
cd ~/JazzB-watchparty
rsync -azP --delete \
  --filter=':- .gitignore' \
  --exclude='.git/' \
  --exclude='**/node_modules/' \
  --exclude='**/.next/' \
  --exclude='**/dist/' \
  --exclude='**/build/' \
  --exclude='**/coverage/' \
  --exclude='.env' \
  --exclude='.env.*' \
  --exclude='*.log' \
  -e "ssh -i ~/matchwatch.pem" \
  ./ ubuntu@44.215.158.165:~/JazzB-watchparty/
```

### Restart on EC2

```bash
ssh -i ~/matchwatch.pem ubuntu@44.215.158.165
cd ~/JazzB-watchparty
docker compose up -d --build
docker compose ps
sudo systemctl reload nginx
```

## 11. Useful commands

```bash
docker compose logs -f api
docker compose logs -f frontend
docker compose exec api printenv | grep SUPER_ADMIN || true
docker compose exec postgres psql -U matchwatch -d matchwatch -c "\dt"
docker compose exec postgres psql -U matchwatch -d matchwatch -c "\d+ venue_custom_events"
sudo nginx -t
sudo systemctl status nginx --no-pager
sudo certbot certificates
```

