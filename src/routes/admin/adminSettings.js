const express = require('express');
const db = require('../../services/database');
const { notify } = require('../../services/notify');
const { parseIntId } = require('../adminApi');

const router = express.Router();

// 日志
router.get('/logs', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const type = req.query.type || 'all';
  const limit = 50;
  const offset = (page - 1) * limit;
  res.json(db.getAuditLogs(limit, offset, type));
});

router.post('/logs/clear', (req, res) => {
  db.clearAuditLogs();
  db.addAuditLog(req.user.id, 'logs_clear', '清空日志', req.ip);
  res.json({ ok: true });
});

// 通知
router.post('/notify/config', (req, res) => {
  const { token, chatId } = req.body;
  if (token) db.setSetting('tg_bot_token', token);
  if (chatId) db.setSetting('tg_chat_id', chatId);
  res.json({ ok: true });
});

router.post('/notify/test', async (req, res) => {
  try {
    const { send } = require('../../services/notify');
    await send('🔔 测试通知 - 来自小姨子の后台');
    res.json({ ok: true });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

router.post('/notify/event', (req, res) => {
  const { key, enabled } = req.body;
  if (key && key.startsWith('tg_on_')) {
    db.setSetting(key, enabled ? 'true' : 'false');
  }
  res.json({ ok: true });
});

// 公告 & 限制
router.post('/announcement', (req, res) => {
  db.setSetting('announcement', req.body.text || '');
  res.json({ ok: true });
});

router.post('/max-users', (req, res) => {
  db.setSetting('max_users', String(parseInt(req.body.max) || 0));
  res.json({ ok: true });
});

// 订阅访问
router.get('/sub-access/:userId', (req, res) => {
  const userId = parseIntId(req.params.userId);
  if (!userId) return res.status(400).json({ error: '参数错误' });
  const hours = parseInt(req.query.hours) || 24;
  res.json(db.getSubAccessIPs(userId, hours));
});

// 订阅统计
router.get('/sub-stats', (req, res) => {
  const hours = parseInt(req.query.hours) || 24;
  const page = parseInt(req.query.page) || 1;
  const sort = req.query.sort || 'count';
  const onlyHigh = req.query.high === '1';
  const limit = 20;
  const offset = (page - 1) * limit;
  const data = db.getSubAccessStats(hours, limit, offset, onlyHigh, sort);
  res.json({ ...data, page, limit });
});

router.get('/sub-stats/:userId/detail', (req, res) => {
  const userId = parseIntId(req.params.userId);
  if (!userId) return res.status(400).json({ error: '参数错误' });
  const hours = parseInt(req.query.hours) || 24;
  res.json(db.getSubAccessUserDetail(userId, hours));
});

// AI 运营日记
router.get('/diary', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 20;
  const offset = (page - 1) * limit;
  const data = db.getDiaryEntries(limit, offset);
  const stats = db.getDiaryStats();
  res.json({ ...data, page, stats });
});

// AI 运维配置
router.get('/ops-config', (req, res) => {
  const keys = ['ops_target_nodes', 'ops_patrol_interval', 'ops_max_daily_swaps', 'ops_max_daily_creates',
    'ops_auto_swap_ip', 'ops_auto_repair', 'ops_auto_scale', 'ops_panel_guard'];
  const cfg = {};
  for (const k of keys) cfg[k] = db.getSetting(k) || '';
  res.json(cfg);
});

router.post('/ops-config', (req, res) => {
  const allowed = ['ops_target_nodes', 'ops_patrol_interval', 'ops_max_daily_swaps', 'ops_max_daily_creates',
    'ops_auto_swap_ip', 'ops_auto_repair', 'ops_auto_scale', 'ops_panel_guard'];
  for (const [k, v] of Object.entries(req.body)) {
    if (allowed.includes(k)) db.setSetting(k, String(v));
  }
  db.addAuditLog(req.user.id, 'ops_config', '更新 AI 运维配置', req.ip);
  res.json({ ok: true });
});

module.exports = router;
