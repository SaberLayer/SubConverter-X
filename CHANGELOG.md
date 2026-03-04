# Changelog

本文件记录 SubConverter-X 的版本变更。

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

