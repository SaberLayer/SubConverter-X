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

### 方案一：使用自定义端口（推荐新手）

如果你的服务器 80/443 端口被占用，或者没有域名：

```bash
# 1. 复制环境变量配置
cp .env.example .env

# 2. 编辑 .env 文件
nano .env

# 修改以下内容：
# EXTERNAL_HTTP_PORT=8080    # 改为你想要的端口，如 8080
# EXTERNAL_HTTPS_PORT=8443   # 改为你想要的端口，如 8443

# 3. 启动服务
docker-compose up -d

# 4. 访问
# 浏览器打开: http://你的服务器IP:8080
```

### 方案二：使用域名 + HTTPS（推荐生产环境）

如果你有域名并想使用 HTTPS：

```bash
# 1. 确保域名已解析到服务器 IP

# 2. 编辑 .env 文件
cp .env.example .env
nano .env

# 设置：
# EXTERNAL_HTTP_PORT=80
# EXTERNAL_HTTPS_PORT=443

# 3. 配置 SSL
# 复制 SSL 配置模板
cp nginx/conf.d/ssl.conf.example nginx/conf.d/ssl.conf

# 编辑 ssl.conf，将 your-domain.com 替换为你的域名
nano nginx/conf.d/ssl.conf

# 4. 获取 SSL 证书（使用 Let's Encrypt）
# 临时停止服务
docker-compose down

# 安装 certbot
apt-get update && apt-get install -y certbot

# 获取证书
certbot certonly --standalone -d 你的域名.com --email 你的邮箱@example.com

# 复制证书到项目目录
cp /etc/letsencrypt/live/你的域名.com/fullchain.pem nginx/ssl/
cp /etc/letsencrypt/live/你的域名.com/privkey.pem nginx/ssl/

# 5. 启动服务
docker-compose up -d

# 6. 访问
# 浏览器打开: https://你的域名.com
```

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

**A:** 修改 `.env` 文件中的 `EXTERNAL_HTTP_PORT` 和 `EXTERNAL_HTTPS_PORT` 为其他端口。

```bash
# 例如改为 8080 和 8443
EXTERNAL_HTTP_PORT=8080
EXTERNAL_HTTPS_PORT=8443

# 重启服务
docker-compose restart
```

### Q2: 如何查看服务状态？

```bash
# 查看容器状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 查看 Nginx 日志
docker-compose logs -f nginx

# 查看后端日志
docker-compose logs -f backend
```

### Q3: 如何更新服务？

```bash
# 拉取最新代码
git pull

# 重新构建并启动
docker-compose down
docker-compose up -d --build
```

### Q4: SSL 证书如何续期？

Let's Encrypt 证书有效期 90 天，需要定期续期：

```bash
# 手动续期
certbot renew

# 复制新证书
cp /etc/letsencrypt/live/你的域名.com/fullchain.pem nginx/ssl/
cp /etc/letsencrypt/live/你的域名.com/privkey.pem nginx/ssl/

# 重启 Nginx
docker-compose restart nginx
```

建议设置自动续期：

```bash
# 编辑 crontab
crontab -e

# 添加以下行（每月 1 号凌晨 3 点自动续期）
0 3 1 * * certbot renew --quiet && cp /etc/letsencrypt/live/你的域名.com/*.pem /path/to/SubConverter-X/nginx/ssl/ && docker-compose -f /path/to/SubConverter-X/docker-compose.yml restart nginx
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
├── docker-compose.yml          # Docker 编排配置（包含 Nginx）
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
