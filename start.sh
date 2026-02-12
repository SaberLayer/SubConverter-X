#!/bin/bash

# SubConverter-X 一键启动脚本
# Quick Start Script for SubConverter-X

set -e

echo "=========================================="
echo "  SubConverter-X 部署助手"
echo "  SubConverter-X Deployment Helper"
echo "=========================================="
echo ""

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "❌ 错误: 未安装 Docker"
    echo "❌ Error: Docker is not installed"
    echo ""
    echo "请先安装 Docker: https://docs.docker.com/get-docker/"
    echo "Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

# 检查 Docker Compose
if ! command -v docker compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ 错误: 未安装 Docker Compose"
    echo "❌ Error: Docker Compose is not installed"
    exit 1
fi

echo "✅ Docker 环境检查通过"
echo "✅ Docker environment check passed"
echo ""

# 检查 .env 文件
if [ ! -f .env ]; then
    echo "📝 创建配置文件..."
    echo "📝 Creating configuration file..."
    cp .env.example .env
    echo "✅ 已创建 .env 文件"
    echo "✅ Created .env file"
    echo ""
fi

# 询问部署模式
echo "请选择部署模式 / Please select deployment mode:"
echo "1) 快速启动 (使用端口 8080) / Quick start (port 8080)"
echo "2) 使用域名 + HTTPS / Domain with HTTPS"
echo "3) 自定义配置 / Custom configuration"
echo ""
read -p "请输入选项 (1-3) / Enter option (1-3): " mode

