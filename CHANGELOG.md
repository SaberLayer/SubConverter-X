# Changelog

语言：简体中文 | [English](CHANGELOG.en.md)

本文件记录 SubConverter-X 的版本变更。

## [Unreleased] - 2026-05-07

### Added
- 新增 API 请求校验、安全审计、健康检查和 OpenAPI 文档页面。
- 新增短链 TTL、短链信息接口和本地二维码展示。
- 新增协议能力矩阵，按目标格式区分完整支持、部分兼容和不支持，并统一生成 `warnings`。
- 新增现代协议 golden fixture，覆盖 VLESS Reality xHTTP、Trojan HTTPUpgrade、Hysteria2 obfs、TUIC、WireGuard、AnyTLS、SSR。
- 新增外部配置模板能力：
  - `configTemplate` / `configTemplateUrl`
  - `{{content}}`、`{{proxies}}`、`{{proxyGroups}}`、`{{rules}}`、`{{dns}}`、`{{nodeNames}}`
  - 普通转换、直链订阅和短链订阅统一支持模板渲染
- 新增节点操作流水线 `operators`，支持 `filter`、`rename`、`set`、`sort`、`dedupe`。
- 新增 `subscription-userinfo` 合并：`upload`、`download`、`total` 求和，`expire` 取最早时间。
- 新增 AnyTLS 协议支持：
  - URI、Clash/mihomo、sing-box 输入解析
  - Clash Meta/mihomo 与 sing-box 原生输出
  - Base64、Shadowrocket、v2ray-uri、mixed 输出 `anytls://` 兼容 URI
- 新增 GHCR 镜像发布 workflow 和预构建镜像部署模式。
- 新增英文文档版本：`README.en.md`、`QUICK_START.en.md`、`DEPLOYMENT.en.md`、`CHANGELOG.en.md`。

### Changed
- 前端兼容性提示升级为兼容性报告，展示支持节点、过滤节点、跳过节点和 warning code 分组。
- README 协议支持说明改为“完整 / 部分 / 不支持”，并补充重点兼容边界。
- `start.sh` 增强为管理面板，支持部署、更新、状态、重启、日志、卸载和全局 `subx` 命令。
- Docker Compose 配置支持源码构建和预构建镜像两种部署方式。
- 回归测试改为读取 `packages/backend/src/tests/fixtures/input/` 下的真实 fixture，便于持续扩展。
- `.env.example` 注释改为中文，并补充远程拉取代理环境变量示例。
- GitHub Issue / PR 模板改为中文，并补充协议兼容性、warnings 和 fixture 检查项。

### Fixed
- 修正 Clash Meta/mihomo 的 Trojan HTTPUpgrade 输出，保留 `ws-opts.v2ray-http-upgrade=true`。
- 改进 xHTTP/SplitHTTP、Reality、WireGuard 等无法完整表达场景的降级提示。
- 提升脚本语法校验、交互确认和环境变量说明，降低误操作风险。

## [1.0.0-beta] - 2026-03-04

### Added
- 新增目标格式：`auto`、`clash`、`clashr`、`surgemac`、`egern`、`stash`、`surfboard`、`v2ray-uri`、`mixed`、`plain-json`。
- 扩展输入解析：支持更多 QX/Loon/Surge 风格配置行，支持 Clash JSON/JSON5 输入。
- 新增节点处理选项：
  - `includeTypes` / `excludeTypes`
  - `includeRegions` / `excludeRegions`
  - `regexDelete` / `regexSort`
  - `filterUseless`
  - `resolveDomain`
- 扩展订阅/API 参数：
  - `/api/convert` 支持上述新增处理参数
  - `/api/sub` 支持 `types`、`excludeTypes`、`regions`、`excludeRegions`、`regexDelete`、`regexSort`、`useless`、`resolveDomain`
  - 新增更多目标格式的 `Content-Type` 与下载扩展名映射
- 新增回归测试脚本：`packages/backend/src/tests/regression.ts`，覆盖解析、生成、过滤、域名解析和分组行为。

### Changed
- 增强 `singbox` 解析与生成：
  - 改进 `httpupgrade` / `xhttp` 相关字段保留
  - 改进策略组成员映射与 `route.final` 行为
- 增强 `surge`、`quantumultx`、`loon`、`shadowrocket` 生成器的协议覆盖与兼容性。
- CI 增加回归测试步骤（`npm run test:regression --workspace=packages/backend`）。
- 前端源码统一为 TypeScript，移除历史 JS 重复文件，减少维护分叉。

### Fixed
- `start.sh` 行尾与语法问题修正（`bash -n start.sh` 可通过）。
- 多目标格式下订阅输出的文件后缀与返回头兼容性修正。

### Notes
- 该版本为公开 Beta，优先保证“功能可用、部署可用、升级可持续”。
- 生产部署建议配合访问控制与证书续期策略使用。

