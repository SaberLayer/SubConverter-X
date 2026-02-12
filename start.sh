#!/bin/bash

# SubConverter-X 管理脚本
# Management Script for SubConverter-X

# 自动切换到脚本所在目录（支持软链接调用）
SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
cd "$SCRIPT_DIR"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# 自动注册全局命令 subx（首次运行时）
if [ ! -L /usr/local/bin/subx ]; then
    ln -sf "$SCRIPT_DIR/start.sh" /usr/local/bin/subx 2>/dev/null && \
    echo -e "${GREEN}✅ 已注册全局命令：subx${NC}" && \
    echo "   以后可以在任意目录直接输入 subx 管理服务" && \
    echo ""
fi

# ========== 工具函数 ==========

# 检查端口是否被占用
check_port() {
    local port=$1
    if command -v ss &> /dev/null; then
        ss -tlnp 2>/dev/null | grep -q ":$port " && return 0
    elif command -v netstat &> /dev/null; then
        netstat -tlnp 2>/dev/null | grep -q ":$port " && return 0
    fi
    return 1
}

# 检查服务是否正在运行
is_running() {
    docker compose ps --status running 2>/dev/null | grep -q "subconverter-x" && return 0
    return 1
}

# 从 .env 读取当前配置
get_env_value() {
    local key=$1
    local default=$2
    if [ -f .env ]; then
        local value
        value=$(grep "^${key}=" .env 2>/dev/null | cut -d'=' -f2)
        echo "${value:-$default}"
    else
        echo "$default"
    fi
}

# 显示当前访问地址
show_access_url() {
    local http_port
    http_port=$(get_env_value "EXTERNAL_HTTP_PORT" "8080")
    local https_port
    https_port=$(get_env_value "EXTERNAL_HTTPS_PORT" "8443")
    local server_ip
    server_ip=$(hostname -I 2>/dev/null | awk '{print $1}')

    echo -e "${GREEN}访问地址 / Access URL:${NC}"
    if [ -f nginx/conf.d/ssl.conf ]; then
        echo "  https://${server_ip}:${https_port}"
    else
        echo "  http://${server_ip}:${http_port}"
    fi
}

# ========== 检查环境 ==========

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ 未安装 Docker / Docker is not installed${NC}"
    echo ""
    echo "请先安装 Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ 未安装 Docker Compose / Docker Compose is not installed${NC}"
    exit 1
fi

# 检查 .env 文件
if [ ! -f .env ] && [ -f .env.example ]; then
    cp .env.example .env
fi

# ========== 主菜单 ==========

show_menu() {
    echo ""
    echo -e "${CYAN}==========================================${NC}"
    echo -e "${CYAN}  SubConverter-X 管理面板${NC}"
    echo -e "${CYAN}  SubConverter-X Management Panel${NC}"
    echo -e "${CYAN}==========================================${NC}"
    echo ""

    # 显示运行状态
    if is_running; then
        echo -e "  状态: ${GREEN}● 运行中${NC}"
        show_access_url
    else
        echo -e "  状态: ${RED}● 未运行${NC}"
    fi

    echo ""
    echo "  1) 部署 / 重新配置    Deploy / Reconfigure"
    echo "  2) 更新服务            Update service"
    echo "  3) 查看状态            View status"
    echo "  4) 重启服务            Restart service"
    echo "  5) 停止服务            Stop service"
    echo "  6) 查看日志            View logs"
    echo "  7) 卸载                Uninstall"
    echo "  0) 退出                Exit"
    echo ""
}

# ========== 1. 部署 / 重新配置 ==========

