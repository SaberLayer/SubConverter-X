#!/bin/bash

# SubConverter-X GitHub 发布脚本
# 使用方法: bash publish.sh YOUR_GITHUB_USERNAME

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查参数
if [ -z "$1" ]; then
    echo -e "${RED}错误: 请提供 GitHub 用户名${NC}"
    echo "使用方法: bash publish.sh YOUR_GITHUB_USERNAME"
    exit 1
fi

GITHUB_USERNAME=$1
REPO_NAME="SubConverter-X"

echo -e "${GREEN}=== SubConverter-X GitHub 发布脚本 ===${NC}\n"

# 步骤 1: 检查敏感文件
echo -e "${YELLOW}[1/6] 检查敏感文件...${NC}"
if [ -f ".env" ]; then
    echo -e "${RED}警告: 发现 .env 文件，请确保它不会被提交${NC}"
    echo "按 Ctrl+C 取消，或按 Enter 继续..."
    read
fi

if [ -f "data/subscriptions.db" ]; then
    echo -e "${YELLOW}提示: 发现数据库文件，已被 .gitignore 忽略${NC}"
fi

# 步骤 2: 初始化 Git 仓库
echo -e "\n${YELLOW}[2/6] 初始化 Git 仓库...${NC}"
if [ ! -d ".git" ]; then
    git init
    echo -e "${GREEN}✓ Git 仓库初始化完成${NC}"
else
    echo -e "${GREEN}✓ Git 仓库已存在${NC}"
fi

# 步骤 3: 添加文件
echo -e "\n${YELLOW}[3/6] 添加文件到 Git...${NC}"
git add .
echo -e "${GREEN}✓ 文件添加完成${NC}"

# 步骤 4: 创建首次提交
echo -e "\n${YELLOW}[4/6] 创建首次提交...${NC}"
if git rev-parse HEAD >/dev/null 2>&1; then
    echo -e "${GREEN}✓ 已存在提交记录${NC}"
else
    git commit -m "feat: initial commit - SubConverter-X v1.0.0

🎉 SubConverter-X - 隐私优先的订阅转换工具

核心功能：
- 支持 12 种代理协议（SS/SSR/VMess/VLESS/Trojan/Hysteria/Hysteria2/TUIC/WireGuard/SOCKS5/HTTP）
- 支持 8 种输出格式（Clash Meta/sing-box/Surge/QX/Shadowrocket/Loon/V2Ray/Base64）
- 节点处理：去重、排序、过滤、重命名、Emoji 国旗
- 自动区域分组
- 配置预设管理
- 短链生成
- Docker 一键部署

技术栈：
- 后端: Node.js + TypeScript + Express + SQLite
- 前端: React + TypeScript + Vite + Tailwind CSS
- 部署: Docker + Docker Compose

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
    echo -e "${GREEN}✓ 首次提交完成${NC}"
fi

# 步骤 5: 添加远程仓库
echo -e "\n${YELLOW}[5/6] 配置远程仓库...${NC}"
REMOTE_URL="https://github.com/${GITHUB_USERNAME}/${REPO_NAME}.git"

if git remote | grep -q "origin"; then
    echo -e "${YELLOW}远程仓库已存在，更新 URL...${NC}"
    git remote set-url origin $REMOTE_URL
else
    git remote add origin $REMOTE_URL
fi

echo -e "${GREEN}✓ 远程仓库: ${REMOTE_URL}${NC}"

# 步骤 6: 推送到 GitHub
echo -e "\n${YELLOW}[6/6] 推送到 GitHub...${NC}"
echo -e "${YELLOW}请确保你已经在 GitHub 创建了仓库: ${REPO_NAME}${NC}"
echo "按 Enter 继续推送，或按 Ctrl+C 取消..."
read

git branch -M main
git push -u origin main

echo -e "\n${GREEN}=== 发布完成！===${NC}"
echo -e "${GREEN}✓ 项目已成功推送到 GitHub${NC}"
echo -e "\n访问你的仓库: ${GREEN}https://github.com/${GITHUB_USERNAME}/${REPO_NAME}${NC}"

echo -e "\n${YELLOW}下一步操作：${NC}"
echo "1. 访问 GitHub 仓库设置 Topics 标签"
echo "2. 启用 Issues 和 Discussions"
echo "3. 创建第一个 Release (v1.0.0)"
echo "4. 查看 CI/CD 运行状态"
echo ""
echo "详细说明请查看: PUBLISH_TO_GITHUB.md"
