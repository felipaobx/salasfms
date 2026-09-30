const crypto = require('node:crypto');

const COOKIE_NAME = 'salasfms_session';
const MAX_AGE_SECONDS = 8 * 60 * 60;

function signingSecret() {
  return process.env.SESSION_SECRET || process.env.BLOB_READ_WRITE_TOKEN || (process.env.VERCEL ? '' : 'salasfms-local-development');
}

function parseCookies(header = '') {
  return Object.fromEntries(String(header).split(';').map(part => {
    const separator = part.indexOf('=');
    if (separator < 0) return ['', ''];
    return [part.slice(0, separator).trim(), decodeURIComponent(part.slice(separator + 1).trim())];
  }).filter(([key]) => key));
}

function signature(value) {
  return crypto.createHmac('sha256', signingSecret()).update(value).digest('base64url');
}

function createSession(user) {
  if (!signingSecret()) throw new Error('SESSION_SECRET não configurado.');
  const payload = Buffer.from(JSON.stringify({
    id: String(user.id),
    name: String(user.name),
    ra: String(user.ra || ''),
    exp: Date.now() + MAX_AGE_SECONDS * 1000,
  })).toString('base64url');
  return `${payload}.${signature(payload)}`;
}

function readSession(req) {
  const token = parseCookies(req.headers?.cookie)[COOKIE_NAME];
  const secret = signingSecret();
  if (!token || !secret) return null;
  const [payload, suppliedSignature] = token.split('.');
  if (!payload || !suppliedSignature) return null;
  const expectedSignature = signature(payload);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number(session.exp) > Date.now() ? session : null;
  } catch {
    return null;
  }
}

function sessionCookie(req, token) {
  const forwardedProtocol = String(req.headers?.['x-forwarded-proto'] || '').split(',')[0].trim();
  const secure = forwardedProtocol === 'https' || Boolean(process.env.VERCEL);
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${MAX_AGE_SECONDS}${secure ? '; Secure' : ''}`;
}

function clearSessionCookie(req) {
  const forwardedProtocol = String(req.headers?.['x-forwarded-proto'] || '').split(',')[0].trim();
  const secure = forwardedProtocol === 'https' || Boolean(process.env.VERCEL);
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`;
}

function requireAuth(req, res) {
  const session = readSession(req);
  if (session) return session;
  res.status(401).json({ ok: false, error: 'Sessão administrativa necessária.' });
  return null;
}

module.exports = { createSession, readSession, sessionCookie, clearSessionCookie, requireAuth };
