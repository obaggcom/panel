#!/bin/bash
# OpenClaw AI 运维初始化脚本
# 将运维模板部署到 OpenClaw workspace，直接操作模式

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PANEL_DIR="$(dirname "$SCRIPT_DIR")"
WORKSPACE="${OPENCLAW_WORKSPACE:-$HOME/.openclaw/workspace}"

echo "🤖 OpenClaw AI 运维初始化"
echo "========================="
echo "面板目录: $PANEL_DIR"
echo "Workspace: $WORKSPACE"
echo ""

# 检查 OpenClaw
if ! command -v openclaw &>/dev/null; then
  echo "❌ 未安装 OpenClaw，请先运行: npm i -g openclaw"
  exit 1
fi

# 检查面板
if [ ! -f "$PANEL_DIR/src/app.js" ]; then
  echo "❌ 找不到面板代码，请在 vless-panel 目录下运行"
  exit 1
fi

# 创建 workspace
mkdir -p "$WORKSPACE/memory"

# 复制模板（不覆盖已有文件）
copy_if_missing() {
  local src="$1" dst="$2"
  if [ -f "$dst" ]; then
    echo "  ⏭️  $(basename $dst) 已存在，跳过"
  else
    cp "$src" "$dst"
    echo "  ✅ $(basename $dst)"
  fi
}

echo "📋 部署模板文件..."
copy_if_missing "$SCRIPT_DIR/HEARTBEAT.md" "$WORKSPACE/HEARTBEAT.md"
copy_if_missing "$SCRIPT_DIR/SOUL.md" "$WORKSPACE/SOUL.md"
copy_if_missing "$SCRIPT_DIR/AGENTS.md" "$WORKSPACE/AGENTS.md"

# 写入面板路径（供 AI 知道面板在哪）
if ! grep -q "vless-panel" "$WORKSPACE/MEMORY.md" 2>/dev/null; then
  cat >> "$WORKSPACE/MEMORY.md" << EOF

## 🍑 VLESS 面板
- **项目路径**：$PANEL_DIR
- **数据库**：$PANEL_DIR/data/panel.db
- **PM2 进程名**：vless-panel
EOF
  echo "  ✅ MEMORY.md 已追加面板信息"
fi

echo ""
echo "✨ 初始化完成！"
echo ""
echo "启动 OpenClaw: openclaw gateway start"
echo "AI 会通过心跳自动巡检面板和节点"
