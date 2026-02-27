const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeIp, parseIpAllowlist, isIpAllowed } = require('../src/utils/clientIp');

test('normalizeIp strips IPv4-mapped IPv6 prefix', () => {
  assert.equal(normalizeIp('::ffff:203.0.113.7'), '203.0.113.7');
});

test('parseIpAllowlist parses comma separated list', () => {
  const list = parseIpAllowlist(' 127.0.0.1, ::ffff:10.0.0.2 , 2001:db8::1 ');
  assert.deepEqual(list, ['127.0.0.1', '10.0.0.2', '2001:db8::1']);
});

test('isIpAllowed handles empty and explicit allowlist', () => {
  assert.equal(isIpAllowed('203.0.113.8', []), true);
  assert.equal(isIpAllowed('203.0.113.8', ['203.0.113.8']), true);
  assert.equal(isIpAllowed('203.0.113.8', ['198.51.100.9']), false);
});
