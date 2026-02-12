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
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
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
        docker-compose up -d

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
            docker-compose up -d
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
            echo "docker-compose up -d"
        fi
        ;;

    3)
        echo ""
        echo "📝 请手动编辑 .env 文件进行配置"
        echo "📝 Please manually edit .env file for configuration"
        echo ""
        read -p "配置完成后按回车启动 / Press Enter to start after configuration: "
        docker-compose up -d

        echo ""
        echo "=========================================="
        echo "✅ 部署成功！/ Deployment successful!"
        echo "=========================================="
        ;;

    *)
        echo "❌ 无效选项 / Invalid option"
        exit 1
        ;;
esac

echo ""
echo "📊 查看日志 / View logs:"
echo "docker-compose logs -f"
echo ""
echo "🔄 重启服务 / Restart services:"
echo "docker-compose restart"
echo ""
echo "🛑 停止服务 / Stop services:"
echo "docker-compose down"
echo ""
echo "📖 详细文档 / Documentation:"
echo "- QUICK_START.md (快速开始)"
echo "- DEPLOYMENT.md (详细部署)"
echo ""
