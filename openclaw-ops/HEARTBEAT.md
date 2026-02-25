# HEARTBEAT.md - AI 运维心跳任务（直接操作模式）

## 🍑 面板运维巡检

每次心跳执行以下流程。所有操作直接在本机执行，不走 HTTP API。

### 1. 面板状态检查
```bash
# PM2 状态
pm2 jlist 2>/dev/null | python3 -c "import json,sys;d=json.load(sys.stdin);p=[x for x in d if x['name']=='vless-panel'][0];print(f\"状态:{p['pm2_env']['status']} 内存:{p['monit']['memory']//1024//1024}MB 重启:{p['pm2_env']['restart_time']}次\")"

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
