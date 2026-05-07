# SubConverter-X Deployment Guide

Language: [简体中文](DEPLOYMENT.md) | English

This guide covers Docker deployment, source build deployment, manual deployment, production configuration, security hardening, monitoring, maintenance, and troubleshooting.

## Table of Contents

- [Server Requirements](#server-requirements)
- [Docker Deployment](#docker-deployment)
- [Manual Deployment](#manual-deployment)
- [Production Configuration](#production-configuration)
- [Security Hardening](#security-hardening)
- [Monitoring and Maintenance](#monitoring-and-maintenance)
- [Troubleshooting](#troubleshooting)

## Server Requirements

Minimum:

- CPU: 1 core
- Memory: 512 MB
- Disk: 10 GB
- OS: Ubuntu 20.04+, Debian 11+, or CentOS 8+

Recommended:

- CPU: 2 cores
- Memory: 2 GB
- Disk: 20 GB
- Bandwidth: 10 Mbps

Software:

- Docker 20.10+ and Docker Compose 2.0+ for Docker deployment.
- Or Node.js 22+ for manual deployment.
- Optional system Nginx if you want to manage 80/443 outside Compose.

## Docker Deployment

### 1. Install Docker

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

docker --version
docker compose version
```

### 2. Get the Project

```bash
cd /opt
git clone https://github.com/SaberLayer/SubConverter-X.git
cd SubConverter-X
```

If you use a fork, replace the repository URL with your own.

### 3. Configure Environment

```bash
cp .env.example .env
nano .env
```

Common values:

```env
EXTERNAL_HTTP_PORT=8080
EXTERNAL_HTTPS_PORT=8443
SUBCONVERTER_IMAGE=ghcr.io/saberlayer/subconverter-x:latest
DEPLOY_MODE=image
SUBSCRIPTION_TTL_DAYS=90
RULE_FETCH_TIMEOUT=8000
SUBSCRIPTION_FETCH_TIMEOUT=10000
```

For standard production ports:

```env
EXTERNAL_HTTP_PORT=80
EXTERNAL_HTTPS_PORT=443
```

### 4. Start the Service

#### Management Panel

```bash
chmod +x start.sh
./start.sh
```

The panel supports image deployment, source build deployment, port conflict detection, `.env` generation, service start, status, logs, update, and uninstall.

Scripted mode:

```bash
./start.sh --yes --no-register
./start.sh --dry-run
```

#### Prebuilt Image

```bash
docker compose -f docker-compose.image.yml up -d
docker compose -f docker-compose.image.yml logs -f
```

This mode does not require Node.js on the server. The default image is `ghcr.io/saberlayer/subconverter-x:latest`.

#### Source Build

```bash
docker compose up -d --build
docker compose logs -f
```

Use source build for development or custom forks.

### 5. Verify

```bash
docker compose -f docker-compose.image.yml ps
curl http://localhost:8080/health
curl http://localhost:8080/readyz
curl http://localhost:8080/api/openapi.json
```

Open `http://your-server-ip:8080` in a browser.

## HTTPS and Domain

Compose includes Nginx. In many cases, you only need to expose `EXTERNAL_HTTP_PORT` and `EXTERNAL_HTTPS_PORT`.

If you already run a system Nginx for 80/443, proxy it to Compose port `8080`.

Example system Nginx server:

```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

server {
    listen 80;
    server_name sub.yourdomain.com;

    client_max_body_size 10M;

    location / {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

For Let's Encrypt:

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d sub.yourdomain.com
```

## Manual Deployment

```bash
git clone https://github.com/SaberLayer/SubConverter-X.git
cd SubConverter-X
npm install
npm run build
```

Start backend:

```bash
cd packages/backend
DB_PATH=./data/subconverter-x.db PORT=3000 npm start
```

Use PM2 for production:

```bash
npm install -g pm2
pm2 start packages/backend/dist/index.js --name subconverter-x
pm2 save
pm2 startup
```

## Runtime Data

- SQLite database path defaults to `./data/subconverter-x.db`.
- Docker image deployment stores runtime data in the Compose volume at `/app/data/subconverter-x.db`.
- Short subscriptions are retained for 90 days by default. Set `SUBSCRIPTION_TTL_DAYS` to change the retention period.
- Short links preserve target format, rule template, proxy groups, external config template, and operators.
- When multiple remote subscriptions are merged, `subscription-userinfo` is merged and forwarded in direct and short subscription responses.

## Config Template Notes

- `configTemplate` and `configTemplateUrl` are mutually exclusive.
- Remote template URLs are protected by SSRF checks, response size limits, timeout, and redirect limits.
- If the template server is on a private network, do not point it to local management ports or cloud metadata addresses.
- Use `HTTP_PROXY` and `HTTPS_PROXY` if remote subscriptions, rules, or templates must be fetched through a proxy.

## Publishing Your Own GHCR Image

The repository includes `.github/workflows/docker-publish.yml`. Push to `main` or create a `v*.*.*` tag to publish:

```text
ghcr.io/<your-user-or-org>/subconverter-x:latest
ghcr.io/<your-user-or-org>/subconverter-x:sha-xxxxxxx
```

After publishing, set:

```env
SUBCONVERTER_IMAGE=ghcr.io/your-name/subconverter-x:latest
```

Fork users must enable GitHub Actions and allow package write permissions.

## Security Hardening

- Keep the service private or protect it behind your own access control if it handles sensitive subscription URLs.
- Do not expose raw subscription URLs, short-link tokens, UUIDs, passwords, private keys, or WireGuard keys in logs or issue reports.
- Keep `DB_PATH` on persistent storage with appropriate file permissions.
- Use HTTPS in production.
- Review reverse proxy request size and rate limits.
- Keep Docker images and Node dependencies updated.

## Monitoring and Maintenance

Useful commands:

```bash
docker compose -f docker-compose.image.yml ps
docker compose -f docker-compose.image.yml logs -f
docker compose -f docker-compose.image.yml restart
docker compose -f docker-compose.image.yml pull
docker compose -f docker-compose.image.yml up -d
```

For PM2:

```bash
pm2 status
pm2 logs subconverter-x
pm2 restart subconverter-x
```

Recommended maintenance:

- Check logs regularly.
- Back up the SQLite database.
- Clean expired short links if you customize storage behavior.
- Renew SSL certificates before expiration.
- Run `npm audit` before publishing source-based releases.

## Troubleshooting

### Port Is Already in Use

Use the management panel and choose deployment/reconfigure. It detects conflicts before writing the final config. Or edit:

```env
EXTERNAL_HTTP_PORT=8081
EXTERNAL_HTTPS_PORT=8444
```

Then restart:

```bash
docker compose -f docker-compose.image.yml up -d
```

### Service Is Not Ready

```bash
curl http://localhost:8080/health
curl http://localhost:8080/readyz
docker compose -f docker-compose.image.yml logs -f
```

### Conversion Output Is Empty

Check:

- Whether the input format is valid.
- Whether the target format supports the protocol.
- Whether response `warnings` include `UNSUPPORTED_PROTOCOL`, `FEATURE_PARTIAL`, or `TRANSPORT_DOWNGRADED`.
- Whether filters or operators removed all nodes.

AnyTLS currently has native output for Clash Meta/mihomo and sing-box, partial URI output for Base64/Shadowrocket/v2ray-uri/mixed, and is skipped for Surge/QX/Loon/V2Ray JSON.

### Remote Subscription Timeout

Increase timeout values:

```env
RULE_FETCH_TIMEOUT=8000
SUBSCRIPTION_FETCH_TIMEOUT=10000
# HTTP_PROXY=http://proxy-server:port
# HTTPS_PROXY=http://proxy-server:port
```

Then restart the service.

### SSL Renewal

```bash
certbot renew
docker compose -f docker-compose.image.yml restart nginx
```

## Related Documentation

- [README.en.md](README.en.md)
- [QUICK_START.en.md](QUICK_START.en.md)
- [CHANGELOG.en.md](CHANGELOG.en.md)
- Chinese: [README.md](README.md), [QUICK_START.md](QUICK_START.md), [DEPLOYMENT.md](DEPLOYMENT.md), [CHANGELOG.md](CHANGELOG.md)

Document version: v1.2

Last updated: 2026-05-07

Applies to: SubConverter-X v1.0.0+
