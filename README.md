# SubConverter-X - 自建订阅转换工具

隐私优先、协议全覆盖的自部署订阅转换工具。支持 VLESS+Reality+XTLS 等新协议，节点信息不经第三方。

## ✨ 新功能亮点

- 🌍 **多语言界面**：支持中英文切换，可扩展其他语言
- 🐳 **集成 Nginx**：Docker 部署自动包含反向代理，无需额外配置
- 🔧 **灵活端口**：支持自定义端口，不再强制使用 80/443
- 🔒 **完整 SSL 支持**：提供 HTTPS 配置方案和 Let's Encrypt 集成
- 🚀 **一键部署**：提供交互式启动脚本，简化部署流程
- 🎯 **修复国旗识别**：优化国家代码匹配算法，避免误判

## 快速开始

### 方式一：一键启动脚本（推荐）

```bash
# 克隆项目
git clone https://github.com/YOUR_USERNAME/SubConverter-X.git
cd SubConverter-X

# 运行启动脚本
./start.sh
```

脚本会引导你选择部署模式：
1. 快速启动（使用端口 8080）
2. 使用域名 + HTTPS
3. 自定义配置

### 方式二：Docker 部署

```bash
# 复制环境变量配置
cp .env.example .env

# 编辑配置（可选）
nano .env

# 启动服务
docker compose up -d
```

默认访问地址：`http://localhost:8080`

### 方式三：本地开发

```bash
npm install
# 终端 1
npm run dev:backend
# 终端 2
npm run dev:frontend
```

前端开发服务器运行在 `http://localhost:5173`，API 请求自动代理到后端 `3000` 端口。

## 支持的协议

| 协议 | 解析 | Clash Meta | sing-box | Surge | QX | Shadowrocket | Loon | V2Ray | Base64 |
|------|------|-----------|---------|-------|-----|-------------|------|-------|--------|
| Shadowsocks | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ShadowsocksR | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ |
| VMess | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| VLESS | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ |
| Trojan | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Hysteria | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Hysteria2 | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✓ |
| TUIC | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ |
| WireGuard | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ |
| SOCKS5 | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ |
| HTTP/HTTPS | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ |

### 支持的传输协议

| 传输方式 | VMess | VLESS | Trojan | 说明 |
|---------|-------|-------|--------|------|
| TCP | ✓ | ✓ | ✓ | 原始 TCP 传输 |
| WebSocket | ✓ | ✓ | ✓ | WS 伪装 |
| gRPC | ✓ | ✓ | ✗ | gRPC 传输 |
| HTTP/2 | ✓ | ✓ | ✗ | H2 传输 |
| QUIC | ✓ | ✓ | ✗ | QUIC 传输 |
| HTTPUpgrade | ✓ | ✓ | ✗ | HTTP 升级 |
| **xhttp/splithttp** | ✓ | ✓ | ✗ | **Xray 新增传输** |

不兼容的节点在转换时自动跳过，不会报错。

## 输入格式

- 标准 URI（`ss://`、`vmess://`、`vless://`、`trojan://` 等），每行一个
- Clash / Clash Meta YAML 配置
- sing-box JSON 配置
- Base64 编码的订阅内容（自动识别并解码）
- **订阅 URL**：直接输入 `https://` 开头的订阅链接，自动拉取内容

支持混合粘贴，解析器会自动判断格式。支持多个订阅 URL，每行一个，自动合并。

## 核心功能

### 🎨 节点名称增强
- **Emoji 国旗自动添加**：自动识别节点名称中的国家/地区，添加对应旗帜 emoji
  - `香港节点` → `🇭🇰 香港节点`
  - `US Server` → `🇺🇸 US Server`
  - 支持 30+ 国家/地区识别

### 🔧 节点处理
- **节点去重**：自动检测并移除重复节点（相同 server + port + protocol）
- **节点排序**：
  - 按名称排序
  - 按地区分组排序
- **节点筛选**：
  - 包含过滤（正则表达式）
  - 排除过滤（正则表达式）
  - 批量重命名（支持正则替换）

### 🌍 代理组管理
- **区域自动分组**：一键生成按地区分类的策略组
  - 自动创建：🇭🇰 香港、🇺🇸 美国、🇸🇬 新加坡、🇯🇵 日本等
  - 智能分配节点到对应地区组
  - 自动添加 ♻️ Auto 自动选择组
- **自定义代理组**：支持手动配置策略组（通过 API）

### ⚙️ 全局设置
- **UDP 支持**：全局启用/禁用所有节点的 UDP
- **跳过证书验证**：全局控制 skip-cert-verify

### 💾 配置预设
- **保存常用配置**：将当前配置保存为预设
- **快速加载**：一键加载已保存的配置
- **预设管理**：查看、加载、删除已保存的预设

## API