do_deploy() {
    echo ""

    # 检测是否已在运行
    if is_running; then
        echo -e "${YELLOW}⚠️  服务正在运行中，重新配置将会重启服务${NC}"
        echo -e "${YELLOW}⚠️  Service is running, reconfiguring will restart it${NC}"
        echo ""
        read -p "继续？(y/N) / Continue? (y/N): " cont
        if [ "$cont" != "y" ] && [ "$cont" != "Y" ]; then
            return
        fi
        echo ""
    fi

    echo "📝 选择协议 / Select protocol:"
    echo "  1) HTTP（无需证书）/ HTTP (no certificate needed)"
    echo "  2) HTTPS（需要 SSL 证书）/ HTTPS (SSL certificate required)"
    echo ""
    echo "  直接回车使用默认值 [1]"
    read -p "  请选择 / Select (1-2) [1]: " protocol_mode
    protocol_mode=${protocol_mode:-1}
    echo ""

    if [ "$protocol_mode" = "1" ]; then
        deploy_http
    elif [ "$protocol_mode" = "2" ]; then
        deploy_https
    else
        echo -e "${RED}❌ 无效选项${NC}"
    fi
}

deploy_http() {
    read -p "HTTP 端口 / HTTP port [8080]: " http_port
    http_port=${http_port:-8080}

    # 端口冲突检测
    if check_port "$http_port"; then
        echo ""
        echo -e "${YELLOW}⚠️  端口 $http_port 已被占用 / Port $http_port is in use${NC}"
        read -p "仍然继续？(y/N) / Continue anyway? (y/N): " cont
        if [ "$cont" != "y" ] && [ "$cont" != "Y" ]; then
            return
        fi
    fi

    read -p "域名（可选，直接回车跳过）/ Domain (optional, Enter to skip): " domain

    # 写入 .env
    sed -i "s/EXTERNAL_HTTP_PORT=.*/EXTERNAL_HTTP_PORT=$http_port/" .env

    # 确保没有残留的 ssl.conf
    rm -f nginx/conf.d/ssl.conf

    # 配置摘要
    echo ""
    echo "=========================================="
    echo "  📋 配置摘要 / Configuration Summary"
    echo "=========================================="
    echo "  协议: HTTP"
    echo "  端口: $http_port"
    if [ -n "$domain" ]; then
        echo "  域名: $domain"
    fi
    echo "=========================================="
    echo ""

    read -p "确认启动？(Y/n) / Confirm to start? (Y/n): " confirm
    if [ "$confirm" = "n" ] || [ "$confirm" = "N" ]; then
        echo "已取消。配置已保存到 .env"
        return
    fi

    echo ""
    echo "🚀 启动服务..."
    if docker compose up -d --build; then
        echo ""
        echo -e "${GREEN}==========================================${NC}"
        echo -e "${GREEN}  ✅ 部署成功！/ Deployment successful!${NC}"
        echo -e "${GREEN}==========================================${NC}"
        echo ""
        echo "访问地址 / Access URL:"
        if [ -n "$domain" ]; then
            echo "  http://$domain:$http_port"
        else
            echo "  http://localhost:$http_port"
            echo "  http://$(hostname -I | awk '{print $1}'):$http_port"
        fi
    else
        echo -e "${RED}❌ 启动失败，请检查日志: docker compose logs${NC}"
    fi
}

