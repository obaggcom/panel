function normalizeIp(ip) {
  const raw = String(ip || '').trim();
  if (!raw) return '';
  if (raw.startsWith('::ffff:')) return raw.slice(7);
  return raw;
}

function getClientIp(req) {
  return normalizeIp(req.ip || req.connection?.remoteAddress || '');
}

function parseIpAllowlist(raw) {
  if (!raw) return [];
  return String(raw)
    .split(',')
    .map(v => normalizeIp(v))
    .filter(Boolean);
}

function isIpAllowed(ip, allowlist) {
  const normalized = normalizeIp(ip);
  if (!normalized) return false;
  if (!Array.isArray(allowlist) || allowlist.length === 0) return true;
  return allowlist.includes(normalized);
}

module.exports = {
  getClientIp,
  normalizeIp,
  parseIpAllowlist,
  isIpAllowed,
};
