const express = require('express');
const db = require('../services/database');
const { formatBytes } = require('../services/traffic');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const agentWs = require('../services/agent-ws');

const router = express.Router();
router.use(requireAuth, requireAdmin);

router.get('/', (req, res) => {
  const tgEvents = {};
  ['tg_on_node_down','tg_on_node_blocked','tg_on_rotate','tg_on_abuse','tg_on_traffic','tg_on_register','tg_on_deploy'].forEach(k => {
    tgEvents[k] = db.getSetting(k) === 'true';
  });
  const onlineAgents = new Set(agentWs.getConnectedAgents().map(a => a.nodeId));
  // 每节点在线人数 Map: nodeId → count
  const { getOnlineCache } = require('../services/health');
  const onlineCache = getOnlineCache();
  const nodeOnlineCount = new Map();
  if (onlineCache.full && onlineCache.full.nodes) {
    for (const n of onlineCache.full.nodes) {
      nodeOnlineCount.set(n.nodeId, n.count || 0);
    }
  }

  res.render('admin', {
    users: [],
    nodes: db.getAllNodes(),
    onlineAgents,
    nodeOnlineCount,
    whitelist: db.getWhitelist(),
    logs: { rows: [], total: 0 },
    globalTraffic: db.getGlobalTraffic(),
    todayTraffic: db.getTodayTraffic(),
    usersTraffic: { rows: [], total: 0 },
    formatBytes,
    tgBotToken: db.getSetting('tg_bot_token') || '',
    tgChatId: db.getSetting('tg_chat_id') || '',
    tgEvents,
    announcement: db.getSetting('announcement') || '',
    maxUsers: parseInt(db.getSetting('max_users')) || 0,
    userCount: db.getUserCount(),
    registerWhitelist: db.getRegisterWhitelist(),
    defaultTrafficLimit: parseInt(db.getSetting('default_traffic_limit')) || 0
  });
});

module.exports = router;
