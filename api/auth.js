const { put, list } = require('@vercel/blob');
const fs = require('fs');
const path = require('path');
const { createSession, readSession, sessionCookie, clearSessionCookie } = require('./_auth');
const { hashPassword, verifyPassword } = require('./_password');

const BLOB_PATH = 'database/users.json';
const LOCAL_PATH = path.join(process.cwd(), 'data', 'users.json');

async function readUsers() {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { blobs } = await list({ prefix: BLOB_PATH });
    const blob = blobs?.find(item => item.pathname === BLOB_PATH) || blobs?.[0];
    if (blob) {
      const response = await fetch(`${blob.url}?t=${Date.now()}`);
      if (response.ok) return response.json();
    }
    return [];
  }
  if (!fs.existsSync(LOCAL_PATH)) return [];
  return JSON.parse(fs.readFileSync(LOCAL_PATH, 'utf8'));
}

async function writeUsers(users) {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    await put(BLOB_PATH, JSON.stringify(users, null, 2), { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
    return;
  }
  const directory = path.dirname(LOCAL_PATH);
  if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(LOCAL_PATH, JSON.stringify(users, null, 2), 'utf8');
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const session = readSession(req);
    return session
      ? res.status(200).json({ ok: true, authenticated: true, user: session })
      : res.status(401).json({ ok: false, authenticated: false });
  }

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', clearSessionCookie(req));
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Método não permitido.' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const login = String(body?.login || '').trim().toLocaleLowerCase('pt-BR');
  const password = String(body?.password || '');
  const users = await readUsers();
  const index = users.findIndex(user => String(user.login || '').trim().toLocaleLowerCase('pt-BR') === login);
  const user = index >= 0 ? users[index] : null;
  if (!user || !verifyPassword(password, user.password)) {
    return res.status(401).json({ ok: false, error: 'Usuário ou senha incorretos.' });
  }

  if (!String(user.password).startsWith('scrypt$')) {
    users[index] = { ...user, password: hashPassword(password), updatedAt: new Date().toISOString() };
    await writeUsers(users);
  }

  const token = createSession(user);
  res.setHeader('Set-Cookie', sessionCookie(req, token));
  return res.status(200).json({ ok: true, user: { id: user.id, name: user.name, ra: user.ra || '' } });
};
