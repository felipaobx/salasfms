const { put, list } = require('@vercel/blob');
const fs = require('fs');
const path = require('path');

const BLOB_PATH = 'database/users.json';
const LOCAL_PATH = path.join(process.cwd(), 'data', 'users.json');

async function readUsers() {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { blobs } = await list({ prefix: BLOB_PATH });
      if (blobs && blobs.length > 0) {
        const response = await fetch(`${blobs[0].url}?t=${Date.now()}`);
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) return data;
        }
      }
      return [];
    } catch (err) {
      console.error('Error reading users from Vercel Blob:', err);
    }
  }

  try {
    if (fs.existsSync(LOCAL_PATH)) {
      const content = fs.readFileSync(LOCAL_PATH, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('Error reading users from local file:', err);
  }

  return [];
}

async function writeUsers(data) {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await put(BLOB_PATH, JSON.stringify(data, null, 2), {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'application/json',
      });
      return true;
    } catch (err) {
      console.error('Error writing users to Vercel Blob:', err);
    }
  }

  try {
    const dir = path.dirname(LOCAL_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LOCAL_PATH, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error writing users to local file:', err);
    return false;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const method = req.method;

  if (method === 'GET') {
    const users = await readUsers();
    return res.status(200).json({ ok: true, data: users });
  }

  if (method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }

    // Support either full list sync or single user
    if (Array.isArray(body)) {
      await writeUsers(body);
      return res.status(200).json({ ok: true, data: body });
    }

    const { id, name, login, ra, password } = body || {};
    if (!name || !login) {
      return res.status(400).json({ ok: false, error: 'Nome e login são obrigatórios.' });
    }

    const users = await readUsers();
    const index = users.findIndex(u => String(u.id) === String(id));

    const userData = {
      id: id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
      name: String(name).trim(),
      login: String(login).trim(),
      ra: String(ra || '').trim(),
      password: String(password || (index >= 0 ? users[index].password : '123456')),
      updatedAt: new Date().toISOString()
    };

    if (index >= 0) users[index] = userData;
    else users.push(userData);

    await writeUsers(users);
    return res.status(200).json({ ok: true, data: userData });
  }

  if (method === 'DELETE') {
    const id = req.query?.id || (typeof req.body === 'object' ? req.body.id : null);
    if (!id) return res.status(400).json({ ok: false, error: 'ID não fornecido.' });

    let users = await readUsers();
    users = users.filter(u => String(u.id) !== String(id));
    await writeUsers(users);

    return res.status(200).json({ ok: true, message: 'Usuário removido.' });
  }

  return res.status(405).json({ ok: false, error: 'Método não permitido.' });
};
