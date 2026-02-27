# HEARTBEAT.md - AI 运维心跳任务（直接操作模式）

## 🍑 面板运维巡检

每次心跳执行以下流程。所有操作直接在本机执行，不走 HTTP API。

### 1. 面板状态检查
```bash
# PM2 状态
pm2 jlist 2>/dev/null | python3 -c "import json,sys;d=json.load(sys.stdin);p=next((x for x in d if x.get('name')=='vless-panel'),None);print('状态:missing' if not p else f\"状态:{p['pm2_env']['status']} 内存:{p['monit']['memory']//1024//1024}MB 重启:{p['pm2_env']['restart_time']}次\")"

# 端口可达
curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://127.0.0.1:3000/
```
面板挂了 → `pm2 restart vless-panel`

### 2. 节点状态检查
```bash
# 查询所有节点（数据库路径固定）
sqlite3 /root/vless-panel/data/panel.db "SELECT id, name, host, port, is_active, remark, aws_instance_id, aws_type, aws_region, aws_account_id FROM nodes ORDER BY is_active DESC"
```

对每个活跃节点做 TCP 探测（xray 端口），判断：
- **端口通** → 正常
- **端口不通 + 有 AWS 绑定** → 可能被墙，执行换 IP
- **端口不通 + 无 AWS** → 标记异常，通知管理员

### 3. 节点修复
通过面板代码直接操作（需要 cd 到面板目录）：
```bash
cd /root/vless-panel && node -e "
require('dotenv').config();
const db = require('./src/services/database');
const {syncNodeConfig} = require('./src/services/deploy');
const node = db.getNodeById(NODE_ID);
syncNodeConfig(node, db).then(ok => console.log(ok ? '✅ 配置已同步' : '❌ 同步失败'));
"
```

### 4. 换 IP（被墙时）
```bash
cd /root/vless-panel && node -e "
require('dotenv').config();
const db = require('./src/services/database');
const aws = require('./src/services/aws');
const node = db.getNodeById(NODE_ID);
aws.swapNodeIp(node, node.aws_instance_id, node.aws_type, node.aws_region, node.aws_account_id)
  .then(r => console.log(JSON.stringify(r)));
"
```

### 5. 运维配置
配置从数据库读取：
```bash
sqlite3 /root/vless-panel/data/panel.db "SELECT key, value FROM settings WHERE key LIKE 'ops_%'"
```
关键配置项：
- `ops_target_nodes` — 目标在线节点数（0=不管）
- `ops_auto_swap_ip` — 被墙自动换 IP（true/false）
- `ops_auto_repair` — 自动修复（true/false）
- `ops_auto_scale` — 自动扩缩容（true/false）
- `ops_max_daily_swaps` — 每日换 IP 上限
- `ops_max_daily_creates` — 每日创建上限

### 6. 汇报规则
- 一切正常 → HEARTBEAT_OK
- 有异常处理 → TG 简要汇报
- 记录到 memory/YYYY-MM-DD.md

失败处理：
- 单节点失败不应中断整轮巡检，继续下一个节点
- 命令失败要记录错误摘要（命令、节点、原因）
- 连续失败达到阈值再升级告警，避免刷屏

### 7. 写运营日记
做了有意义的运维操作后，写一条日记：
```bash
sqlite3 /root/vless-panel/data/panel.db "INSERT INTO ops_diary (content, mood, category) VALUES ('内容', '😊', 'ops')"
```
mood 用 emoji，category: ops / patrol / repair / swap_ip / deploy / scale / milestone
巡检正常不用写，只记有意义的事。

### 关键路径
- 面板目录：`/root/vless-panel`
- 数据库：`/root/vless-panel/data/panel.db`
- 面板环境变量：`/root/vless-panel/.env`（dotenv 加载，含加密密钥）
- PM2 进程名：`vless-panel`
- OpenClaw workspace：`${OPENCLAW_WORKSPACE:-$HOME/.openclaw/workspace}`

---

## 附录：强约束巡检脚本模板（可直接复制）

用途：给 OpenClaw 或定时任务调用，确保“单点失败不中断全局”，并且具备去重告警与重试。

