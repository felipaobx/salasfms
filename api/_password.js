const crypto = require('node:crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, storedValue) {
  const stored = String(storedValue || '');
  if (!stored.startsWith('scrypt$')) {
    const supplied = Buffer.from(String(password));
    const expected = Buffer.from(stored);
    return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
  }
  const [, salt, expectedHex] = stored.split('$');
  if (!salt || !expectedHex) return false;
  const supplied = crypto.scryptSync(String(password), salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}

module.exports = { hashPassword, verifyPassword };
