#!/usr/bin/env bash
set -u

PANEL_DIR="${PANEL_DIR:-/root/vless-panel}"
DB="${DB:-$PANEL_DIR/data/panel.db}"
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
    i=$((i + 1))
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
