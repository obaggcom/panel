# OpenClaw AI 运维套件

让 OpenClaw 自动运维 VLESS 面板，无人值守。

## 前置条件

- 面板已部署在本机，默认路径：`/root/vless-panel`
- 已安装并运行 PM2（进程名：`vless-panel`）
- 已安装 OpenClaw：`npm i -g openclaw`
- 如需远程修复节点，建议使用 SSH Key（不建议明文密码）

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
# 1. 初始化运维 workspace
cd /path/to/vless-panel/openclaw-ops
bash setup.sh

# 2. 配置并启动 OpenClaw
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

在面板后台「🧠 运维」Tab 设置，或直接改数据库：

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

## 注意事项

- `openclaw-ops` 不是面板运行必需组件；不用 OpenClaw 时不影响业务。
- 文档中的绝对路径可按你的实际目录调整。

## 调度示例（可选）

先赋予脚本执行权限：

```bash
cd /root/vless-panel/openclaw-ops
chmod +x heartbeat.sh
```

使用 `cron`（每 5 分钟巡检）：

```bash
*/5 * * * * /root/vless-panel/openclaw-ops/heartbeat.sh >/dev/null 2>&1
```

使用 `pm2`（更适合 Node 机器统一进程管理）：

```bash
pm2 start /root/vless-panel/openclaw-ops/heartbeat.sh \
  --name vless-heartbeat \
  --cron "*/5 * * * *" \
  --no-autorestart \
  --interpreter bash
```
