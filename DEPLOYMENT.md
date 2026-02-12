# SubConverter-X 部署指南

本文档提供 SubConverter-X 的完整部署流程，包括 Docker 部署和手动部署两种方式。

## 📋 目录

- [服务器要求](#服务器要求)
- [方式一：Docker 部署（推荐）](#方式一docker-部署推荐)
- [方式二：手动部署](#方式二手动部署)
- [生产环境配置](#生产环境配置)
- [安全加固](#安全加固)
- [监控与维护](#监控与维护)
- [常见问题](#常见问题)

---

## 服务器要求

### 最低配置
- **CPU**: 1 核
- **内存**: 512 MB
- **硬盘**: 10 GB
- **系统**: Ubuntu 20.04+ / Debian 11+ / CentOS 8+

### 推荐配置
- **CPU**: 2 核
- **内存**: 2 GB
- **硬盘**: 20 GB
- **带宽**: 10 Mbps

### 软件依赖
- Docker 20.10+ 和 Docker Compose 2.0+（Docker 部署）
- 或 Node.js 22+（手动部署）
- Nginx（可选，用于反向代理）

---

## 方式一：Docker 部署（推荐）

Docker 部署是最简单、最可靠的方式，适合大多数用户。

### 步骤 1：安装 Docker

```bash
# 更新系统包
sudo apt update && sudo apt upgrade -y

# 安装 Docker
curl -fsSL https://get.docker.com | sh

# 将当前用户添加到 docker 组（避免每次使用 sudo）
sudo usermod -aG docker $USER

# 重新登录或执行以下命令使组权限生效
newgrp docker

# 验证安装
docker --version
docker compose version
```

### 步骤 2：上传项目代码

**方式 A：使用 Git（推荐）**

```bash
# 选择安装目录
cd /opt

# 克隆仓库（替换为你的仓库地址）
git clone https://github.com/YOUR_USERNAME/SubConverter-X.git

# 进入项目目录
cd SubConverter-X
```

**方式 B：手动上传**

```bash
# 在本地打包项目
tar -czf SubConverter-X.tar.gz SubConverter-X/

# 上传到服务器
scp SubConverter-X.tar.gz user@your-server-ip:/opt/

# 在服务器上解压
ssh user@your-server-ip
cd /opt
tar -xzf SubConverter-X.tar.gz
cd SubConverter-X
```

### 步骤 3：配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑配置文件
nano .env
```

编辑 `.env` 文件内容：

```env
# 服务端口（默认 3000）
PORT=3000

# 数据库路径
DB_PATH=./data/subscriptions.db

# 运行环境
NODE_ENV=production
```

保存并退出（Ctrl+X，然后 Y，然后 Enter）。

### 步骤 4：启动服务

```bash
# 构建并启动容器（后台运行）
docker compose up -d --build

# 查看启动日志
docker compose logs -f

# 按 Ctrl+C 退出日志查看
```

### 步骤 5：验证部署

```bash
# 检查容器状态
docker compose ps

# 测试服务是否正常
curl http://localhost:3000

# 应该返回前端页面的 HTML
```

### 步骤 6：配置反向代理（可选但推荐）

#### 6.1 安装 Nginx

```bash
sudo apt install nginx -y
```

#### 6.2 创建 Nginx 配置

```bash
sudo nano /etc/nginx/sites-available/subconverter-x
```

粘贴以下配置（**替换 `sub.yourdomain.com` 为你的域名**）：

```nginx
# 速率限制配置
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

server {
    listen 80;
    server_name sub.yourdomain.com;  # 替换为你的域名

    # 限制请求体大小
    client_max_body_size 10M;

    # 日志配置
    access_log /var/log/nginx/subconverter-x_access.log;
    error_log /var/log/nginx/subconverter-x_error.log;

    location / {
        # 速率限制：每秒 10 个请求，突发 20 个
        limit_req zone=api_limit burst=20 nodelay;

        # 反向代理到 Docker 容器
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;

        # 请求头设置
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

#### 6.3 启用配置

```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/subconverter-x /etc/nginx/sites-enabled/

# 测试配置文件语法
sudo nginx -t

# 重新加载 Nginx
sudo systemctl reload nginx
```

#### 6.4 配置 HTTPS（强烈推荐）

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx -y

# 自动配置 SSL 证书
sudo certbot --nginx -d sub.yourdomain.com

# 按提示输入邮箱并同意服务条款
```

Certbot 会自动修改 Nginx 配置并设置证书自动续期。

### 步骤 7：配置防火墙

```bash
# 安装 UFW（如果未安装）
sudo apt install ufw -y

# 允许 SSH（重要！避免被锁在外面）
sudo ufw allow 22/tcp

# 允许 HTTP 和 HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 启用防火墙
sudo ufw enable

# 查看状态
sudo ufw status
```

### 步骤 8：测试访问

在浏览器中访问：
- HTTP: `http://sub.yourdomain.com`
- HTTPS: `https://sub.yourdomain.com`

应该能看到 SubConverter-X 的前端界面。

---

## 方式二：手动部署

如果你不想使用 Docker，可以选择手动部署。

### 步骤 1：安装 Node.js 22

```bash
# 添加 NodeSource 仓库
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -

# 安装 Node.js
sudo apt-get install -y nodejs

# 验证安装
node --version  # 应显示 v22.x.x
npm --version
```

### 步骤 2：上传并构建项目

```bash
# 进入项目目录
cd /opt/SubConverter-X

# 安装依赖
npm install

# 构建项目
npm run build

# 创建数据目录
mkdir -p data
```

### 步骤 3：安装 PM2 进程管理器

```bash
# 全局安装 PM2
sudo npm install -g pm2

# 验证安装
pm2 --version
```

### 步骤 4：创建 PM2 配置文件

```bash
nano /opt/SubConverter-X/ecosystem.config.js
```

粘贴以下内容：

```javascript
module.exports = {
  apps: [{
    name: 'subconverter-x',
    script: './packages/backend/dist/index.js',
    cwd: '/opt/SubConverter-X',
    instances: 2,  // 使用 2 个实例（集群模式）
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      DB_PATH: './data/subscriptions.db'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    autorestart: true,
    max_memory_restart: '500M'
  }]
};
```

### 步骤 5：启动服务

```bash
# 创建日志目录
mkdir -p /opt/SubConverter-X/logs

# 使用配置文件启动
pm2 start ecosystem.config.js

# 查看运行状态
pm2 status

# 查看日志
pm2 logs subconverter-x
```

### 步骤 6：设置开机自启

```bash
# 生成启动脚本
pm2 startup

# 复制输出的命令并执行（类似下面这样）
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u your-user --hp /home/your-user

# 保存当前进程列表
pm2 save
```

### 步骤 7：配置 Nginx

参考 Docker 部署中的步骤 6。

---

## 生产环境配置

### 1. 数据库备份

创建自动备份脚本：

```bash
sudo nano /opt/backup-subconverter-x.sh
```

内容：

```bash
#!/bin/bash

# 配置
BACKUP_DIR="/opt/backups/subconverter-x"
DB_PATH="/opt/SubConverter-X/data/subscriptions.db"
DATE=$(date +%Y%m%d_%H%M%S)
KEEP_DAYS=7

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份数据库
if [ -f "$DB_PATH" ]; then
    cp "$DB_PATH" "$BACKUP_DIR/subscriptions_$DATE.db"
    echo "$(date): 备份成功 - subscriptions_$DATE.db"
else
    echo "$(date): 错误 - 数据库文件不存在"
    exit 1
fi

# 删除旧备份（保留最近 7 天）
find $BACKUP_DIR -name "subscriptions_*.db" -mtime +$KEEP_DAYS -delete
echo "$(date): 已清理 $KEEP_DAYS 天前的备份"
```

设置权限和定时任务：

```bash
# 添加执行权限
sudo chmod +x /opt/backup-subconverter-x.sh

# 编辑 crontab
crontab -e

# 添加以下行（每天凌晨 3 点备份）
0 3 * * * /opt/backup-subconverter-x.sh >> /var/log/subconverter-x-backup.log 2>&1
```

### 2. 日志轮转

创建日志轮转配置：

```bash
sudo nano /etc/logrotate.d/subconverter-x
```

内容：

```
/opt/SubConverter-X/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 your-user your-user
}
```

### 3. 监控告警（可选）

安装监控工具：

```bash
# 安装 Netdata（实时监控）
bash <(curl -Ss https://my-netdata.io/kickstart.sh)

# 访问 http://your-server-ip:19999 查看监控面板
```

---

## 安全加固

### 1. 限制数据库文件权限

```bash
chmod 600 /opt/SubConverter-X/data/subscriptions.db
```

### 2. 配置 Fail2Ban 防止暴力攻击

```bash
# 安装 Fail2Ban
sudo apt install fail2ban -y

# 创建 Nginx 规则
sudo nano /etc/fail2ban/filter.d/nginx-limit-req.conf
```

内容：

```
[Definition]
failregex = limiting requests, excess:.* by zone.*client: <HOST>
ignoreregex =
```

编辑 Fail2Ban 配置：

```bash
sudo nano /etc/fail2ban/jail.local
```

添加：

```
[nginx-limit-req]
enabled = true
filter = nginx-limit-req
logpath = /var/log/nginx/subconverter-x_error.log
maxretry = 5
findtime = 600
bantime = 3600
```

重启服务：

```bash
sudo systemctl restart fail2ban
sudo fail2ban-client status
```

### 3. 定期更新系统

```bash
# 创建自动更新脚本
sudo nano /opt/update-system.sh
```

内容：

```bash
#!/bin/bash
apt update
apt upgrade -y
apt autoremove -y
```

设置定时任务（每周日凌晨 4 点）：

```bash
sudo chmod +x /opt/update-system.sh
sudo crontab -e
# 添加：
0 4 * * 0 /opt/update-system.sh >> /var/log/system-update.log 2>&1
```

---

## 监控与维护

### Docker 部署监控

```bash
# 查看容器状态
docker compose ps

# 查看实时日志
docker compose logs -f

# 查看资源使用
docker stats

# 重启服务
docker compose restart

# 停止服务
docker compose down

# 更新服务
cd /opt/SubConverter-X
git pull
docker compose down
docker compose up -d --build
```

### PM2 部署监控

```bash
# 查看进程状态
pm2 status

# 查看实时日志
pm2 logs subconverter-x

# 查看资源监控
pm2 monit

# 重启服务
pm2 restart subconverter-x

# 停止服务
pm2 stop subconverter-x

# 更新服务
cd /opt/SubConverter-X
git pull
npm install
npm run build
pm2 restart subconverter-x
```

### 性能监控

```bash
# 查看系统负载
htop

# 查看磁盘使用
df -h

# 查看内存使用
free -h

# 查看网络连接
netstat -tunlp | grep 3000
```

---

## 常见问题

### 1. 端口被占用

**问题**：启动时提示端口 3000 已被占用

**解决**：

```bash
# 查看占用端口的进程
sudo lsof -i :3000

# 或者
sudo netstat -tunlp | grep 3000

# 杀死进程（替换 PID）
sudo kill -9 PID

# 或者修改 .env 中的端口
nano .env
# 将 PORT=3000 改为 PORT=3001
```

### 2. Docker 容器无法启动

**问题**：`docker compose up` 失败

**解决**：

```bash
# 查看详细错误日志
docker compose logs

# 清理并重新构建
docker compose down -v
docker compose build --no-cache
docker compose up -d

# 检查磁盘空间
df -h

# 清理 Docker 缓存
docker system prune -a
```

### 3. Nginx 502 Bad Gateway

**问题**：访问域名时显示 502 错误

**解决**：

```bash
# 检查后端服务是否运行
curl http://localhost:3000

# 如果无响应，检查服务状态
docker compose ps  # Docker 部署
pm2 status         # PM2 部署

# 查看 Nginx 错误日志
sudo tail -f /var/log/nginx/subconverter-x_error.log

# 测试 Nginx 配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx
```

### 4. 数据库权限错误

**问题**：日志显示无法写入数据库

**解决**：

```bash
# 检查数据目录权限
ls -la /opt/SubConverter-X/data/

# 修复权限（Docker 部署）
sudo chown -R 1000:1000 /opt/SubConverter-X/data/

# 修复权限（PM2 部署）
sudo chown -R $USER:$USER /opt/SubConverter-X/data/
chmod 755 /opt/SubConverter-X/data/
chmod 644 /opt/SubConverter-X/data/subscriptions.db
```

### 5. SSL 证书续期失败

**问题**：Let's Encrypt 证书过期

**解决**：

```bash
# 手动续期
sudo certbot renew

# 测试续期（不实际续期）
sudo certbot renew --dry-run

# 查看证书状态
sudo certbot certificates

# 如果续期失败，检查 Nginx 配置
sudo nginx -t
```

### 6. 内存不足

**问题**：服务频繁重启或 OOM

**解决**：

```bash
# 查看内存使用
free -h

# Docker 部署：限制容器内存
# 编辑 docker-compose.yml，添加：
# services:
#   app:
#     deploy:
#       resources:
#         limits:
#           memory: 512M

# PM2 部署：限制进程内存
# 编辑 ecosystem.config.js
# max_memory_restart: '300M'

# 减少 PM2 实例数
# instances: 1

# 添加 swap（临时方案）
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### 7. 转换失败或节点丢失

**问题**：某些节点无法转换

**解决**：

```bash
# 查看后端日志
docker compose logs -f  # Docker
pm2 logs subconverter-x   # PM2

# 检查输入格式是否正确
# 确认协议是否被目标格式支持（参考 README.md 协议兼容性矩阵）

# 测试单个节点转换
curl -X POST http://localhost:3000/api/convert \
  -H "Content-Type: application/json" \
  -d '{"input":"你的节点链接","target":"clash-meta"}'
```

### 8. 远程订阅拉取超时

**问题**：转换远程订阅时超时

**解决**：

```bash
# 检查服务器网络
ping google.com

# 检查防火墙出站规则
sudo ufw status

# 测试订阅 URL 可访问性
curl -I "订阅URL"

# 如果订阅源在国外，考虑配置代理
# 编辑 .env 添加：
# HTTP_PROXY=http://proxy-server:port
# HTTPS_PROXY=http://proxy-server:port
```

---

## 更新部署

### Docker 部署更新

```bash
cd /opt/SubConverter-X

# 拉取最新代码
git pull

# 停止旧容器
docker compose down

# 重新构建并启动
docker compose up -d --build

# 查看日志确认启动成功
docker compose logs -f
```

### PM2 部署更新

```bash
cd /opt/SubConverter-X

# 拉取最新代码
git pull

# 安装新依赖
npm install

# 重新构建
npm run build

# 重启服务
pm2 restart subconverter-x

# 查看日志
pm2 logs subconverter-x
```

---

## 卸载

### Docker 部署卸载

```bash
cd /opt/SubConverter-X

# 停止并删除容器
docker compose down -v

# 删除项目文件
cd /opt
sudo rm -rf SubConverter-X

# 删除 Nginx 配置
sudo rm /etc/nginx/sites-enabled/subconverter-x
sudo rm /etc/nginx/sites-available/subconverter-x
sudo systemctl reload nginx

# 删除 SSL 证书
sudo certbot delete --cert-name sub.yourdomain.com
```

### PM2 部署卸载

```bash
# 停止并删除 PM2 进程
pm2 delete subconverter-x
pm2 save

# 删除项目文件
cd /opt
sudo rm -rf SubConverter-X

# 删除 Nginx 配置（同上）
```

---

## 技术支持

如果遇到问题：

1. 查看本文档的「常见问题」章节
2. 查看项目日志获取详细错误信息
3. 在 GitHub Issues 提交问题：`https://github.com/YOUR_USERNAME/SubConverter-X/issues`
4. 提供以下信息以便快速定位问题：
   - 操作系统版本
   - 部署方式（Docker/PM2）
   - 错误日志
   - 复现步骤

---

## 附录

### 推荐的服务器提供商

- **国内**: 阿里云、腾讯云、华为云
- **国外**: DigitalOcean、Vultr、Linode、AWS Lightsail

### 域名配置

如果使用域名访问，需要在域名 DNS 管理中添加 A 记录：

```
类型: A
主机记录: sub（或 @）
记录值: 你的服务器 IP
TTL: 600
```

### 性能优化建议

1. **启用 Gzip 压缩**（Nginx 配置）
2. **使用 CDN**（Cloudflare 免费版即可）
3. **数据库定期清理**（删除过期短链）
4. **限制单次转换节点数**（建议不超过 1000 个）

---

**文档版本**: v1.0
**最后更新**: 2026-02-12
**适用版本**: SubConverter-X v1.0.0+
