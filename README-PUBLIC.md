# VLESS Panel

VLESS Panel 是一个面向小团队/个人站点的代理节点管理后台，提供用户登录、订阅分发、节点维护、流量统计与运维审计的一体化能力。

## 适用场景

- 多节点统一管理
- 用户分级与访问控制
- 订阅分发与反滥用
- 运维事件追踪与通知
- AWS 实例联动运维

## 核心特性

- NodeLoc OAuth 登录
- VLESS/SS 节点管理
- 自动订阅格式分发（v2ray/clash/sing-box）
- IPv6 SS 订阅支持
- 节点 Agent 在线管理与远程指令
- 流量统计、配额与排行
- 审计日志、运营日记、订阅统计
- Telegram 通知
- 数据库备份与恢复

## 安全能力

- OAuth state 校验
- CSRF 防护
- 订阅/登录/管理 API 限流
- 订阅反滥用策略（UA + 行为）
- 可信反代边界控制
- 会话持久化

## 技术栈

- Node.js + Express
- SQLite (better-sqlite3)
- EJS + Tailwind CSS
- WebSocket (Agent)
- AWS SDK v3

## 快速开始

```bash
git clone <repo-url> /root/vless-panel
cd /root/vless-panel
npm install
cp .env.example .env
npm start
```

生产部署建议使用 PM2 + Nginx：

```bash
pm2 start ecosystem.config.js
pm2 logs vless-panel
```

## 文档

- 完整运维说明：[`README.md`](./README.md)
- 管理后台说明：[`ADMIN-GUIDE.md`](./ADMIN-GUIDE.md)
- API 参考：[`README-API.md`](./README-API.md)
- 时间规范：[`TIME-DISPLAY-CONVENTION.md`](./TIME-DISPLAY-CONVENTION.md)

## License

MIT
