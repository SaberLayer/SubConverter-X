# SubConverter-X - Self-hosted Subscription Converter

Language: [简体中文](README.md) | English

SubConverter-X is a privacy-first, self-hosted subscription converter for modern proxy clients. It supports VLESS Reality, xHTTP/SplitHTTP, AnyTLS, TUIC, Hysteria2, WireGuard, and other common protocols without sending node data to a third-party service.

## Highlights

- Modern protocol conversion with explicit compatibility warnings.
- Self-hosted deployment with Docker Compose, PM2, or local development.
- Prebuilt GHCR image and source-build deployment modes.
- Interactive `start.sh` management panel for deployment, update, status, logs, restart, stop, and uninstall.
- Short subscription links with TTL metadata, info endpoint, and local QR code output.
- External config templates and ordered node operators.
- OpenAPI document and built-in API docs.
- Chinese and English frontend UI.

## Quick Start

### Option 1: Management Script

```bash
git clone https://github.com/SaberLayer/SubConverter-X.git
cd SubConverter-X

chmod +x start.sh
./start.sh
```

The first run asks whether to register the global `subx` command. After registration, you can run `subx` from any directory. For scripted deployment:

```bash
./start.sh --yes --no-register
./start.sh --dry-run
```

### Option 2: Prebuilt Docker Image

```bash
cp .env.example .env
docker compose -f docker-compose.image.yml up -d
```

The default image is:

```env
SUBCONVERTER_IMAGE=ghcr.io/saberlayer/subconverter-x:latest
```

Fork users can publish their own GHCR image and override `SUBCONVERTER_IMAGE` in `.env`.

### Option 3: Build From Source

```bash
cp .env.example .env
docker compose up -d --build
```

Default access URL: `http://localhost:8080`.

### Option 4: Local Development

```bash
npm install
npm run dev:backend
npm run dev:frontend
```

The frontend dev server runs at `http://localhost:5173` and proxies API requests to backend port `3000`.

## Protocol Support

`Full` means the generator can express the main protocol fields. `Partial` means the output is usable but may lose advanced fields, downgrade transport, or require manual adjustment. `Unsupported` means the target format has no matching syntax and the node is skipped. The backend source of truth is `packages/backend/src/core/capability-matrix.ts`; API responses include `warnings`.

| Protocol | Parser | Clash Meta / Stash / Egern | sing-box | Surge / Surfboard | Quantumult X | Shadowrocket / Base64 URI | Loon | V2Ray JSON |
|----------|--------|----------------------------|----------|-------------------|--------------|---------------------------|------|------------|
| Shadowsocks | Full | Full | Full | Full | Full | Full | Full | Full |
| ShadowsocksR | Full | Full | Unsupported | Full | Full | Full | Full | Unsupported |
| VMess | Full | Full | Full | Full | Full | Full | Full | Full |
| VLESS | Full | Full | Full | Full | Full | Full | Full | Full |
| Trojan | Full | Full | Full | Full | Full | Full | Full | Full |
| Hysteria | Full | Full | Full | Unsupported | Unsupported | Partial | Unsupported | Unsupported |
| Hysteria2 | Full | Full | Full | Full | Full | Full | Full | Unsupported |
| TUIC | Full | Full | Full | Full | Full | Full | Full | Unsupported |
| WireGuard | Full | Full | Partial | Partial | Partial | Partial | Partial | Unsupported |
| AnyTLS | Full | Full | Full | Unsupported | Unsupported | Partial | Unsupported | Unsupported |
| SOCKS5 | Full | Full | Full | Full | Full | Full | Full | Full |
| HTTP/HTTPS | Full | Full | Full | Full | Full | Full | Full | Full |

### Compatibility Boundaries

- VLESS Reality + xHTTP: Clash Meta/mihomo preserves `reality-opts` and `xhttp-opts`; sing-box currently maps xHTTP/SplitHTTP to HTTPUpgrade; Surge/QX/Loon use WebSocket-like compatible fields.
- Trojan HTTPUpgrade: Clash Meta outputs `ws-opts.v2ray-http-upgrade=true`; URI-style targets keep `type=httpupgrade`.
- Hysteria2 obfs: Clash Meta, sing-box, Surge, QX, Shadowrocket/Base64, and Loon preserve salamander obfs password.
- TUIC: UUID, password, SNI, ALPN, congestion control, and UDP relay mode are preserved where the target supports them.
- WireGuard: many clients need local address, peer, and allowed IP context. SubConverter-X preserves key material, MTU, reserved bytes, and endpoint fields, but some targets return `FEATURE_PARTIAL`.
- AnyTLS: Clash Meta/mihomo and sing-box produce native AnyTLS output; URI-style targets output compatible `anytls://` links. SNI, ALPN, fingerprint, and session fields still depend on client support.

