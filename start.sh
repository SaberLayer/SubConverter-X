#!/bin/bash

# SubConverter-X 管理脚本
# Management Script for SubConverter-X

# 自动切换到脚本所在目录（支持软链接调用）
SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

YES_MODE=false
DRY_RUN=false
NO_REGISTER=false

show_help() {
    cat <<'EOF'
SubConverter-X 管理脚本

用法:
  ./start.sh [选项]

选项:
  -h, --help          显示帮助信息
  -y, --yes           自动确认常规操作（不会绕过删除项目文件的路径确认）
      --dry-run       只展示将执行的命令，不实际修改系统
      --no-register   不提示注册全局命令 subx

示例:
  ./start.sh
  ./start.sh --dry-run
  ./start.sh --yes --no-register
EOF
}

for arg in "$@"; do
    case "$arg" in
        -h|--help)
            show_help
            exit 0
            ;;
        -y|--yes)
            YES_MODE=true
            ;;
        --dry-run)
            DRY_RUN=true
            ;;
        --no-register)
            NO_REGISTER=true
            ;;
        *)
            echo -e "${RED}❌ 未知参数: $arg${NC}"
            echo "运行 ./start.sh --help 查看可用参数"
            exit 1
            ;;
    esac
done

# ========== 工具函数 ==========

confirm_action() {
    local prompt=$1
    local default=${2:-N}
    local answer

    if [ "$YES_MODE" = true ]; then
        echo "自动确认 / Auto confirm: $prompt"
        return 0
    fi

    read -r -p "$prompt" answer
    answer=${answer:-$default}
    case "$answer" in
        y|Y|yes|YES|Yes|是)
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

run_cmd() {
    if [ "$DRY_RUN" = true ]; then
        printf '[dry-run] '
        printf '%q ' "$@"
        printf '\n'
        return 0
    fi
    "$@"
}

resolve_path() {
    local path=$1
    if command -v realpath > /dev/null 2>&1; then
        realpath -m "$path" 2>/dev/null || realpath "$path"
    else
        (cd "$(dirname "$path")" 2>/dev/null && printf "%s/%s\n" "$(pwd -P)" "$(basename "$path")")
    fi
}

