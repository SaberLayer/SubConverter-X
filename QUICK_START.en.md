# SubConverter-X Quick Start

Language: [简体中文](QUICK_START.md) | English

## What Is New

### 1. Modern Protocol Conversion

SubConverter-X supports VLESS Reality, xHTTP/SplitHTTP, TUIC, Hysteria2, WireGuard, AnyTLS, and other modern protocols. Conversion results include compatibility warnings when a target format is full, partial, or unsupported.

### 2. Compatibility Report

The frontend displays target format, supported nodes, skipped nodes, and grouped warning codes. API responses also return `warnings` for automation.

### 3. Short Subscription Links

Short links are retained for 90 days by default. Set `SUBSCRIPTION_TTL_DAYS` to change the TTL. Short-link creation returns expiration metadata and a local QR code data URL.

### 4. Config Templates and Node Operators

Use `configTemplate` or `configTemplateUrl` to embed generated node fragments into full configs. Use `operators` to run ordered `filter`, `rename`, `set`, `sort`, and `dedupe` operations.

### 5. Flexible Ports, Nginx, SSL, and UI Language

Docker deployment includes Nginx, custom HTTP/HTTPS ports, optional domain/SSL setup, and Chinese/English UI switching.

## One-command Deployment

```bash
git clone https://github.com/SaberLayer/SubConverter-X.git
cd SubConverter-X

chmod +x start.sh
./start.sh
```

The management panel can deploy, update, show status, restart, stop, show logs, and uninstall. The deploy flow asks for:

1. Deployment mode: prebuilt image or source build.
2. Protocol: HTTP or HTTPS.
3. Ports, with conflict detection.
4. Domain, optional for HTTP and required for HTTPS.
5. Certificate mode for HTTPS.
6. Final confirmation.

For scripted deployment:

```bash
./start.sh --yes --no-register
./start.sh --dry-run
```

## Docker Image Deployment

For normal usage, use the prebuilt image:

```bash
cp .env.example .env
docker compose -f docker-compose.image.yml up -d
```

Default URL: `http://localhost:8080`.

If you publish your own image, set it in `.env`:

```env
SUBCONVERTER_IMAGE=ghcr.io/your-name/subconverter-x:latest
```

## Source Build Deployment

```bash
cp .env.example .env
docker compose up -d --build
```

Use this mode for development or customization.

## Local Development

```bash
npm install
npm run dev:backend
npm run dev:frontend
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- API docs after deployment: `/api/docs`
- OpenAPI JSON: `/api/openapi.json`

## Basic Environment

```env
PORT=3000
EXTERNAL_HTTP_PORT=8080
EXTERNAL_HTTPS_PORT=8443
SUBCONVERTER_IMAGE=ghcr.io/saberlayer/subconverter-x:latest
DEPLOY_MODE=image
DB_PATH=./data/subconverter-x.db
SUBSCRIPTION_TTL_DAYS=90
RULE_FETCH_TIMEOUT=8000
SUBSCRIPTION_FETCH_TIMEOUT=10000
# HTTP_PROXY=http://proxy.example.com:7890
# HTTPS_PROXY=http://proxy.example.com:7890
```

## Verify Deployment

```bash
docker compose -f docker-compose.image.yml ps
curl http://localhost:8080/health
curl http://localhost:8080/readyz
curl http://localhost:8080/api/openapi.json
```

If you deployed from source, remove `-f docker-compose.image.yml` from Docker commands.

## Common Operations

### View Logs

```bash
docker compose -f docker-compose.image.yml logs -f
```

Or run `subx` and choose `6`.

### Update Service

```bash
git pull
docker compose -f docker-compose.image.yml pull
docker compose -f docker-compose.image.yml up -d
```

Or run `subx` and choose `2`.

### Restart Service

```bash
docker compose -f docker-compose.image.yml restart
```

## FAQ

### Why are some nodes skipped?

Not every client can express every protocol feature. For example, AnyTLS has native output for Clash Meta/mihomo and sing-box, partial URI output for Base64/Shadowrocket/v2ray-uri/mixed, and is skipped for Surge/QX/Loon/V2Ray JSON. Check `README.md` or `README.en.md` and the response `warnings`.

### How do config templates work?

Set either an inline `configTemplate` or a remote `configTemplateUrl`. Supported placeholders include `{{content}}`, `{{proxies}}`, `{{proxyGroups}}`, `{{rules}}`, `{{dns}}`, and `{{nodeNames}}`. Remote templates are protected by SSRF checks and response limits.

### Where are short links stored?

Short links are stored in SQLite. In Docker deployment, the database is stored in the mounted data volume at `/app/data/subconverter-x.db`.

### How do I add a new frontend language?

1. Add a locale file in `packages/frontend/src/locales/`, such as `ja.json`.
2. Translate from `en.json`.
3. Register it in `packages/frontend/src/i18n.ts`.
4. Update `LanguageSwitcher.tsx`.

## Project Map

```text
SubConverter-X/
├── .env.example
├── start.sh
├── docker-compose.yml
├── docker-compose.image.yml
├── packages/
│   ├── backend/src/core/
│   │   ├── capability-matrix.ts
│   │   ├── config-template.ts
│   │   └── node-operators.ts
│   ├── backend/src/tests/fixtures/input/
│   └── frontend/src/locales/
└── docs in root
```

## More Documentation

- Project overview: [README.en.md](README.en.md)
- Full deployment guide: [DEPLOYMENT.en.md](DEPLOYMENT.en.md)
- Changelog: [CHANGELOG.en.md](CHANGELOG.en.md)
- Chinese docs: [README.md](README.md), [QUICK_START.md](QUICK_START.md), [DEPLOYMENT.md](DEPLOYMENT.md)

## Version

- Current version: v1.0.0
- Updated: 2026-05-07
- Main improvements:
  - Protocol capability matrix and compatibility report.
  - AnyTLS, xHTTP, TUIC, Hysteria2, WireGuard fixture coverage.
  - External config templates and node operators.
  - `subscription-userinfo` merge and short-link TTL/QR code.
  - GHCR image publishing workflow and prebuilt-image deployment.