deploy_https() {
    read -p "域名（必填）/ Domain (required): " domain
    if [ -z "$domain" ]; then
        echo -e "${RED}❌ HTTPS 模式必须填写域名 / Domain is required for HTTPS${NC}"
        return
    fi

    read -p "HTTPS 端口 / HTTPS port [8443]: " https_port
    https_port=${https_port:-8443}

    read -p "HTTP 端口（用于跳转 HTTPS）/ HTTP port (redirect to HTTPS) [8080]: " http_port
    http_port=${http_port:-8080}

    # 端口冲突检测
    local port_conflict=false
    if check_port "$https_port"; then
        echo -e "${YELLOW}⚠️  端口 $https_port 已被占用 / Port $https_port is in use${NC}"
        port_conflict=true
    fi
    if check_port "$http_port"; then
        echo -e "${YELLOW}⚠️  端口 $http_port 已被占用 / Port $http_port is in use${NC}"
        port_conflict=true
    fi
    if [ "$port_conflict" = true ]; then
        read -p "仍然继续？(y/N) / Continue anyway? (y/N): " cont
        if [ "$cont" != "y" ] && [ "$cont" != "Y" ]; then
            return
        fi
    fi

    # 写入 .env
    sed -i "s/EXTERNAL_HTTP_PORT=.*/EXTERNAL_HTTP_PORT=$http_port/" .env
    sed -i "s/EXTERNAL_HTTPS_PORT=.*/EXTERNAL_HTTPS_PORT=$https_port/" .env

    # 配置证书
    echo ""
    echo "请选择证书来源 / Select certificate source:"
    echo "  1) 自动申请（Let's Encrypt）/ Auto obtain (Let's Encrypt)"
    echo "  2) 已有证书，手动指定路径 / I have certificates, specify path"
    echo ""
    read -p "请选择 (1-2): " cert_mode

    cert_ok=false

    case $cert_mode in
        1)
            echo ""
            if ! command -v certbot &> /dev/null; then
                echo "📦 安装 certbot..."
                apt-get update -qq && apt-get install -y -qq certbot > /dev/null 2>&1
            fi

            echo "🔐 申请 SSL 证书..."
            echo "   域名: $domain"
            echo ""

            if certbot certonly --standalone -d "$domain" --non-interactive --agree-tos --register-unsafely-without-email 2>/dev/null || \
               certbot certonly --standalone -d "$domain"; then
                mkdir -p nginx/ssl
                cp "/etc/letsencrypt/live/$domain/fullchain.pem" nginx/ssl/
                cp "/etc/letsencrypt/live/$domain/privkey.pem" nginx/ssl/
                echo -e "${GREEN}✅ 证书申请成功 / Certificate obtained${NC}"
                cert_ok=true
            else
                echo ""
                echo -e "${RED}❌ 证书申请失败，可能是 80 端口被占用${NC}"
                echo ""
                echo "💡 提示：可以尝试 DNS 验证："
                echo "   certbot certonly --manual --preferred-challenges dns -d $domain"
                echo "   申请成功后重新运行 subx 选择 HTTPS"
            fi
            ;;
        2)
            echo ""
            read -p "证书文件路径 (fullchain.pem): " cert_path
            read -p "私钥文件路径 (privkey.pem): " key_path

            if [ ! -f "$cert_path" ]; then
                echo -e "${RED}❌ 证书文件不存在: $cert_path${NC}"
            elif [ ! -f "$key_path" ]; then
                echo -e "${RED}❌ 私钥文件不存在: $key_path${NC}"
            else
                mkdir -p nginx/ssl
                cp "$cert_path" nginx/ssl/fullchain.pem
                cp "$key_path" nginx/ssl/privkey.pem
                echo -e "${GREEN}✅ 证书文件已复制${NC}"
                cert_ok=true
            fi
            ;;
        *)
            echo -e "${RED}❌ 无效选项${NC}"
            ;;
    esac

    if [ "$cert_ok" = false ]; then
        echo ""
        echo -e "${YELLOW}⚠️  证书未配置成功，将以 HTTP 模式启动${NC}"
        rm -f nginx/conf.d/ssl.conf
        docker compose up -d --build

        echo ""
        echo "访问地址: http://$domain:$http_port"
        echo "💡 证书配置好后，重新运行 subx 选择 HTTPS 即可"
        return
    fi

    # 启用 SSL 配置
    cp nginx/conf.d/ssl.conf.example nginx/conf.d/ssl.conf
    sed -i "s/your-domain.com/$domain/g" nginx/conf.d/ssl.conf
    sed -i 's/listen 443 ssl http2/listen 443 ssl/' nginx/conf.d/ssl.conf
    sed -i '/listen 443 ssl;/a\    http2 on;' nginx/conf.d/ssl.conf

    # 配置摘要
    echo ""
    echo "=========================================="
    echo "  📋 配置摘要 / Configuration Summary"
    echo "=========================================="
    echo "  协议: HTTPS"
    echo "  域名: $domain"
    echo "  HTTPS 端口: $https_port"
    echo "  HTTP  端口: $http_port (自动跳转 HTTPS)"
    echo "=========================================="
    echo ""

    read -p "确认启动？(Y/n) / Confirm to start? (Y/n): " confirm
    if [ "$confirm" = "n" ] || [ "$confirm" = "N" ]; then
        echo "已取消。稍后可运行 docker compose up -d 启动"
        return
    fi

    echo ""
    echo "🚀 启动服务..."
    if docker compose up -d --build; then
        echo ""
        echo -e "${GREEN}==========================================${NC}"
        echo -e "${GREEN}  ✅ 部署成功！/ Deployment successful!${NC}"
        echo -e "${GREEN}==========================================${NC}"
        echo ""
        echo "访问地址 / Access URL:"
        echo "  https://$domain:$https_port"
    else
        echo -e "${RED}❌ 启动失败，请检查日志: docker compose logs${NC}"
    fi
}