### Warning Codes

- `UNSUPPORTED_PROTOCOL`: the target format cannot represent the protocol and the node is skipped.
- `TRANSPORT_DOWNGRADED`: transport is mapped to a compatible lower-fidelity form.
- `FEATURE_PARTIAL`: core fields are emitted, but advanced fields may require manual adjustment.
- `FORMAT_ALIAS`: the target format reuses a compatible generator, such as Stash/Egern using Clash Meta output.

The frontend displays these warnings in the conversion result. API users can inspect the `warnings` field.

## Input Formats

- Standard URI lines such as `ss://`, `vmess://`, `vless://`, `trojan://`, `tuic://`, `hysteria2://`, `anytls://`.
- Clash / Clash Meta YAML.
- Clash / mihomo JSON with `proxies`.
- sing-box JSON.
- Quantumult X, Loon, and Surge snippets.
- Base64 encoded subscriptions.
- Remote subscription URLs. Multiple URLs can be pasted line by line and merged.

## Main Features

- Emoji flag enhancement based on node names.
- Node deduplication by endpoint and credential-aware fingerprints.
- Regex include/exclude, regex delete, regex sort, type filters, region filters, useless-node filtering, domain resolution, and rename rules.
- Automatic region proxy groups and custom proxy groups.
- Global UDP and skip-cert-verify controls.
- Preset storage in the frontend.
- External config templates with `configTemplate` or `configTemplateUrl`.
- Ordered `operators`: `filter`, `rename`, `set`, `sort`, and `dedupe`.
- Subscription traffic metadata merge through `subscription-userinfo`.

## API Overview

### Convert

```http
POST /api/convert
Content-Type: application/json
```

Key request fields:

```json
{
  "input": "vless://uuid@host:443?... or https://subscription.example/sub",
  "target": "clash-meta",
  "ruleTemplate": "bypass-cn",
  "include": "HK|Hong Kong",
  "exclude": "expired",
  "includeTypes": ["vmess", "vless"],
  "excludeTypes": ["ssr"],
  "includeRegions": ["HK", "JP"],
  "rename": "\\s*\\[.*?\\]@",
  "addEmoji": true,
  "deduplicate": true,
  "sort": "region",
  "enableUdp": true,
  "skipCertVerify": false,
  "autoRegionGroup": true,
  "proxyGroups": [],
  "configTemplateUrl": "https://example.com/template.yaml",
  "operators": [
    { "type": "filter", "protocols": ["vless", "trojan"] },
    { "type": "rename", "pattern": "^", "replacement": "OP-" },
    { "type": "set", "field": "udp", "value": true }
  ]
}
```

Important response fields:

```json
{
  "output": "port: 7890\n...",
  "nodeCount": 3,
  "subscriptionUserinfo": "upload=125; download=250; total=1500; expire=1990000000",
  "subscriptionUserinfoData": {
    "upload": 125,
    "download": 250,
    "total": 1500,
    "expire": 1990000000
  },
  "skipped": ["SSR-Old (ssr)"],
  "warnings": [
    {
      "code": "FEATURE_PARTIAL",
      "severity": "warning",
      "target": "singbox",
      "protocol": "wireguard",
      "message": "sing-box WireGuard output uses default local_address 10.0.0.2/32. Adjust it for your tunnel.",
      "nodes": ["WG-1"],
      "count": 1
    }
  ],
  "filteredOut": 1
}
```

### Short Subscription Link

```http
POST /api/shorten
Content-Type: application/json
```

```json
{
  "input": "...",
  "target": "clash-meta",
  "ruleTemplate": "bypass-cn",
  "addEmoji": true,
  "deduplicate": true,
  "autoRegionGroup": true
}
```

Response:

```json
{
  "token": "abc123",
  "url": "http://localhost:8080/api/sub/abc123",
  "expiresAt": 1777622400,
  "ttlDays": 90,
  "qrCodeDataUrl": "data:image/png;base64,..."
}
```

### Direct Subscription

```http
GET /api/sub/:token
GET /api/sub?url=https://subscription.example/sub&target=clash-meta&emoji=true&dedupe=true
```

`/api/convert` and `/api/shorten` support the full JSON payload, including `proxyGroups`, `configTemplate`, `configTemplateUrl`, and `operators`. Direct `/api/sub?url=...` subscriptions support query-parameter filtering, sorting, template URL, and basic switches. For complex operator pipelines, create a short subscription first.

### Helper Endpoints

```http
GET /api/convert/formats
GET /api/convert/rules
GET /api/sub/:token/info
GET /api/openapi.json
GET /api/docs
GET /health
GET /readyz
```