### 转换

```
POST /api/convert
Content-Type: application/json

{
  "input": "vless://uuid@host:port?security=reality&... 或 https://订阅链接",
  "target": "clash-meta",
  "ruleTemplate": "bypass-cn",

  // 节点筛选
  "include": "香港|HK|Hong Kong",     // 可选，包含过滤（正则）
  "exclude": "过期|到期",              // 可选，排除过滤（正则）
  "rename": "\\s*\\[.*?\\]@|官网.*$@", // 可选，重命名规则

  // 节点处理
  "addEmoji": true,                   // 可选，添加 emoji 国旗，默认 false
  "deduplicate": true,                // 可选，节点去重，默认 false
  "sort": "region",                   // 可选，排序方式：none/name/region

  // 全局设置
  "enableUdp": true,                  // 可选，全局启用 UDP
  "skipCertVerify": false,            // 可选，全局跳过证书验证

  // 代理组
  "autoRegionGroup": true,            // 可选，自动按地区分组
  "proxyGroups": [...]                // 可选，自定义代理组
}
```

响应：

```json
{
  "output": "port: 7890\n...",
  "nodeCount": 3,
  "skipped": ["节点名 (wireguard)"],
  "filteredOut": 1
}
```

### 生成短链订阅

```
POST /api/shorten
Content-Type: application/json

{
  "input": "...",
  "target": "clash-meta",
  "ruleTemplate": "bypass-cn",
  // 支持所有 /api/convert 的参数
  "addEmoji": true,
  "deduplicate": true,
  "autoRegionGroup": true
}
```

响应：

```json
{
  "token": "abc123",
  "url": "http://localhost:3000/api/sub/abc123"
}
```

### 获取订阅

```
GET /api/sub/:token
```

或使用 URL 参数直接订阅：

```
GET /api/sub?url=https://订阅链接&target=clash-meta&rule=bypass-cn&emoji=true&dedupe=true&sort=region
```

**查询参数：**
- `url`: 订阅链接（必需）
- `target`: 目标格式（可选，默认根据 User-Agent 自动识别）
- `rule`: 规则模板 ID
- `include`: 包含过滤（正则）
- `exclude`: 排除过滤（正则）
- `rename`: 重命名规则
- `emoji`: 添加 emoji（`true`/`1` 启用）
- `dedupe`: 节点去重（`true`/`1` 启用）
- `sort`: 排序方式（`none`/`name`/`region`）
- `udp`: UDP 支持（`true`/`false`）
- `skipCert`: 跳过证书验证（`true`/`false`）

**示例：**

```bash
# 基础订阅
https://your-domain.com/api/sub?url=https://订阅链接&target=clash-meta

# 带 emoji 和去重
https://your-domain.com/api/sub?url=https://订阅链接&emoji=true&dedupe=true

# 按地区排序 + 只保留香港节点
https://your-domain.com/api/sub?url=https://订阅链接&sort=region&include=香港|HK
```

直接返回转换后的配置内容。支持 User-Agent 自动识别客户端类型（Clash、Surge、Shadowrocket 等），自动切换输出格式。

### 辅助接口

```
GET /api/convert/formats   # 获取支持的目标格式列表
GET /api/convert/rules     # 获取可用的规则模板列表
```

## 规则模板

| ID | 名称 | 说明 | 规则来源 |
|----|------|------|----------|
| `bypass-cn` | 绕过中国大陆 | 中国大陆 IP 和域名直连，其余走代理 | 内置 |
| `global` | 全局代理 | 所有流量走代理 | 内置 |
| `acl4ssr-balanced` | ACL4SSR 均衡 | 广告拦截 + 国内直连 + Google/Telegram/YouTube/Netflix 分流 | 远程 |
| `acl4ssr-full` | ACL4SSR 完整 | 在均衡基础上增加 Microsoft/Apple/Spotify/Steam/OpenAI 等分流 | 远程 |

### 远程规则拉取