# ========== 2. 更新服务 ==========

do_update() {
    echo ""
    echo "🔄 检查更新 / Checking for updates..."
    echo ""

    if [ ! -d ".git" ]; then
        echo -e "${RED}❌ 当前目录不是 Git 仓库，无法自动更新${NC}"
        return
    fi

    # 检查远程是否有更新
    git fetch origin 2>/dev/null
    local local_hash
    local_hash=$(git rev-parse HEAD 2>/dev/null)
    local remote_hash
    remote_hash=$(git rev-parse origin/main 2>/dev/null || git rev-parse origin/master 2>/dev/null)

    if [ "$local_hash" = "$remote_hash" ]; then
        echo -e "${GREEN}✅ 已是最新版本 / Already up to date${NC}"
        return
    fi

    echo "📋 发现新版本，更新内容 / New version found:"
    git log --oneline "$local_hash".."$remote_hash" 2>/dev/null
    echo ""
    read -p "确认更新？(Y/n) / Confirm update? (Y/n): " confirm
    if [ "$confirm" = "n" ] || [ "$confirm" = "N" ]; then
        return
    fi

    # 备份用户配置
    echo ""
    echo "💾 备份用户配置..."
    [ -f .env ] && cp .env .env.backup
    [ -f nginx/conf.d/ssl.conf ] && cp nginx/conf.d/ssl.conf nginx/conf.d/ssl.conf.backup
    [ -d nginx/ssl ] && cp -r nginx/ssl nginx/ssl.backup 2>/dev/null

    # 拉取最新代码
    echo "📥 拉取最新代码..."
    git checkout -- . 2>/dev/null
    if git pull; then
        echo -e "${GREEN}✅ 代码更新成功${NC}"
    else
        echo -e "${RED}❌ 代码拉取失败${NC}"
        [ -f .env.backup ] && mv .env.backup .env
        [ -f nginx/conf.d/ssl.conf.backup ] && mv nginx/conf.d/ssl.conf.backup nginx/conf.d/ssl.conf
        [ -d nginx/ssl.backup ] && rm -rf nginx/ssl && mv nginx/ssl.backup nginx/ssl
        return
    fi

    # 恢复用户配置
    echo "📂 恢复用户配置..."
    [ -f .env.backup ] && mv .env.backup .env
    [ -f nginx/conf.d/ssl.conf.backup ] && mv nginx/conf.d/ssl.conf.backup nginx/conf.d/ssl.conf
    [ -d nginx/ssl.backup ] && rm -rf nginx/ssl && mv nginx/ssl.backup nginx/ssl

    # 重新构建并启动
    echo ""
    echo "🔨 重新构建服务..."
    if docker compose up -d --build; then
        echo ""
        echo -e "${GREEN}==========================================${NC}"
        echo -e "${GREEN}  ✅ 更新完成！/ Update successful!${NC}"
        echo -e "${GREEN}==========================================${NC}"
        echo ""
        echo "📋 最近更新 / Recent changes:"
        git log --oneline -5
    else
        echo -e "${RED}❌ 构建失败，请检查日志: docker compose logs${NC}"
    fi
}

