# SubConverter-X 使用指南

## 🎉 新功能

### 1. 灵活的端口配置
不再强制使用 80/443 端口，可以自定义任意端口。

### 2. 集成 Nginx 反向代理
Docker 部署自动包含 Nginx，无需手动配置。

### 3. 中英文界面切换
支持中文和英文界面，点击右上角语言按钮即可切换。

### 4. 完整的域名和 SSL 支持
提供完整的 HTTPS 配置方案，支持 Let's Encrypt 自动证书。

---

## 🚀 快速开始

### 一键部署（推荐）

```bash
# 克隆项目
git clone https://github.com/YOUR_USERNAME/SubConverter-X.git
cd SubConverter-X

# 运行管理面板
chmod +x start.sh
./start.sh
```

首次运行会自动注册全局命令 `subx`，之后在任意目录输入 `subx` 即可打开管理面板。

管理面板功能：

| 选项 | 说明 |
|------|------|
| 1) 部署 / 重新配置 | 选择 HTTP 或 HTTPS，配置端口、域名、证书，自动检测端口冲突 |
| 2) 更新服务 | 自动拉取最新代码并重建，保留用户配置 |
| 3) 查看状态 | 容器运行状态、访问地址、CPU/内存占用 |
| 4) 重启服务 | 重启所有容器，未运行时自动启动 |
| 5) 停止服务 | 停止所有容器 |
| 6) 查看日志 | 可选全部 / 后端 / Nginx 日志 |
| 7) 卸载 | 停止容器、删除命令、可选删除项目文件 |

部署流程（选项 1）：
1. 选择协议（HTTP / HTTPS）
2. 设置端口（自动检测冲突）
3. 输入域名（HTTP 可选，HTTPS 必填）
4. 配置证书（HTTPS 模式：自动申请 Let's Encrypt 或手动指定路径）
5. 确认启动

全程无需手动编辑任何文件，操作完成后按回车返回主菜单。

---

## 🌍 多语言支持

界面支持中英文切换：

- 点击右上角的语言切换按钮
- 系统会自动保存你的语言偏好
- 首次访问会根据浏览器语言自动选择

支持的语言：
- 🇨🇳 简体中文
- 🇺🇸 English

未来可以轻松扩展其他语言（日语、韩语等）。

---

## 🔧 常见问题

### Q1: 端口被占用怎么办？

**A:** 运行 `subx` → 选 `1` → 输入端口时会自动检测冲突，换个空闲端口即可。

### Q2: 如何查看服务状态？

**A:** 运行 `subx` → 选 `3`，显示容器状态、访问地址、CPU/内存占用。

### Q3: 如何查看日志？

**A:** 运行 `subx` → 选 `6`，可选查看全部 / 后端 / Nginx 日志。

### Q4: 如何更新服务？

**A:** 运行 `subx` → 选 `2`，自动对比版本、显示更新内容、拉取代码并重建，用户配置不会丢失。

### Q5: 如何卸载？

**A:** 运行 `subx` → 选 `7`，输入 `yes` 确认，可选是否删除项目文件。

### Q4: SSL 证书如何续期？

Let's Encrypt 证书有效期 90 天，需要定期续期：

```bash
# 手动续期
certbot renew

# 复制新证书
cp /etc/letsencrypt/live/你的域名.com/fullchain.pem nginx/ssl/
cp /etc/letsencrypt/live/你的域名.com/privkey.pem nginx/ssl/

# 重启 Nginx
docker compose restart nginx
```

建议设置自动续期：

```bash
# 编辑 crontab
crontab -e

# 添加以下行（每月 1 号凌晨 3 点自动续期）
0 3 1 * * certbot renew --quiet && cp /etc/letsencrypt/live/你的域名.com/*.pem /path/to/SubConverter-X/nginx/ssl/ && docker compose -f /path/to/SubConverter-X/docker compose.yml restart nginx
```

### Q5: 国旗显示错误怎么办？

已修复！之前的问题是国家代码匹配规则太宽泛，现在使用单词边界匹配，不会再误判。

例如：
- ❌ 之前：`Reality-57zx2brc` 会被识别为巴西（因为包含 "br"）
- ✅ 现在：只有完整的 "BR" 单词才会被识别为巴西

### Q6: 如何添加新语言？

1. 在 `packages/frontend/src/locales/` 目录创建新的语言文件，如 `ja.json`（日语）
2. 复制 `en.json` 的内容并翻译
3. 在 `packages/frontend/src/i18n.ts` 中导入并注册新语言
4. 更新 `LanguageSwitcher.tsx` 组件以支持新语言选择

---

## 📁 项目结构

```
SubConverter-X/
├── docker compose.yml          # Docker 编排配置（包含 Nginx）
├── Dockerfile                  # 后端构建配置
├── .env.example               # 环境变量模板
├── nginx/                     # Nginx 配置
│   ├── nginx.conf            # 主配置
│   ├── conf.d/
│   │   ├── default.conf      # HTTP 配置
│   │   └── ssl.conf.example  # HTTPS 配置模板
│   └── ssl/                  # SSL 证书目录
├── packages/
│   ├── backend/              # 后端服务
│   │   ├── src/
│   │   │   └── core/
│   │   │       └── emoji.ts  # 国旗识别（已修复）
│   │   └── public/           # 前端静态文件
│   └── frontend/             # 前端源码
│       └── src/
│           ├── i18n.ts       # 国际化配置
│           ├── locales/      # 语言文件
│           │   ├── zh.json   # 中文
│           │   └── en.json   # 英文
│           └── components/
│               └── LanguageSwitcher.tsx  # 语言切换器
└── DEPLOYMENT.md             # 详细部署文档
```

---

## 🎯 架构说明

### Docker 部署架构

```
用户浏览器
    ↓
Nginx (端口 8080/8443)
    ↓
后端服务 (端口 3000)
    ↓
SQLite 数据库
```

### 优势

1. **Nginx 反向代理**：
   - 自动处理 HTTPS
   - 静态文件缓存
   - 请求限流保护
   - Gzip 压缩

2. **容器化部署**：
   - 一键启动
   - 环境隔离
   - 易于迁移
   - 自动重启

3. **灵活配置**：
   - 自定义端口
   - 支持域名
   - SSL 可选
   - 多语言界面

---

## 📞 技术支持

- 详细部署文档：查看 `DEPLOYMENT.md`
- 问题反馈：GitHub Issues
- 更新日志：查看 `CHANGELOG.md`

---

## 🔄 版本信息

- **当前版本**: v1.0.0
- **更新日期**: 2026-02-12
- **主要改进**:
  - ✅ 修复国旗识别错误
  - ✅ 集成 Nginx 到 Docker
  - ✅ 支持自定义端口
  - ✅ 完整的 SSL 支持
  - ✅ 中英文界面切换
  - ✅ 优化部署流程

---

**祝使用愉快！** 🎉
