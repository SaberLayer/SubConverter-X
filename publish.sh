#!/bin/bash

# SubConverter-X GitHub 发布辅助脚本

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

YES_MODE=false
DRY_RUN=false
GITHUB_USERNAME=""
REPO_NAME="SubConverter-X"

show_help() {
    cat <<'EOF'
SubConverter-X GitHub 发布辅助脚本

用法:
  ./publish.sh <GitHub用户名> [选项]

选项:
  -h, --help       显示帮助信息
  -y, --yes        自动确认常规发布步骤
      --dry-run    只展示将执行的 Git 命令，不实际提交或推送
      --repo NAME  指定仓库名，默认 SubConverter-X

示例:
  ./publish.sh yourname
  ./publish.sh yourname --dry-run
  ./publish.sh yourname --repo subconverter-x
EOF
}

while [ $# -gt 0 ]; do
    case "$1" in
        -h|--help)
            show_help
            exit 0
            ;;
        -y|--yes)
            YES_MODE=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --repo)
            if [ $# -lt 2 ]; then
                echo -e "${RED}错误: --repo 需要仓库名${NC}"
                exit 1
            fi
            REPO_NAME=$2
            shift 2
            ;;
        -*)
            echo -e "${RED}未知参数: $1${NC}"
            echo "运行 ./publish.sh --help 查看可用参数"
            exit 1
            ;;
        *)
            if [ -n "$GITHUB_USERNAME" ]; then
                echo -e "${RED}错误: 只能提供一个 GitHub 用户名${NC}"
                exit 1
            fi
            GITHUB_USERNAME=$1
            shift
            ;;
    esac
done

if [ -z "$GITHUB_USERNAME" ]; then
    echo -e "${RED}错误: 请提供 GitHub 用户名${NC}"
    echo "使用方法: ./publish.sh YOUR_GITHUB_USERNAME"
    exit 1
fi

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

echo -e "${GREEN}=== SubConverter-X GitHub 发布辅助脚本 ===${NC}"
echo ""

echo -e "${YELLOW}[1/6] 检查敏感文件...${NC}"
if [ -f ".env" ]; then
    echo -e "${YELLOW}提示: 发现 .env 文件，仓库已通过 .gitignore 忽略它${NC}"
fi
if git status --short --ignored .env data packages/backend/data nginx/ssl 2>/dev/null | grep -q '^!!'; then
    echo "已确认常见运行时文件处于忽略状态。"
fi

echo ""
echo -e "${YELLOW}[2/6] 检查 Git 仓库...${NC}"
if [ ! -d ".git" ]; then
    run_cmd git init
    echo -e "${GREEN}Git 仓库初始化完成${NC}"
else
    echo -e "${GREEN}Git 仓库已存在${NC}"
fi

echo ""
echo -e "${YELLOW}[3/6] 检查工作区...${NC}"
git status --short
echo ""
echo "脚本不会自动执行 git add .，请先确认将要发布的文件。"
if ! confirm_action "确认暂存当前改动？(Y/n) / Stage current changes? (Y/n): " "Y"; then
    echo "已取消。你可以手动 git add 后重新运行。"
    exit 0
fi
run_cmd git add --all

echo ""
echo -e "${YELLOW}[4/6] 创建提交（如需要）...${NC}"
if git diff --cached --quiet; then
    echo -e "${GREEN}没有需要提交的暂存改动${NC}"
elif git rev-parse HEAD >/dev/null 2>&1; then
    echo "检测到已有提交历史。"
    if confirm_action "是否创建发布准备提交？(y/N) / Create release prep commit? (y/N): " "N"; then
        run_cmd git commit -m "chore: 准备发布到 GitHub" \
            -m "- 整理发布前项目文件" \
            -m "- 保留本地敏感配置忽略规则"
    else
        echo "已保留暂存改动，未创建提交。"
    fi
else
    run_cmd git commit -m "feat: 初始化 SubConverter-X 项目" \
        -m "- 提供隐私优先的自部署订阅转换工具" \
        -m "- 支持多协议解析和多客户端配置生成" \
        -m "- 提供 Docker Compose 部署和管理脚本"
fi

echo ""
echo -e "${YELLOW}[5/6] 配置远程仓库...${NC}"
REMOTE_URL="https://github.com/${GITHUB_USERNAME}/${REPO_NAME}.git"
if git remote | grep -q '^origin$'; then
    echo "origin 已存在，将更新为: $REMOTE_URL"
    run_cmd git remote set-url origin "$REMOTE_URL"
else
    run_cmd git remote add origin "$REMOTE_URL"
fi

echo ""
echo -e "${YELLOW}[6/6] 推送到 GitHub...${NC}"
echo "请先在 GitHub 创建空仓库: ${REPO_NAME}"
echo "目标地址: ${REMOTE_URL}"
if ! confirm_action "确认推送 main 分支？(Y/n) / Push main branch? (Y/n): " "Y"; then
    echo "已取消推送。"
    exit 0
fi

run_cmd git branch -M main
run_cmd git push -u origin main

echo ""
echo -e "${GREEN}发布流程完成。仓库地址: https://github.com/${GITHUB_USERNAME}/${REPO_NAME}${NC}"
echo ""
echo -e "${CYAN}建议继续完善:${NC}"
echo "1. 在 GitHub 仓库设置 Topics 标签"
echo "2. 启用 Issues 和 Discussions"
echo "3. 创建 Release 并填写 CHANGELOG"
echo "4. 检查 Actions 中 CI 是否通过"