# ========== 3. 查看状态 ==========

do_status() {
    echo ""
    echo "📊 服务状态 / Service Status:"
    echo ""
    docker compose ps 2>/dev/null

    if is_running; then
        echo ""
        show_access_url

        echo ""
        echo "📈 资源占用 / Resource Usage:"
        docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null | grep subconverter-x
    fi
}

# ========== 4. 重启服务 ==========

do_restart() {
    echo ""
    if ! is_running; then
        echo -e "${YELLOW}⚠️  服务未运行，正在启动...${NC}"
        docker compose up -d
    else
        echo "🔄 重启服务..."
        docker compose restart
    fi

    if is_running; then
        echo -e "${GREEN}✅ 服务已启动${NC}"
        echo ""
        show_access_url
    else
        echo -e "${RED}❌ 服务启动失败，请查看日志${NC}"
    fi
}

# ========== 5. 停止服务 ==========

do_stop() {
    echo ""
    if ! is_running; then
        echo -e "${YELLOW}⚠️  服务未在运行${NC}"
        return
    fi

    read -p "确认停止服务？(y/N) / Confirm stop? (y/N): " confirm
    if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
        echo "🛑 停止服务..."
        docker compose down
        echo -e "${GREEN}✅ 服务已停止${NC}"
    fi
}

# ========== 6. 查看日志 ==========

do_logs() {
    echo ""
    echo "选择日志来源 / Select log source:"
    echo "  1) 所有服务 / All services"
    echo "  2) 后端 / Backend"
    echo "  3) Nginx"
    echo ""
    read -p "请选择 (1-3) [1]: " log_choice
    log_choice=${log_choice:-1}

    echo ""
    echo "按 Ctrl+C 退出日志 / Press Ctrl+C to exit logs"
    echo ""

    case $log_choice in
        1) docker compose logs -f --tail 100 ;;
        2) docker compose logs -f --tail 100 backend ;;
        3) docker compose logs -f --tail 100 nginx ;;
        *) docker compose logs -f --tail 100 ;;
    esac
}

# ========== 7. 卸载 ==========

do_uninstall() {
    echo ""
    echo -e "${RED}⚠️  卸载将会：${NC}"
    echo "  - 停止并删除所有容器和数据卷"
    echo "  - 删除全局命令 subx"
    echo "  - 可选删除项目文件"
    echo ""
    read -p "确认卸载？(输入 yes 确认) / Confirm uninstall? (type 'yes'): " confirm

    if [ "$confirm" != "yes" ]; then
        echo "已取消"
        return
    fi

    echo ""
    echo "🛑 停止服务..."
    docker compose down -v 2>/dev/null

    echo "🗑️  删除全局命令..."
    rm -f /usr/local/bin/subx

    echo ""
    read -p "是否删除项目文件？(y/N) / Delete project files? (y/N): " del_files
    if [ "$del_files" = "y" ] || [ "$del_files" = "Y" ]; then
        local project_dir="$SCRIPT_DIR"
        echo "🗑️  删除项目文件: $project_dir"
        cd /
        rm -rf "$project_dir"
        echo -e "${GREEN}✅ 卸载完成，项目文件已删除${NC}"
    else
        echo -e "${GREEN}✅ 卸载完成，项目文件已保留在: $SCRIPT_DIR${NC}"
    fi
}

# ========== 主循环 ==========

while true; do
    show_menu
    read -p "请输入选项 / Enter option (0-7): " choice

    case $choice in
        1) do_deploy ;;
        2) do_update ;;
        3) do_status ;;
        4) do_restart ;;
        5) do_stop ;;
        6) do_logs ;;
        7) do_uninstall ; break ;;
        0) echo "👋 再见 / Bye" ; break ;;
        *) echo -e "${RED}❌ 无效选项 / Invalid option${NC}" ;;
    esac

    echo ""
    read -p "按回车返回主菜单 / Press Enter to return to menu..." _
done

echo ""
