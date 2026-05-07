# Changelog

Language: [简体中文](CHANGELOG.md) | English

This file records notable changes in SubConverter-X.

## [Unreleased] - 2026-05-07

### Added

- Added API request validation, security audit helpers, health checks, and OpenAPI documentation.
- Added short-link TTL, short-link info endpoint, and local QR code output.
- Added protocol capability matrix with full, partial, and unsupported status per target format.
- Added conversion `warnings` for unsupported protocols, downgraded transports, partial features, and format aliases.
- Added modern golden fixtures covering VLESS Reality xHTTP, Trojan HTTPUpgrade, Hysteria2 obfs, TUIC, WireGuard, AnyTLS, and SSR.
- Added external config template support:
  - `configTemplate` and `configTemplateUrl`
  - `{{content}}`, `{{proxies}}`, `{{proxyGroups}}`, `{{rules}}`, `{{dns}}`, and `{{nodeNames}}`
  - Shared rendering support for normal conversion, direct subscription, and short subscription flows
- Added ordered node `operators`: `filter`, `rename`, `set`, `sort`, and `dedupe`.
- Added `subscription-userinfo` merge: `upload`, `download`, and `total` are summed; `expire` uses the earliest expiration.
- Added AnyTLS support:
  - URI, Clash/mihomo, and sing-box input parsing
  - Native Clash Meta/mihomo and sing-box output
  - Compatible `anytls://` URI output for Base64, Shadowrocket, v2ray-uri, and mixed targets
- Added GHCR image publishing workflow and prebuilt-image deployment mode.
- Added English documentation set: `README.en.md`, `QUICK_START.en.md`, `DEPLOYMENT.en.md`, and `CHANGELOG.en.md`.

### Changed

- Upgraded frontend compatibility hints into a compatibility report with supported nodes, filtered nodes, skipped nodes, and warning-code groups.
- Changed README protocol support section to explicitly show `Full`, `Partial`, and `Unsupported` support levels.
- Enhanced `start.sh` into a management panel for deploy, update, status, restart, logs, uninstall, and global `subx` registration.
- Docker Compose now supports both source-build and prebuilt-image deployment modes.
- Regression tests now read real fixtures from `packages/backend/src/tests/fixtures/input/`.
- Updated `.env.example` comments to Chinese and added outbound proxy examples.
- Updated GitHub issue and pull request templates to Chinese with protocol compatibility and fixture checklist fields.

### Fixed

- Fixed Clash Meta/mihomo Trojan HTTPUpgrade output by preserving `ws-opts.v2ray-http-upgrade=true`.
- Improved downgrade warnings for xHTTP/SplitHTTP, Reality, WireGuard, and other partially expressible features.
- Improved script syntax checks, interactive confirmation, and environment-variable guidance.

## [1.0.0-beta] - 2026-03-04

### Added

- Added target formats: `auto`, `clash`, `clashr`, `surgemac`, `egern`, `stash`, `surfboard`, `v2ray-uri`, `mixed`, and `plain-json`.
- Expanded input parsing for QX/Loon/Surge style lines and Clash JSON/JSON5 input.
- Added node processing options:
  - `includeTypes` / `excludeTypes`
  - `includeRegions` / `excludeRegions`
  - `regexDelete` / `regexSort`
  - `filterUseless`
  - `resolveDomain`
  - `rename`
- Added rule templates: `bypass-cn`, `global`, `acl4ssr-balanced`, and `acl4ssr-full`.
- Added remote ACL4SSR rule fetching, local cache, and fallback behavior.
- Added automatic region proxy groups and custom proxy groups.
- Added frontend preset storage.
- Added `subscription-userinfo` passthrough for remote subscriptions.

### Changed

- Improved emoji flag matching to reduce false positives.
- Improved output for `surge`, `quantumultx`, `loon`, and `shadowrocket`.
- Improved Docker and deployment scripts.
