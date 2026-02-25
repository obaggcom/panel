# OpenClaw AI 运维套件

让 OpenClaw 自动运维 VLESS 面板，无人值守。

## 工作原理

```
OpenClaw (AI)
  ↕ 心跳定时触发
HEARTBEAT.md (巡检流程)
  ↓ 直接操作
sqlite3 / pm2 / ssh / node
  ↓
面板数据库 / 节点服务器 / AWS
```

**没有中间层**。AI 直接读数据库、管进程、SSH 到节点，跟人手动运维一样，只是换成 AI 来做。

## 快速开始

```bash
# 1. 安装 OpenClaw
npm i -g openclaw

# 2. 初始化运维 workspace
cd /path/to/vless-panel/openclaw-ops
bash setup.sh

# 3. 配置并启动 OpenClaw
openclaw gateway start
```

## AI 能做什么

- ✅ 面板守护（挂了自动重启）
- ✅ 节点健康检测（TCP 探测）
- ✅ 被墙自动换 IP（AWS 联动）
- ✅ 节点自动修复（重启 xray + 同步配置）
- ✅ 自动扩缩容（AWS 创建/销毁实例）
- ✅ 异常通知（Telegram）

## 运维配置

在面板后台 🤖AI运维 Tab 设置，或直接改数据库：

```sql
-- 查看配置
SELECT key, value FROM settings WHERE key LIKE 'ops_%';

-- 开启自动换 IP
UPDATE settings SET value='true' WHERE key='ops_auto_swap_ip';
```

## 文件说明

| 文件 | 用途 |
|------|------|
| `setup.sh` | 一键初始化 OpenClaw workspace |
| `HEARTBEAT.md` | 心跳巡检流程（直接操作模式） |
| `AGENTS.md` | AI 行为规范 |
| `SOUL.md` | AI 人设（可自定义） |
