# 🍑 小姨子的诱惑

VLESS 代理面板，支持多节点管理、AWS 云集成、AI 无人值守运维。

## ✨ 功能一览

### 🌐 节点管理
- **一键部署** — 输入 IP + SSH 密码，自动安装 Xray + Reality + Agent
- **自动命名** — IP 地理检测，生成名字如「🇯🇵 东京-波光粼粼」
- **SOCKS5 落地** — 家宽中转，🏠 前缀标识
- **节点等级** — Lv.0-4，按用户信任等级分配节点
- **自动轮换** — 定期换端口+UUID，每 7 天重置订阅 Token

### 👥 用户系统
- **NodeLoc OAuth** 登录，自动同步头像、等级
- **封禁/解封** — 配置实时同步到所有节点
- **流量限额** — 单用户/全局默认，超额自动冻结
- **白名单** — 注册白名单 + 节点白名单（无视等级限制）
- **注册限制** — 可设最大注册人数

### 📡 订阅系统
- **自动识别客户端** — v2rayN/Clash/Surge/Shadowrocket
- **强制格式** — `?type=clash|surge|v2ray`
- **流量信息** — 响应头含 `Subscription-Userinfo`
- **防滥用** — 限流 + 多 IP 拉取检测 + TG 通知

### ☁️ AWS 集成
- **EC2 + Lightsail** — 换 IP、启停、终止、创建实例
- **节点绑定** — 绑定后支持一键换 IP、被墙自动换 IP
- **一键创建部署** — 选账号+区域+规格 → 自动创建+部署+绑定
- **多账号** — 每个账号可配独立 SOCKS5 代理
- **加密存储** — AK/SK 使用 AES-256-GCM 加密

### 🤝 Agent 系统
- **WebSocket 长连接** — 每节点一个轻量 Agent（Node.js 单文件）
- **定时上报** — Xray 状态、按用户流量统计、中国可达性、系统负载
- **远程指令** — ping、restart_xray、update_config、exec、self_update
- **自愈机制** — Xray 自动重启 + 断线重连 + Watchdog 兜底
- **TLS 严格校验** — 默认校验服务端证书，可通过 `AGENT_INSECURE_TLS=true` 临时放宽（仅调试用）
- **exec 白名单** — 默认仅允许安全命令前缀，支持通过 config 追加自定义白名单

### 🧠 AI 运维（OpenClaw 集成）
- **无人值守** — 本机 OpenClaw 直接操作 sqlite3/pm2/ssh，无中间层
- **面板守护** — PM2 进程挂了自动重启
- **节点巡检** — TCP 探测端口，检测是否正常
- **被墙自动换 IP** — 端口不通 + 有 AWS 绑定 → 自动换 IP
- **节点自动修复** — Agent/SSH 重启 Xray + 同步配置
- **自动扩缩容** — 节点不足时自动创建 AWS 实例并部署
- **运营日记** — 自动记录每次运维操作，见证面板成长

### 🔔 通知
- **Telegram** — 节点上下线、被墙、轮换、部署、流量超标、订阅异常、新用户注册

### 🔐 安全
- AES-256-GCM 加密存储敏感信息
- CSRF 防护、HSTS、Helmet 安全头
- 订阅接口限流，防暴力猜测

## 🛠 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Node.js + Express + better-sqlite3 |
| 前端 | EJS + Tailwind CSS（暗色玫瑰主题） |
| 代理 | Xray (VLESS + Reality + XTLS Vision) |
| 节点管理 | Agent (WebSocket) + SSH 后备 |
| 云集成 | AWS SDK v3 (EC2 + Lightsail) |
| AI 运维 | OpenClaw |
| 部署 | PM2 + Nginx + Cloudflare |

## 🚀 部署

```bash
git clone <repo> && cd vless-panel
npm install
cp .env.example .env  # 编辑配置
pm2 start ecosystem.config.js
```

### .env 配置

```env
# 必填
SESSION_SECRET=<随机字符串>
NODELOC_URL=https://www.nodeloc.com
NODELOC_CLIENT_ID=<OAuth Client ID>
NODELOC_CLIENT_SECRET=<OAuth Client Secret>
NODELOC_REDIRECT_URI=https://your-domain/auth/callback

# 可选
PORT=3000
```

### Nginx 反代

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Agent WebSocket
    location /ws/agent {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### AI 运维（可选）

```bash
npm i -g openclaw
cd openclaw-ops && bash setup.sh
openclaw gateway start
```

## 📁 项目结构

```
vless-panel/
├── src/
│   ├── app.js                  # Express 入口
│   ├── middleware/
│   │   ├── auth.js             # OAuth 认证
│   │   ├── csrf.js             # CSRF 防护
│   │   └── rateLimit.js        # 限流
│   ├── routes/
│   │   ├── auth.js             # OAuth 登录/回调
│   │   ├── panel.js            # 用户面板 + 订阅
│   │   ├── admin.js            # 管理后台页面
│   │   └── adminApi.js         # 管理 REST API
│   ├── services/
│   │   ├── database.js         # SQLite 数据层
│   │   ├── deploy.js           # SSH 部署 + 配置同步 + Agent 安装
│   │   ├── aws.js              # AWS EC2/Lightsail 操作
│   │   ├── agent-ws.js         # Agent WebSocket 服务端
│   │   ├── health.js           # 健康检测 + 流量处理
│   │   ├── rotate.js           # UUID/Token 轮换
│   │   ├── notify.js           # Telegram 通知
│   │   └── traffic.js          # 流量统计
│   └── utils/
│       ├── vless.js            # VLESS 链接 + 订阅生成
│       ├── crypto.js           # AES-256-GCM 加解密
│       └── names.js            # 中文节点名生成器
├── node-agent/
│   └── agent.js                # 节点 Agent（单文件，自动部署到节点）
├── openclaw-ops/               # OpenClaw AI 运维套件
│   ├── setup.sh                # 一键初始化
│   ├── HEARTBEAT.md            # 心跳巡检任务
│   ├── AGENTS.md               # AI 行为规范
│   ├── SOUL.md                 # AI 人设模板
│   └── README.md               # 说明文档
├── views/                      # EJS 模板
├── data/                       # SQLite 数据库 + 日志
└── ecosystem.config.js         # PM2 配置
```

## 📋 管理后台

10 个功能 Tab：

| Tab | 功能 |
|---|---|
| 🌐 节点 | 部署、删除、编辑、等级设置、配置同步 |
| 👥 用户 | 封禁、重置订阅、流量限额、搜索 |
| 📊 流量 | 按用户/节点的流量统计，支持日/周/月/自定义 |
| 🔒 白名单 | 注册白名单 + 节点白名单 |
| 📋 日志 | 审计日志，支持系统/操作/全部筛选 |
| 📈 订阅统计 | 拉取次数、IP 分布、UA、风险等级 |
| 🔔 通知 | TG Bot 配置、7 种通知事件开关 |
| ☁️ AWS | 多账号管理、实例仪表盘、一键创建部署 |
| 🧠 AI运维 | 运维配置（自动换IP/修复/扩缩容/守护） |
| 📔 运营日记 | AI 运维操作的时间线记录 |
| 📖 使用说明 | 全功能文档 + API 参考 + 搜索 |

## 📄 License

MIT
