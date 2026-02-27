const HOST_RE = /^[a-zA-Z0-9._-]{1,253}$/;

function parseIntId(raw) {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function isValidHost(host) {
  return typeof host === 'string' && HOST_RE.test(host.trim());
}

module.exports = {
  parseIntId,
  isValidHost,
};