safe_remove_dir() {
    local target=$1
    local allowed_root=$2
    local resolved_target
    local resolved_root
    resolved_target=$(resolve_path "$target")
    resolved_root=$(resolve_path "$allowed_root")

    if [ -z "$resolved_target" ] || [ "$resolved_target" = "/" ]; then
        echo -e "${RED}❌ 拒绝删除危险路径: ${target}${NC}"
        return 1
    fi

    case "$resolved_target" in
        "$resolved_root"/*)
            run_cmd rm -rf "$resolved_target"
            ;;
        *)
            echo -e "${RED}❌ 拒绝删除非预期路径: ${resolved_target}${NC}"
            return 1
            ;;
    esac
}

register_global_command() {
    if [ "$NO_REGISTER" = true ]; then
        return
    fi

    if [ -L /usr/local/bin/subx ] && [ "$(readlink /usr/local/bin/subx 2>/dev/null)" = "$SCRIPT_DIR/start.sh" ]; then
        return
    fi

    if [ -e /usr/local/bin/subx ] && [ ! -L /usr/local/bin/subx ]; then
        echo -e "${YELLOW}⚠️  /usr/local/bin/subx 已存在且不是软链接，已跳过注册${NC}"
        return
    fi

    echo ""
    echo -e "${CYAN}可选增强 / Optional:${NC} 注册全局命令 subx 后，可在任意目录打开管理面板。"
    if ! confirm_action "是否注册全局命令 subx？(Y/n) / Register global command? (Y/n): " "Y"; then
        echo "已跳过注册。以后可运行: sudo ln -sf \"$SCRIPT_DIR/start.sh\" /usr/local/bin/subx"
        return
    fi

    if [ ! -w /usr/local/bin ]; then
        echo -e "${YELLOW}⚠️  当前用户无权写入 /usr/local/bin${NC}"
        echo "请手动执行: sudo ln -sf \"$SCRIPT_DIR/start.sh\" /usr/local/bin/subx"
        return
    fi

    if run_cmd ln -sf "$SCRIPT_DIR/start.sh" /usr/local/bin/subx; then
        echo -e "${GREEN}✅ 已注册全局命令：subx${NC}"
    else
        echo -e "${YELLOW}⚠️  注册失败，可稍后手动执行 sudo ln -sf \"$SCRIPT_DIR/start.sh\" /usr/local/bin/subx${NC}"
    fi
    echo ""
}

# 检查端口是否被占用
check_port() {
    local port=$1
    if command -v ss &> /dev/null; then
        ss -tlnp 2>/dev/null | grep -qE ":${port}([^0-9]|$)" && return 0
    elif command -v netstat &> /dev/null; then
        netstat -tlnp 2>/dev/null | grep -qE ":${port}([^0-9]|$)" && return 0
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
        value=$(grep "^${key}=" .env 2>/dev/null | cut -d'=' -f2-)
        echo "${value:-$default}"
    else
        echo "$default"
    fi
}

# 验证端口号
validate_port() {
    local port=$1
    if ! echo "$port" | grep -qE '^[0-9]+$'; then
        echo -e "${RED}❌ 端口号必须为数字 / Port must be a number${NC}"
        return 1
    fi
    if [ "$port" -lt 1 ] || [ "$port" -gt 65535 ]; then
        echo -e "${RED}❌ 端口号范围 1-65535 / Port must be between 1-65535${NC}"
        return 1
    fi
    return 0
}

# 安全地设置 .env 中的键值
set_env_value() {
    local key=$1
    local value=$2
    if [ "$DRY_RUN" = true ]; then
        echo "[dry-run] set ${key}=${value} in .env"
        return 0
    fi
    if grep -q "^${key}=" .env 2>/dev/null; then
        sed -i "s|^${key}=.*|${key}=${value}|" .env
    elif grep -q "^# *${key}=" .env 2>/dev/null; then
        sed -i "s|^# *${key}=.*|${key}=${value}|" .env
    else
        echo "${key}=${value}" >> .env
    fi
}

# 注释掉 .env 中的键，避免保留过期配置
unset_env_value() {
    local key=$1
    if [ "$DRY_RUN" = true ]; then
        echo "[dry-run] unset ${key} in .env"
        return 0
    fi
    if grep -q "^${key}=" .env 2>/dev/null; then
        sed -i "s|^${key}=.*|#${key}=|" .env
    fi
}

install_certbot() {
    if command -v certbot > /dev/null 2>&1; then
        return 0
    fi

    echo "📦 安装 certbot..."
    if [ "$DRY_RUN" = true ]; then
        if command -v apt-get > /dev/null 2>&1; then
            run_cmd apt-get update -qq
            run_cmd apt-get install -y -qq certbot
        elif command -v yum > /dev/null 2>&1; then
            run_cmd yum install -y -q certbot
        elif command -v dnf > /dev/null 2>&1; then
            run_cmd dnf install -y -q certbot
        elif command -v apk > /dev/null 2>&1; then
            run_cmd apk add --quiet certbot
        else
            echo -e "${YELLOW}⚠️  dry-run: 未识别包管理器，请手动安装 certbot${NC}"
        fi
        return 0
    fi

    if command -v apt-get > /dev/null 2>&1; then
        apt-get update -qq && apt-get install -y -qq certbot > /dev/null 2>&1
    elif command -v yum > /dev/null 2>&1; then
        yum install -y -q certbot > /dev/null 2>&1
    elif command -v dnf > /dev/null 2>&1; then
        dnf install -y -q certbot > /dev/null 2>&1
    elif command -v apk > /dev/null 2>&1; then
        apk add --quiet certbot > /dev/null 2>&1
    else
        echo -e "${RED}❌ 无法自动安装 certbot，请手动安装${NC}"
        echo "   https://certbot.eff.org/instructions"
        return 1
    fi
}

# 显示当前访问地址
show_access_url() {
    local http_port
    http_port=$(get_env_value "EXTERNAL_HTTP_PORT" "8080")
    local https_port
    https_port=$(get_env_value "EXTERNAL_HTTPS_PORT" "8443")
    local domain
    domain=$(get_env_value "DOMAIN" "")
    local host
    local ip
    ip=$(hostname -I 2>/dev/null | awk '{print $1}')
    host="${domain:-${ip:-localhost}}"

    echo -e "${GREEN}访问地址 / Access URL:${NC}"
    if [ -f nginx/conf.d/ssl.conf ]; then
        echo "  https://${host}:${https_port}"
    else
        echo "  http://${host}:${http_port}"
    fi
}

# ========== 检查环境 ==========

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ 未安装 Docker / Docker is not installed${NC}"
    echo ""
    echo "请先安装 Docker: https://docs.docker.com/get-docker/"
    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}dry-run 模式继续运行，仅展示流程，不会执行 Docker 命令。${NC}"
    else
        exit 1
    fi
fi

if command -v docker &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ 未安装 Docker Compose / Docker Compose is not installed${NC}"
    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}dry-run 模式继续运行，仅展示流程，不会执行 Docker Compose 命令。${NC}"
    else
        exit 1
    fi
fi

# 检查 .env 文件
if [ ! -f .env ] && [ -f .env.example ]; then
    run_cmd cp .env.example .env
fi

register_global_command

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
        if ! confirm_action "继续？(y/N) / Continue? (y/N): " "N"; then
            return
        fi
        echo ""
    fi

    echo "📝 选择协议 / Select protocol:"
    echo "  1) HTTP（无需证书）/ HTTP (no certificate needed)"
    echo "  2) HTTPS（需要 SSL 证书）/ HTTPS (SSL certificate required)"
    echo ""
    echo "  直接回车使用默认值 [1]"
    read -r -p "  请选择 / Select (1-2) [1]: " protocol_mode
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
    read -r -p "HTTP 端口 / HTTP port [8080]: " http_port
    http_port=${http_port:-8080}

    if ! validate_port "$http_port"; then
        return
    fi

    # 端口冲突检测
    if check_port "$http_port"; then
        echo ""
        echo -e "${YELLOW}⚠️  端口 $http_port 已被占用 / Port $http_port is in use${NC}"
        if ! confirm_action "仍然继续？(y/N) / Continue anyway? (y/N): " "N"; then
            return
        fi
    fi

    read -r -p "域名（可选，直接回车跳过）/ Domain (optional, Enter to skip): " domain

    # 写入 .env
    set_env_value "EXTERNAL_HTTP_PORT" "$http_port"
    if [ -n "$domain" ]; then
        set_env_value "DOMAIN" "$domain"
    else
        unset_env_value "DOMAIN"
    fi

    # 确保没有残留的 ssl.conf
    run_cmd rm -f nginx/conf.d/ssl.conf

    # 恢复 default.conf（可能被 HTTPS 模式禁用过）
    if [ ! -f nginx/conf.d/default.conf ] && [ -f nginx/conf.d/default.conf.bak ]; then
        run_cmd mv nginx/conf.d/default.conf.bak nginx/conf.d/default.conf
    fi

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

    if ! confirm_action "确认启动？(Y/n) / Confirm to start? (Y/n): " "Y"; then
        echo "已取消。配置已保存到 .env"
        return
    fi

    echo ""
    echo "🚀 启动服务..."
    if run_cmd docker compose up -d --build --force-recreate; then
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
    read -r -p "域名（必填）/ Domain (required): " domain
    if [ -z "$domain" ]; then
        echo -e "${RED}❌ HTTPS 模式必须填写域名 / Domain is required for HTTPS${NC}"
        return
    fi

    read -r -p "HTTPS 端口 / HTTPS port [8443]: " https_port
    https_port=${https_port:-8443}

    read -r -p "HTTP 端口（用于跳转 HTTPS）/ HTTP port (redirect to HTTPS) [8080]: " http_port
    http_port=${http_port:-8080}

    if ! validate_port "$https_port" || ! validate_port "$http_port"; then
        return
    fi

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
        if ! confirm_action "仍然继续？(y/N) / Continue anyway? (y/N): " "N"; then
            return
        fi
    fi

    # 写入 .env
    set_env_value "EXTERNAL_HTTP_PORT" "$http_port"
    set_env_value "EXTERNAL_HTTPS_PORT" "$https_port"
    set_env_value "DOMAIN" "$domain"

    # 配置证书
    echo ""
    echo "请选择证书来源 / Select certificate source:"
    echo "  1) 自动申请（Let's Encrypt）/ Auto obtain (Let's Encrypt)"
    echo "  2) 已有证书，手动指定路径 / I have certificates, specify path"
    echo ""
    read -r -p "请选择 (1-2): " cert_mode

    cert_ok=false

    case "$cert_mode" in
        1)
            echo ""
            if ! install_certbot; then
                return
            fi

            echo "🔐 申请 SSL 证书..."
            echo "   域名: $domain"
            echo ""

            # 如果服务运行中且占用了 80 端口，certbot standalone 会失败
            local skip_certbot=false
            if is_running && check_port 80; then
                echo -e "${YELLOW}⚠️  检测到 80 端口被占用，certbot 可能无法验证${NC}"
                echo "   建议先停止服务（选项 5）或使用手动证书（选项 2）"
                if ! confirm_action "仍然尝试？(y/N): " "N"; then
                    skip_certbot=true
                fi
            fi

            if [ "$skip_certbot" = true ]; then
                echo -e "${YELLOW}已跳过证书申请${NC}"
            elif run_cmd certbot certonly --standalone -d "$domain" --non-interactive --agree-tos --register-unsafely-without-email || \
                 run_cmd certbot certonly --standalone -d "$domain"; then
                run_cmd mkdir -p nginx/ssl
                run_cmd cp "/etc/letsencrypt/live/$domain/fullchain.pem" nginx/ssl/
                run_cmd cp "/etc/letsencrypt/live/$domain/privkey.pem" nginx/ssl/
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
            read -r -p "证书文件路径 (fullchain.pem): " cert_path
            read -r -p "私钥文件路径 (privkey.pem): " key_path

            if [ "$DRY_RUN" != true ] && [ ! -f "$cert_path" ]; then
                echo -e "${RED}❌ 证书文件不存在: $cert_path${NC}"
            elif [ "$DRY_RUN" != true ] && [ ! -f "$key_path" ]; then
                echo -e "${RED}❌ 私钥文件不存在: $key_path${NC}"
            else
                run_cmd mkdir -p nginx/ssl
                run_cmd cp "$cert_path" nginx/ssl/fullchain.pem
                run_cmd cp "$key_path" nginx/ssl/privkey.pem
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
        run_cmd rm -f nginx/conf.d/ssl.conf
        # 恢复 default.conf
        if [ ! -f nginx/conf.d/default.conf ] && [ -f nginx/conf.d/default.conf.bak ]; then
            run_cmd mv nginx/conf.d/default.conf.bak nginx/conf.d/default.conf
        fi
        run_cmd docker compose up -d --build --force-recreate

        echo ""
        echo "访问地址: http://$domain:$http_port"
        echo "💡 证书配置好后，重新运行 subx 选择 HTTPS 即可"
        return
    fi

    # 启用 SSL 配置
    run_cmd cp nginx/conf.d/ssl.conf.example nginx/conf.d/ssl.conf
    run_cmd sed -i "s/your-domain.com/$domain/g" nginx/conf.d/ssl.conf
    run_cmd sed -i 's/listen 443 ssl http2/listen 443 ssl/' nginx/conf.d/ssl.conf
    run_cmd sed -i '/listen 443 ssl;/a\    http2 on;' nginx/conf.d/ssl.conf

    # 修正 HTTPS 重定向地址（使用实际外部端口）
    if [ "$https_port" != "443" ]; then
        run_cmd sed -i "s|return 301 https://\$server_name\$request_uri;|return 301 https://\$server_name:${https_port}\$request_uri;|" nginx/conf.d/ssl.conf
    fi

    # HTTPS 模式下禁用 default.conf 避免端口 80 冲突
    if [ -f nginx/conf.d/default.conf ]; then
        run_cmd mv nginx/conf.d/default.conf nginx/conf.d/default.conf.bak
    fi

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

    if ! confirm_action "确认启动？(Y/n) / Confirm to start? (Y/n): " "Y"; then
        echo "已取消。稍后可运行 docker compose up -d 启动"
        return
    fi

    echo ""
    echo "🚀 启动服务..."
    if run_cmd docker compose up -d --build --force-recreate; then
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

    if [ "$DRY_RUN" = true ]; then
        echo "dry-run 模式下不会连接远程仓库或修改 .git 状态，将展示更新流程命令："
        run_cmd git fetch origin
        run_cmd git stash --include-untracked
        run_cmd git pull
        run_cmd docker compose up -d --build --force-recreate
        return
    fi

    # 检查远程是否有更新
    if ! git fetch origin 2>/dev/null; then
        echo -e "${RED}❌ 无法连接到远程仓库 / Cannot reach remote repository${NC}"
        return
    fi
    local local_hash
    local_hash=$(git rev-parse HEAD 2>/dev/null)
    local remote_hash
    remote_hash=$(git rev-parse origin/main 2>/dev/null || true)
    if [ -z "$remote_hash" ]; then
        remote_hash=$(git rev-parse origin/master 2>/dev/null || true)
    fi

    if [ -z "$remote_hash" ]; then
        echo -e "${RED}❌ 无法获取远程分支信息 / Cannot find remote branch${NC}"
        return
    fi

    if [ "$local_hash" = "$remote_hash" ]; then
        echo -e "${GREEN}✅ 已是最新版本 / Already up to date${NC}"
        return
    fi

    echo "📋 发现新版本，更新内容 / New version found:"
    git log --oneline "$local_hash".."$remote_hash" 2>/dev/null
    echo ""
    if ! confirm_action "确认更新？(Y/n) / Confirm update? (Y/n): " "Y"; then
        return
    fi

    # 备份用户配置（先清理残留备份防止目录嵌套）
    echo ""
    echo "💾 备份用户配置..."
    [ -f .env ] && run_cmd cp .env .env.backup
    [ -f nginx/conf.d/ssl.conf ] && run_cmd cp nginx/conf.d/ssl.conf nginx/conf.d/ssl.conf.backup
    if [ -d nginx/ssl ]; then
        safe_remove_dir nginx/ssl.backup "$SCRIPT_DIR/nginx"
        run_cmd cp -r nginx/ssl nginx/ssl.backup
    fi

    # 拉取最新代码
    echo "📥 拉取最新代码..."
    run_cmd git stash --include-untracked
    if run_cmd git pull; then
        echo -e "${GREEN}✅ 代码更新成功${NC}"
    else
        echo -e "${RED}❌ 代码拉取失败，回滚中...${NC}"
        run_cmd git stash pop
        [ -f .env.backup ] && run_cmd mv .env.backup .env
        [ -f nginx/conf.d/ssl.conf.backup ] && run_cmd mv nginx/conf.d/ssl.conf.backup nginx/conf.d/ssl.conf
        if [ -d nginx/ssl.backup ]; then
            safe_remove_dir nginx/ssl "$SCRIPT_DIR/nginx"
            run_cmd mv nginx/ssl.backup nginx/ssl
        fi
        return
    fi

    # 恢复用户配置
    echo "📂 恢复用户配置..."
    [ -f .env.backup ] && run_cmd mv .env.backup .env
    [ -f nginx/conf.d/ssl.conf.backup ] && run_cmd mv nginx/conf.d/ssl.conf.backup nginx/conf.d/ssl.conf
    if [ -d nginx/ssl.backup ]; then
        safe_remove_dir nginx/ssl "$SCRIPT_DIR/nginx"
        run_cmd mv nginx/ssl.backup nginx/ssl
    fi

    # 重新构建并启动
    echo ""
    echo "🔨 重新构建服务..."
    if run_cmd docker compose up -d --build --force-recreate; then
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
    docker compose ps

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
        run_cmd docker compose up -d
    else
        echo "🔄 重启服务..."
        run_cmd docker compose restart
    fi

    if [ "$DRY_RUN" = true ]; then
        echo -e "${GREEN}✅ dry-run 已展示将执行的重启命令${NC}"
    elif is_running; then
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

    if confirm_action "确认停止服务？(y/N) / Confirm stop? (y/N): " "N"; then
        echo "🛑 停止服务..."
        run_cmd docker compose down
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
    read -r -p "请选择 (1-3) [1]: " log_choice
    log_choice=${log_choice:-1}

    echo ""
    echo "按 Ctrl+C 退出日志 / Press Ctrl+C to exit logs"
    echo ""

    case "$log_choice" in
        1) run_cmd docker compose logs -f --tail 100 ;;
        2) run_cmd docker compose logs -f --tail 100 backend ;;
        3) run_cmd docker compose logs -f --tail 100 nginx ;;
        *) run_cmd docker compose logs -f --tail 100 ;;
    esac
}

# ========== 7. 卸载 ==========

do_uninstall() {
    local project_dir
    local typed_path

    echo ""
    echo -e "${RED}⚠️  卸载将会：${NC}"
    echo "  - 停止并删除所有容器和数据卷"
    echo "  - 删除全局命令 subx"
    echo "  - 可选删除项目文件"
    echo ""
    read -r -p "确认卸载？(输入 yes 确认) / Confirm uninstall? (type 'yes'): " confirm

    if [ "$confirm" != "yes" ]; then
        echo "已取消"
        return
    fi

    echo ""
    echo "🛑 停止服务..."
    run_cmd docker compose down -v

    echo "🗑️  删除全局命令..."
    if [ -L /usr/local/bin/subx ] && [ "$(readlink /usr/local/bin/subx 2>/dev/null)" = "$SCRIPT_DIR/start.sh" ]; then
        run_cmd rm -f /usr/local/bin/subx
    else
        echo "未删除 /usr/local/bin/subx：它不存在，或不是当前项目创建的软链接"
    fi

    echo ""
    if confirm_action "是否删除项目文件？(y/N) / Delete project files? (y/N): " "N"; then
        project_dir="$SCRIPT_DIR"
        echo "🗑️  删除项目文件: $project_dir"
        read -r -p "为避免误删，请完整输入项目路径确认 / Type project path to confirm: " typed_path
        if [ "$(resolve_path "$typed_path")" != "$(resolve_path "$project_dir")" ]; then
            echo -e "${RED}❌ 路径不匹配，已取消删除项目文件${NC}"
            echo -e "${GREEN}✅ 卸载完成，项目文件已保留在: $SCRIPT_DIR${NC}"
            return
        fi
        cd / || return
        safe_remove_dir "$project_dir" "$(dirname "$project_dir")"
        echo -e "${GREEN}✅ 卸载完成，项目文件已删除${NC}"
    else
        echo -e "${GREEN}✅ 卸载完成，项目文件已保留在: $SCRIPT_DIR${NC}"
    fi
}

# ========== 主循环 ==========

while true; do
    show_menu
    read -r -p "请输入选项 / Enter option (0-7): " choice

    case "$choice" in
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
    read -r -p "按回车返回主菜单 / Press Enter to return to menu..." _
done

echo ""
