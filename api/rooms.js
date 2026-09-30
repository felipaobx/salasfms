const { put, list } = require('@vercel/blob');
const fs = require('fs');
const path = require('path');
const { requireAuth } = require('./_auth');

const BLOB_PATH = 'database/rooms.json';
const LOCAL_PATH = path.join(process.cwd(), 'data', 'rooms.json');
const DEFAULT_ROOMS = [
  ...Array.from({ length: 14 }, (_, index) => ({ id: index + 1, name: `Tutoria ${index + 1}`, capacity: 16, status: 'active' })),
  { id: 15, name: 'Acolhimento', capacity: 20, status: 'active' },
  { id: 16, name: 'Biblioteca', capacity: 50, status: 'active' },
  { id: 17, name: 'Repouso dos Alunos', capacity: 20, status: 'active' },
];

function normalizeRooms(input) {
  if (!Array.isArray(input)) return null;
  const rooms = input.map((room, index) => ({
    id: Number(room?.id) || index + 1,
    name: String(room?.name || '').trim(),
    capacity: Math.max(1, Math.min(500, Number(room?.capacity) || 1)),
    status: room?.status === 'blocked' ? 'blocked' : 'active',
  }));
  if (!rooms.length || rooms.some(room => !room.name)) return null;
  if (new Set(rooms.map(room => room.id)).size !== rooms.length) return null;
  return rooms;
}

async function readRooms() {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { blobs } = await list({ prefix: BLOB_PATH });
      const blob = blobs?.find(item => item.pathname === BLOB_PATH) || blobs?.[0];
      if (blob) {
        const response = await fetch(`${blob.url}?t=${Date.now()}`);
        if (response.ok) {
          const rooms = normalizeRooms(await response.json());
          if (rooms) return { rooms, configured: true };
        }
      }
    } catch (error) { console.error('Error reading rooms:', error); }
  }
  try {
    if (fs.existsSync(LOCAL_PATH)) {
      const rooms = normalizeRooms(JSON.parse(fs.readFileSync(LOCAL_PATH, 'utf8')));
      if (rooms) return { rooms, configured: true };
    }
  } catch (error) { console.error('Error reading local rooms:', error); }
  return { rooms: DEFAULT_ROOMS, configured: false };
}

async function writeRooms(rooms) {
  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      await put(BLOB_PATH, JSON.stringify(rooms, null, 2), { access: 'public', addRandomSuffix: false, contentType: 'application/json' });
      return true;
    }
    const directory = path.dirname(LOCAL_PATH);
    if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(LOCAL_PATH, JSON.stringify(rooms, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing rooms:', error);
    return false;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') {
    const result = await readRooms();
    return res.status(200).json({ ok: true, data: result.rooms, configured: result.configured });
  }
  if (req.method !== 'PUT') return res.status(405).json({ ok: false, error: 'Método não permitido.' });
  if (!requireAuth(req, res)) return;
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  const rooms = normalizeRooms(Array.isArray(body) ? body : body?.rooms);
  if (!rooms) return res.status(400).json({ ok: false, error: 'Lista de salas inválida.' });
  if (!await writeRooms(rooms)) return res.status(500).json({ ok: false, error: 'Não foi possível salvar as salas no banco online.' });
  return res.status(200).json({ ok: true, data: rooms, configured: true });
};
