const crypto = require('crypto');

function safeTokenEqual(a, b) {
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  if (aa.length !== bb.length) return false;
  try {
    return crypto.timingSafeEqual(aa, bb);
  } catch {
    return false;
  }
}

function isValidOAuthState(expectedState, incomingState) {
  if (!expectedState || !incomingState) return false;
  return safeTokenEqual(incomingState, expectedState);
}

module.exports = {
  safeTokenEqual,
  isValidOAuthState,
};
