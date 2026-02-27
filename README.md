# VLESS Panel

Node.js + Express + SQLite 的 VLESS/SS 节点管理面板，包含 NodeLoc OAuth 登录、订阅分发、节点部署、Agent 通道、流量统计、AWS 联动与后台运维能力。

## 目录

- [项目定位](#项目定位)
- [核心能力](#核心能力)
- [系统架构](#系统架构)
- [运行要求](#运行要求)
- [快速开始](#快速开始)
- [环境变量](#环境变量)
- [部署建议](#部署建议)
- [管理后台功能](#管理后台功能)
- [接口总览](#接口总览)
- [定时任务](#定时任务)
- [数据与备份](#数据与备份)
- [安全机制](#安全机制)
- [测试与质量](#测试与质量)
- [常见运维操作](#常见运维操作)
- [目录结构](#目录结构)
- [相关文档](#相关文档)

## 项目定位

本项目面向“自建多节点代理”的运维场景，目标是把以下流程放到一个面板里完成：

- 用户登录与授权
- 节点部署、更新、轮换、状态追踪
- 订阅分发与反滥用控制
- 用户与流量管理
- AWS 实例联动（创建、启停、换 IP、绑定）
- 备份、恢复、审计与通知

## 核心能力

### 1) 登录与用户体系

- NodeLoc OAuth2 登录（`/auth/nodeloc` + `/auth/callback`）
- 首个注册用户自动设为管理员
- 用户状态：`is_admin / is_blocked / is_frozen`
- 支持用户到期时间 `expires_at`
- 支持注册白名单与节点白名单

### 2) 节点与配置同步

- 支持 VLESS、SS、双协议部署
- 支持 Reality 参数写入（public/private key, short id, sni）
- 支持 SOCKS5 出口链路（节点级配置）
- 节点配置可通过 Agent 下发，失败回退 SSH
- 支持节点分组/标签、等级门槛、手动节点管理

### 3) Agent 通道与健康数据

- WebSocket Agent 服务端：`/ws/agent`
- 节点 Agent 在线池、ping/pong、命令回执、超时处理
- Agent 上报：`xrayAlive / cnReachable / ipv6Reachable / trafficRecords`
- 节点失败防抖（连续失败阈值后才判离线）
- 手动节点连续失败自动移除

### 4) 订阅系统

- 主订阅：`/sub/:token`（VLESS）
- IPv6/SS 订阅：`/sub6/:token`
- 自动识别客户端并生成：v2ray base64 / clash yaml / sing-box json
- 支持 `?type=clash|singbox|v2ray` 强制格式
- 响应头包含 `Subscription-Userinfo`
- 订阅二维码：`/sub-qr`、`/sub6-qr`

### 5) 订阅风控与反滥用

- 空 UA 拒绝
- 订阅接口限流（IP 级）
- Token 行为风控（窗口频率、IP/UA 切换）
- 模式可选：`off | observe | enforce`
- 滥用访问触发审计和 Telegram 通知

### 6) 流量统计与配额

- 原始流量记录：`traffic`
- 日聚合：`traffic_daily`
- 用户总量汇总：`traffic_user_total`（用于后台列表高效排序）
- 用户流量配额（单用户 + 全局默认值）
- 今日/近 7 天/近 30 天/自定义日期查询

### 7) AWS 联动

- 多账号配置（AK/SK 加密存储）
- 可选账号级 SOCKS5 出站代理
- EC2 / Lightsail 列表、启停、终止、换 IP
- 节点绑定 AWS 实例
- 一键“创建实例并部署节点”

### 8) 运维能力

- 审计日志与操作日志 API
- 运营日记、订阅统计、运维事件聚合
- 备份列表、下载、恢复（含完整性校验）
- Telegram 事件通知

## 系统架构

- 后端：Node.js + Express
- 数据库：SQLite（`better-sqlite3`，WAL 模式）
- 会话：`express-session` + `better-sqlite3-session-store`
- 前端：EJS + Tailwind CSS
- 节点控制：WebSocket Agent + SSH 后备
- 云接口：AWS SDK v3（EC2/Lightsail）

## 运行要求

- Node.js >= 20（推荐 22）
- Linux（推荐 Ubuntu/Debian）
- 可访问 SQLite 文件目录（`data/`）
- 反向代理建议使用 Nginx
- 如需 AWS 能力，需要有效 AWS 凭证

## 快速开始

### 1) 本地启动

```bash
git clone <your-repo-url> /root/vless-panel
cd /root/vless-panel
npm install
cp .env.example .env
# 编辑 .env 必填项
npm start
```

### 2) PM2 启动

```bash
cd /root/vless-panel
pm2 start ecosystem.config.js
pm2 logs vless-panel
```

### 3) 一键脚本（Debian/Ubuntu）

项目提供 `install.sh`，会安装 Nginx/PM2 并生成基础配置：

```bash
bash install.sh
```

## 环境变量

### 必填（启动校验）

`src/services/env-check.js` 会在启动时强校验以下变量，缺失直接退出：

- `SESSION_SECRET`
- `NODELOC_URL`
- `NODELOC_CLIENT_ID`
- `NODELOC_CLIENT_SECRET`
- `NODELOC_REDIRECT_URI`

### 常用配置

- `PORT`：服务端口，默认 `3000`
- `WHITELIST_ENABLED`：白名单模式开关（布尔字符串）
- `LOG_LEVEL`：pino 日志等级，默认 `info`

### 反向代理信任

- `TRUST_PROXY`：Express 兼容写法（如 `1`）
- `TRUST_PROXY_CIDRS`：更严格策略，配置后优先于 `TRUST_PROXY`

建议生产优先使用 `TRUST_PROXY_CIDRS`，只信任明确反代来源。

### 订阅风控

- `SUB_CLIENT_FILTER_MODE=off|observe|enforce`
- `SUB_UA_ALLOWLIST`：UA 白名单（逗号分隔，可含正则）
- `SUB_TOKEN_WINDOW_MS`
- `SUB_TOKEN_MAX_REQ`
- `SUB_TOKEN_BAN_MS`
- `SUB_BEHAVIOR_WINDOW_MS`
- `SUB_BEHAVIOR_MAX_IPS`
- `SUB_BEHAVIOR_MAX_UAS`

### 临时登录通道（高风险，仅应急）

代码支持 `POST /auth/temp-login`，默认关闭。相关变量：

- `TEMP_LOGIN_ENABLED=true`
- `TEMP_LOGIN_TOKEN=...`
- `TEMP_LOGIN_ALLOW_PROD=true`（生产需显式允许）
- `TEMP_LOGIN_ONE_TIME=false|true`
- `TEMP_LOGIN_EXPIRES_AT=<毫秒时间戳>`
- `TEMP_LOGIN_IP_ALLOWLIST=ip1,ip2,...`

不需要该能力时请勿开启。

## 部署建议

### 反向代理

Nginx 需正确透传：

- `Host`
- `X-Real-IP`
- `X-Forwarded-For`
- `X-Forwarded-Proto`

并确保 `TRUST_PROXY/TRUST_PROXY_CIDRS` 与你的网络拓扑一致。

### 数据目录

- 数据库：`data/panel.db`
- 日志：`data/logs/`
- 备份：`backups/`

建议将 `data/` 与 `backups/` 纳入系统级备份策略。

## 管理后台功能

后台入口 `/admin`，管理员权限访问。主要能力如下。

### 节点

- 部署 VLESS / SS / 双协议
- 删除节点、更新 IP、更新等级门槛
- 分组/标签维护
- Agent 健康检测
- 手动触发轮换

### 用户

- 分页搜索、排序
- 封禁/解封
- 重置订阅 token
- 设置单用户流量配额
- 设置用户到期时间
- 用户详情（流量 + 订阅访问轨迹）

### 流量

- 用户流量排行（按时间范围）
- 节点维度流量
- 流量趋势

### 白名单

- 节点白名单（按 nodeloc_id）
- 注册白名单（按 username）

### 日志与通知

- 审计日志查询/清理
- Telegram 配置与测试消息
- 事件通知开关

### AWS

- AWS 账号管理（多账号）
- SOCKS5 出口验证
- 实例列表、启停、终止、换 IP
- 节点与实例绑定
- 一键创建并部署节点

### Agent

- 查看在线 Agent
- 下发命令
- 批量 Agent 自更新
- 重置 Agent Token

### 备份

- 列表、创建、下载、恢复

### 运维看板

- 订阅统计
- 运营日记
- 运维配置、运维事件、诊断记录

## 接口总览

### 健康检查

- `GET /healthz`：返回服务与数据库状态

### 鉴权

- `GET /auth/login`
- `GET /auth/nodeloc`
- `GET /auth/callback`
- `GET /auth/logout`
- `POST /auth/temp-login`（可选开启）

### 面板侧

- `GET /`：用户面板
- `GET /sub/:token`
- `GET /sub6/:token`
- `GET /sub-qr`
- `GET /sub6-qr`
- `GET /online-count`
- `GET /api/stats`
- `GET /api/traffic-detail`
- `GET /api/peach-status`

### 管理 API（`/admin/api`）

代码按模块拆分在 `src/routes/admin/`，详见：

- `adminNodes.js`
- `adminUsers.js`
- `adminTraffic.js`
- `adminWhitelist.js`
- `adminSettings.js`
- `adminAws.js`
- `adminAgents.js`
- `adminBackup.js`

## 定时任务

时区统一为 `Asia/Shanghai`：

- `02:00` 自动备份数据库
- `03:00` 自动轮换（端口/UUID + 分级 token 重置）
- `04:00` 自动冻结不活跃用户 + 到期用户，并按需同步节点配置
- `04:30` 清理 90 天前审计日志与订阅访问日志

## 数据与备份

### 备份流程

恢复流程为安全链路：

1. 先创建“恢复前备份”
2. 校验备份完整性（`integrity_check`）
3. `wal_checkpoint(TRUNCATE)`
4. 关闭并替换数据库
5. 重连并再次完整性校验

相关实现：

- `src/services/backup.js`
- `src/services/backupRestore.js`

## 安全机制

- OAuth `state` 严格校验（防登录 CSRF/会话混淆）
- CSRF 保护：
  - JSON 请求校验 Origin/Referer
  - 表单请求校验 token
- `helmet` 安全头 + HSTS
- 登录/订阅/管理 API 限流
- 订阅风控策略与行为封禁
- 可信代理边界控制（`TRUST_PROXY_CIDRS`）
- 会话持久化在 SQLite（非内存会话）
- 管理端关键输入做转义/校验

## 测试与质量

测试使用 Node 内置测试框架（`node --test`）：

```bash
npm test
```

覆盖重点包括：

- OAuth state 校验
- CSRF 保护链路
- 管理接口鉴权契约
- 备份恢复链路（含非 mock 场景）
- 信任代理与 IP 提取
- 时间处理与展示字段
- 订阅风控策略
- 持久会话跨重启可用性
- 流量汇总表增量更新逻辑

## 常见运维操作

### 查看服务日志

```bash
pm2 logs vless-panel
```

### 重启服务

```bash
pm2 restart vless-panel
```

### 执行测试

```bash
cd /root/vless-panel
npm test
```

## 目录结构

```text
vless-panel/
├── src/
│   ├── app.js
│   ├── middleware/
│   ├── routes/
│   │   ├── auth.js
│   │   ├── panel.js
│   │   ├── admin.js
│   │   ├── adminApi.js
│   │   └── admin/
│   ├── services/
│   └── utils/
├── node-agent/
├── views/
├── public/
├── data/
├── backups/
├── test/
└── ecosystem.config.js
```

## 相关文档

- 对外介绍版：[`README-PUBLIC.md`](./README-PUBLIC.md)
- API 参考：[`README-API.md`](./README-API.md)
- 管理后台说明：[`ADMIN-GUIDE.md`](./ADMIN-GUIDE.md)
- 时间展示规范：[`TIME-DISPLAY-CONVENTION.md`](./TIME-DISPLAY-CONVENTION.md)
- 变更记录：[`CHANGELOG.md`](./CHANGELOG.md)

## License

MIT