case $mode in
    1)
        echo ""
        echo "🚀 使用快速启动模式..."
        echo "🚀 Using quick start mode..."

        # 设置默认端口
        sed -i 's/EXTERNAL_HTTP_PORT=.*/EXTERNAL_HTTP_PORT=8080/' .env
        sed -i 's/EXTERNAL_HTTPS_PORT=.*/EXTERNAL_HTTPS_PORT=8443/' .env

        echo "✅ 配置完成，启动服务..."
        echo "✅ Configuration complete, starting services..."
        docker compose up -d

        echo ""
        echo "=========================================="
        echo "✅ 部署成功！/ Deployment successful!"
        echo "=========================================="
        echo ""
        echo "访问地址 / Access URL:"
        echo "http://localhost:8080"
        echo "或 / or"
        echo "http://$(hostname -I | awk '{print $1}'):8080"
        echo ""
        ;;

    2)
        echo ""
        echo "⚠️  注意：此模式将使用 80 和 443 端口"
        echo "⚠️  Note: This mode will use port 80 and 443"
        echo "   如果这些端口已被占用，请选择 3（自定义配置）"
        echo "   If these ports are in use, please choose 3 (Custom configuration)"
        echo ""
        read -p "继续？(y/N) / Continue? (y/N): " continue_mode2
        if [ "$continue_mode2" != "y" ] && [ "$continue_mode2" != "Y" ]; then
            echo ""
            echo "已取消，请重新运行脚本选择其他模式"
            echo "Cancelled, please re-run and select another mode"
            exit 0
        fi
        echo ""
        read -p "请输入您的域名 / Enter your domain: " domain

        if [ -z "$domain" ]; then
            echo "❌ 域名不能为空 / Domain cannot be empty"
            exit 1
        fi

        echo ""
        echo "📝 配置域名和 SSL..."
        echo "📝 Configuring domain and SSL..."

        # 设置标准端口
        sed -i 's/EXTERNAL_HTTP_PORT=.*/EXTERNAL_HTTP_PORT=80/' .env
        sed -i 's/EXTERNAL_HTTPS_PORT=.*/EXTERNAL_HTTPS_PORT=443/' .env

        # 配置 SSL
        if [ ! -f nginx/conf.d/ssl.conf ]; then
            cp nginx/conf.d/ssl.conf.example nginx/conf.d/ssl.conf
            sed -i "s/your-domain.com/$domain/g" nginx/conf.d/ssl.conf
        fi

        echo ""
        echo "⚠️  请注意 / Please note:"
        echo "1. 确保域名已解析到此服务器 / Ensure domain points to this server"
        echo "2. 需要获取 SSL 证书 / Need to obtain SSL certificate"
        echo ""
        echo "获取 SSL 证书命令 / Get SSL certificate command:"
        echo "sudo apt-get install -y certbot"
        echo "sudo certbot certonly --standalone -d $domain"
        echo "sudo cp /etc/letsencrypt/live/$domain/fullchain.pem nginx/ssl/"
        echo "sudo cp /etc/letsencrypt/live/$domain/privkey.pem nginx/ssl/"
        echo ""

        read -p "是否已配置 SSL 证书？(y/n) / SSL certificate configured? (y/n): " ssl_ready

        if [ "$ssl_ready" = "y" ] || [ "$ssl_ready" = "Y" ]; then
            docker compose up -d
            echo ""
            echo "=========================================="
            echo "✅ 部署成功！/ Deployment successful!"
            echo "=========================================="
            echo ""
            echo "访问地址 / Access URL:"
            echo "https://$domain"
            echo ""
        else
            echo ""
            echo "请先配置 SSL 证书，然后运行："
            echo "Please configure SSL certificate first, then run:"
            echo "docker compose up -d"
        fi
        ;;

    3)
        echo ""
        echo "📝 自定义配置 / Custom configuration"
        echo "   直接回车使用 [括号内] 的默认值"
        echo "   Press Enter to use the [default] value"
        echo ""

        # 先选协议
        echo "选择协议 / Select protocol:"
        echo "1) HTTP（无需证书）/ HTTP (no certificate needed)"
        echo "2) HTTPS（需要 SSL 证书）/ HTTPS (SSL certificate required)"
        echo ""
        read -p "请选择 (1-2) [1]: " protocol_mode
        protocol_mode=${protocol_mode:-1}
        echo ""

        if [ "$protocol_mode" = "1" ]; then
            # ===== HTTP 模式 =====
            read -p "HTTP 端口 / HTTP port [8080]: " http_port
            http_port=${http_port:-8080}

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
                echo "已取消。配置已保存到 .env，稍后可运行 docker compose up -d 启动"
                exit 0
            fi

            echo ""
            echo "🚀 启动服务..."
            docker compose up -d

            echo ""
            echo "=========================================="
            echo "✅ 部署成功！/ Deployment successful!"
            echo "=========================================="
            echo ""
            echo "访问地址 / Access URL:"
            if [ -n "$domain" ]; then
                echo "http://$domain:$http_port"
            else
                echo "http://localhost:$http_port"
                echo "或 / or"
                echo "http://$(hostname -I | awk '{print $1}'):$http_port"
            fi
            echo ""

        else
            # ===== HTTPS 模式 =====
            read -p "域名（必填）/ Domain (required): " domain
            if [ -z "$domain" ]; then
                echo "❌ HTTPS 模式必须填写域名 / Domain is required for HTTPS"
                exit 1
            fi

            read -p "HTTPS 端口 / HTTPS port [8443]: " https_port
            https_port=${https_port:-8443}

            read -p "HTTP 端口（用于跳转 HTTPS）/ HTTP port (redirect to HTTPS) [8080]: " http_port
            http_port=${http_port:-8080}

            # 写入 .env
            sed -i "s/EXTERNAL_HTTP_PORT=.*/EXTERNAL_HTTP_PORT=$http_port/" .env
            sed -i "s/EXTERNAL_HTTPS_PORT=.*/EXTERNAL_HTTPS_PORT=$https_port/" .env

            # 配置证书
            echo ""
            echo "请选择证书来源 / Select certificate source:"
            echo "1) 自动申请（Let's Encrypt）/ Auto obtain (Let's Encrypt)"
            echo "2) 已有证书，手动指定路径 / I have certificates, specify path"
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
                        cp /etc/letsencrypt/live/$domain/fullchain.pem nginx/ssl/
                        cp /etc/letsencrypt/live/$domain/privkey.pem nginx/ssl/
                        echo "✅ 证书申请成功 / Certificate obtained"
                        cert_ok=true
                    else
                        echo ""
                        echo "❌ 证书申请失败，可能是 80 端口被占用"
                        echo "❌ Certificate failed, port 80 may be in use"
                        echo ""
                        echo "💡 提示：如果 80 端口被占用，可以尝试 DNS 验证："
                        echo "   certbot certonly --manual --preferred-challenges dns -d $domain"
                        echo "   申请成功后将证书复制到 nginx/ssl/ 目录，然后重新运行此脚本"
                    fi
                    ;;
                2)
                    echo ""
                    read -p "证书文件路径 (fullchain.pem): " cert_path
                    read -p "私钥文件路径 (privkey.pem): " key_path

                    if [ ! -f "$cert_path" ]; then
                        echo "❌ 证书文件不存在: $cert_path"
                    elif [ ! -f "$key_path" ]; then
                        echo "❌ 私钥文件不存在: $key_path"
                    else
                        mkdir -p nginx/ssl
                        cp "$cert_path" nginx/ssl/fullchain.pem
                        cp "$key_path" nginx/ssl/privkey.pem
                        echo "✅ 证书文件已复制 / Certificate files copied"
                        cert_ok=true
                    fi
                    ;;
                *)
                    echo "❌ 无效选项 / Invalid option"
                    ;;
            esac

            if [ "$cert_ok" = false ]; then
                echo ""
                echo "⚠️  证书未配置成功，将以 HTTP 模式启动"
                echo "⚠️  Certificate not configured, starting in HTTP mode"
                echo ""
                rm -f nginx/conf.d/ssl.conf
                docker compose up -d

                echo ""
                echo "访问地址 / Access URL:"
                echo "http://$domain:$http_port"
                echo ""
                echo "💡 证书配置好后，重新运行 ./start.sh 选择 HTTPS 即可"
            else
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
                    exit 0
                fi

                echo ""
                echo "🚀 启动服务..."
                docker compose up -d

                echo ""
                echo "=========================================="
                echo "✅ 部署成功！/ Deployment successful!"
                echo "=========================================="
                echo ""
                echo "访问地址 / Access URL:"
                echo "https://$domain:$https_port"
                echo ""
            fi
        fi
        ;;

    *)
        echo "❌ 无效选项 / Invalid option"
        exit 1
        ;;
esac

echo ""
echo "📊 查看日志 / View logs:"
echo "docker compose logs -f"
echo ""
echo "🔄 重启服务 / Restart services:"
echo "docker compose restart"
echo ""
echo "🛑 停止服务 / Stop services:"
echo "docker compose down"
echo ""
echo "📖 详细文档 / Documentation:"
echo "- QUICK_START.md (快速开始)"
echo "- DEPLOYMENT.md (详细部署)"
echo ""