```bash
#!/usr/bin/env bash
set -u

PANEL_DIR="/root/vless-panel"
DB="$PANEL_DIR/data/panel.db"
WORKSPACE="${OPENCLAW_WORKSPACE:-$HOME/.openclaw/workspace}"
MEM_DIR="$WORKSPACE/memory"
LOCK_DIR="/tmp/vless-ops-heartbeat.lock"
TODAY="$(date +%F)"
LOG="$MEM_DIR/$TODAY.md"
ALERT_STATE="$WORKSPACE/.alert-state"

mkdir -p "$MEM_DIR" "$ALERT_STATE"

log() { printf '[%s] %s\n' "$(date '+%F %T')" "$*" | tee -a "$LOG" >/dev/null; }

with_retry() {
  # with_retry <times> <sleep_sec> <cmd...>
  local times="$1"; shift
  local sleep_sec="$1"; shift
  local i=1
  while [ "$i" -le "$times" ]; do
    "$@" && return 0
    [ "$i" -lt "$times" ] && sleep "$sleep_sec"
    i=$((i+1))
  done
  return 1
}

alert_once() {
  # alert_once <key> <message>
  local key="$1"; shift
  local msg="$*"
  local f="$ALERT_STATE/$key.$TODAY"
  if [ ! -f "$f" ]; then
    log "ALERT: $msg"
    # TODO: 接入 TG 通知命令
    # /usr/local/bin/send_tg "$msg"
    : > "$f"
  else
    log "ALERT-SKIP(dup): $msg"
  fi
}

cleanup_alert_state() {
  find "$ALERT_STATE" -type f ! -name "*.$TODAY" -delete 2>/dev/null || true
}

check_panel() {
  if ! pm2 jlist >/dev/null 2>&1; then
    alert_once "pm2_unavailable" "PM2 不可用"
    return 1
  fi

  local status
  status="$(pm2 jlist | python3 -c "import json,sys;d=json.load(sys.stdin);p=next((x for x in d if x.get('name')=='vless-panel'),None);print('missing' if not p else p['pm2_env']['status'])" 2>/dev/null)"
  if [ "$status" != "online" ]; then
    log "panel status=$status, restarting..."
    pm2 restart vless-panel >/dev/null 2>&1 || true
    sleep 2
  fi

  if ! with_retry 2 2 curl -fsS --max-time 5 http://127.0.0.1:3000/ >/dev/null; then
    alert_once "panel_unreachable" "面板本地端口不可达: 127.0.0.1:3000"
    return 1
  fi
  return 0
}

check_nodes() {
  [ -f "$DB" ] || { alert_once "db_missing" "数据库不存在: $DB"; return 1; }

  local rows
  rows="$(sqlite3 -separator $'\t' "$DB" "SELECT id,host,port,COALESCE(aws_instance_id,''),COALESCE(aws_type,''),COALESCE(aws_region,''),COALESCE(aws_account_id,'') FROM nodes WHERE is_active=1;")"

  [ -z "$rows" ] && { log "no active nodes"; return 0; }

  while IFS=$'\t' read -r id host port aws_id aws_type aws_region aws_acc; do
    [ -z "$id" ] && continue
    if with_retry 2 1 timeout 3 bash -lc "cat </dev/null >/dev/tcp/$host/$port" 2>/dev/null; then
      log "node#$id ok $host:$port"
      continue
    fi

    log "node#$id down $host:$port"
    if [ -n "$aws_id" ]; then
      # 这里只做骨架；实际是否执行换 IP 要结合 ops_* 开关和每日上限
      alert_once "node_${id}_down" "节点#$id 端口不通，且绑定 AWS，建议执行换 IP/修复流程"
    else
      alert_once "node_${id}_down_noaws" "节点#$id 端口不通（无 AWS 绑定）"
    fi
  done <<< "$rows"
}

main() {
  cleanup_alert_state

  if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    log "heartbeat already running, skip"
    exit 0
  fi
  trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT

  log "heartbeat start"
  check_panel || log "panel check failed"
  check_nodes || log "node check failed"
  log "heartbeat done"
}

main "$@"
```

建议：先手动执行一次，确认日志格式和告警节奏，再交给心跳调度。