`acl4ssr-*` 模板从 [ACL4SSR](https://github.com/ACL4SSR/ACL4SSR) 仓库实时拉取规则列表，采用三级 fallback 机制：

1. 远程拉取成功 → 写入本地缓存 → 返回
2. 远程拉取失败 → 读取本地缓存 → 返回
3. 缓存也不存在 → 跳过该分类

缓存目录为 `packages/backend/.rule-cache/`，已加入 `.gitignore`。远程请求超时默认 8 秒。

## 目标格式

| ID | 客户端 |
|----|--------|
| `clash-meta` | Clash Meta / mihomo |
| `singbox` | sing-box |
| `surge` | Surge 5 |
| `quantumultx` | Quantumult X |
| `shadowrocket` | Shadowrocket |
| `loon` | Loon |
| `v2ray` | V2Ray / Xray |
| `base64` | 通用 Base64 URI 订阅 |

## 项目结构

```
SubConverter-X/
├── packages/
│   ├── backend/src/
│   │   ├── index.ts              # Express 入口
│   │   ├── db.ts                 # SQLite 短链存储
│   │   ├── core/
│   │   │   ├── types.ts          # ProxyNode 统一数据模型
│   │   │   ├── parser.ts         # 解析器注册表
│   │   │   └── generator.ts      # 生成器注册表
│   │   ├── parsers/              # 输入解析器
│   │   ├── generators/           # 输出生成器
│   │   ├── rules/                # 规则模板
│   │   │   ├── index.ts          # 规则注册表
│   │   │   ├── bypass-cn.ts      # 绕过中国大陆（内置）
│   │   │   ├── global.ts         # 全局代理（内置）
│   │   │   ├── acl4ssr.ts        # ACL4SSR 远程规则模板
│   │   │   └── remote.ts         # 远程规则拉取 + 缓存
│   │   └── routes/               # API 路由
│   └── frontend/src/             # React 前端
├── Dockerfile
└── docker compose.yml
```

## 技术栈

- 后端：Node.js + TypeScript + Express
- 前端：React + TypeScript + Vite + Tailwind CSS
- 存储：SQLite（better-sqlite3）
- 部署：单容器 Docker，前端构建后由后端静态托管

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | 后端服务监听端口 |
| `DB_PATH` | `./data/subconverter-x.db` | SQLite 数据库路径 |
| `EXTERNAL_HTTP_PORT` | `8080` | 外部 HTTP 访问端口 |
| `EXTERNAL_HTTPS_PORT` | `8443` | 外部 HTTPS 访问端口 |

## 部署配置

### 端口配置

项目支持灵活的端口配置，不再强制使用 80/443 端口：

```bash
# 编辑 .env 文件
EXTERNAL_HTTP_PORT=8080    # 外部访问的 HTTP 端口
EXTERNAL_HTTPS_PORT=8443   # 外部访问的 HTTPS 端口
```

### 域名和 SSL 配置

如果你有域名并想使用 HTTPS：

1. 复制 SSL 配置模板：
```bash
cp nginx/conf.d/ssl.conf.example nginx/conf.d/ssl.conf
```

2. 编辑 `nginx/conf.d/ssl.conf`，替换 `your-domain.com` 为你的域名

3. 获取 SSL 证书（Let's Encrypt）：
```bash
certbot certonly --standalone -d your-domain.com
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/
cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/
```

4. 重启服务：
```bash
docker compose restart
```

详细部署文档请查看：
- **QUICK_START.md** - 快速开始指南
- **DEPLOYMENT.md** - 完整部署文档

## 多语言支持

界面支持中英文切换，点击右上角的语言按钮即可切换。

**支持的语言：**
- 🇨🇳 简体中文
- 🇺🇸 English

**扩展其他语言：**

1. 在 `packages/frontend/src/locales/` 创建新语言文件（如 `ja.json`）
2. 复制 `en.json` 内容并翻译
3. 在 `packages/frontend/src/i18n.ts` 中导入并注册
4. 更新 `LanguageSwitcher.tsx` 组件

## 国旗识别优化

已修复国旗识别误判问题。之前的匹配规则过于宽泛，导致节点名称中包含国家代码字母的情况被误判。

**修复前：**
- `Reality-57zx2brc` → 🇧🇷（误判为巴西，因为包含 "br"）

**修复后：**
- `Reality-57zx2brc` → 无国旗（正确）
- `US-Node-01` → 🇺🇸（正确识别）
- `BR-Server` → 🇧🇷（正确识别）

现在使用单词边界匹配（`\b`），只有完整的国家代码才会被识别。

## 常见问题

### 端口被占用怎么办？

修改 `.env` 文件中的端口配置：

```bash
EXTERNAL_HTTP_PORT=8080    # 改为其他端口
EXTERNAL_HTTPS_PORT=8443   # 改为其他端口
```

### 如何查看日志？

```bash
# 查看所有服务日志
docker compose logs -f

# 只查看后端日志
docker compose logs -f backend

# 只查看 Nginx 日志
docker compose logs -f nginx
```

### 如何更新服务？

```bash
git pull
docker compose down
docker compose up -d --build
```

### SSL 证书如何续期？

```bash
# 手动续期
certbot renew

# 复制新证书
cp /etc/letsencrypt/live/your-domain.com/*.pem nginx/ssl/

# 重启 Nginx
docker compose restart nginx
```

建议设置自动续期（crontab）。

## 文档索引

- **README.md** - 项目概述和功能说明（本文件）
- **QUICK_START.md** - 快速开始指南
- **DEPLOYMENT.md** - 详细部署文档
- **CHANGELOG.md** - 更新日志

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License