Short links are retained for 90 days by default. Set `SUBSCRIPTION_TTL_DAYS` to change the TTL.

## Config Templates

`configTemplate` and `configTemplateUrl` embed generated node fragments into a full configuration. Only one of them can be used at the same time. Remote template URLs are checked against SSRF rules, response size limits, timeouts, and redirect limits.

Supported placeholders:

| Placeholder | Description |
|-------------|-------------|
| `{{content}}` | Full generated text |
| `{{proxies}}` | Proxy list fragment |
| `{{proxyGroups}}` | Proxy group fragment |
| `{{rules}}` | Rule fragment |
| `{{dns}}` | DNS fragment |
| `{{nodeNames}}` | Node names, one per line |

## Rule Templates

| ID | Name | Description | Source |
|----|------|-------------|--------|
| `bypass-cn` | Bypass China Mainland | China IP/domain direct, others proxy | Built-in |
| `global` | Global Proxy | All traffic through proxy | Built-in |
| `acl4ssr-balanced` | ACL4SSR Balanced | Ads blocking, China direct, major services split | Remote |
| `acl4ssr-full` | ACL4SSR Full | Adds Microsoft, Apple, Spotify, Steam, OpenAI, and more | Remote |

Remote ACL4SSR rules use a three-level fallback: remote fetch, local cache, then skip category. The cache directory is `packages/backend/.rule-cache/`.

## Regression Fixtures

Regression tests read real input samples from `packages/backend/src/tests/fixtures/input/`:

- `modern-mixed.txt`: VLESS Reality xHTTP, Trojan HTTPUpgrade, Hysteria2 obfs, TUIC, WireGuard, AnyTLS, SSR.
- `messy-realworld.txt`: localized node names, duplicates, invalid lines, missing Reality fields, gRPC, and mixed real-world inputs.

When adding a protocol or generator, update fixtures and validate parsing fields, target output, and round-trip behavior in `packages/backend/src/tests/regression.ts`.

## Target Formats

| ID | Client |
|----|--------|
| `auto` | Detect by User-Agent |
| `clash` | Clash compatible output |
| `clashr` | ClashR compatible output |
| `clash-meta` | Clash Meta / mihomo |
| `stash` | Stash |
| `singbox` | sing-box |
| `surge` | Surge 5 |
| `surgemac` | Surge Mac compatible output |
| `egern` | Egern |
| `surfboard` | Surfboard |
| `quantumultx` | Quantumult X |
| `shadowrocket` | Shadowrocket |
| `loon` | Loon |
| `v2ray` | V2Ray / Xray JSON |
| `v2ray-uri` | V2Ray URI |
| `mixed` | Mixed plain URI |
| `base64` | Generic Base64 URI subscription |
| `plain-json` | Unified node JSON |

## Project Structure

```text
SubConverter-X/
├── packages/
│   ├── backend/src/
│   │   ├── core/
│   │   │   ├── capability-matrix.ts
│   │   │   ├── config-template.ts
│   │   │   └── node-operators.ts
│   │   ├── parsers/
│   │   ├── generators/
│   │   ├── rules/
│   │   └── routes/
│   └── frontend/src/
├── Dockerfile
├── docker-compose.yml
└── docker-compose.image.yml
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Backend listen port |
| `DB_PATH` | `./data/subconverter-x.db` | SQLite database path |
| `EXTERNAL_HTTP_PORT` | `8080` | External HTTP port |
| `EXTERNAL_HTTPS_PORT` | `8443` | External HTTPS port |
| `SUBCONVERTER_IMAGE` | `ghcr.io/saberlayer/subconverter-x:latest` | Image used by prebuilt image deployment |
| `DEPLOY_MODE` | `image` | `image` for prebuilt image, `source` for local source build |
| `SUBSCRIPTION_TTL_DAYS` | `90` | Short subscription retention days |
| `RULE_FETCH_TIMEOUT` | `8000` | Remote rule fetch timeout in milliseconds |
| `SUBSCRIPTION_FETCH_TIMEOUT` | `10000` | Remote subscription fetch timeout in milliseconds |
| `HTTP_PROXY` / `HTTPS_PROXY` | empty | Outbound proxy for fetching subscriptions, rules, or config templates |
| `DOMAIN` | empty | Optional domain |

## Documentation

- [README.md](README.md) / [README.en.md](README.en.md)
- [QUICK_START.md](QUICK_START.md) / [QUICK_START.en.md](QUICK_START.en.md)
- [DEPLOYMENT.md](DEPLOYMENT.md) / [DEPLOYMENT.en.md](DEPLOYMENT.en.md)
- [CHANGELOG.md](CHANGELOG.md) / [CHANGELOG.en.md](CHANGELOG.en.md)

## License

MIT License
