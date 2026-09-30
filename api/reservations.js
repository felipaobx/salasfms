const { put, list } = require('@vercel/blob');
const fs = require('fs');
const path = require('path');
const { readSession, requireAuth } = require('./_auth');

const BLOB_PATH = 'database/reservations.json';
const LOCAL_PATH = path.join(process.cwd(), 'data', 'reservations.json');

async function readFromStorage() {
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
      console.error('Error reading from Vercel Blob:', err);
    }
  }

  try {
    if (fs.existsSync(LOCAL_PATH)) {
      const content = fs.readFileSync(LOCAL_PATH, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('Error reading from local file:', err);
  }

  return [];
}

async function writeToStorage(data) {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await put(BLOB_PATH, JSON.stringify(data, null, 2), {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'application/json',
      });
      return true;
    } catch (err) {
      console.error('Error writing to Vercel Blob:', err);
    }
  }

  try {
    const dir = path.dirname(LOCAL_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LOCAL_PATH, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error writing to local file:', err);
    return false;
  }
}

function timeInMinutes(time) {
  const [h, m] = String(time || '00:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function overlaps(startA, endA, startB, endB) {
  return timeInMinutes(startA) < timeInMinutes(endB) && timeInMinutes(endA) > timeInMinutes(startB);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const method = req.method;

  if (method === 'GET') {
    const data = await readFromStorage();
    if (req.query?.admin === '1') {
      if (!requireAuth(req, res)) return;
      return res.status(200).json({ ok: true, data });
    }
    const publicData = data.map(({ id, roomId, date, start, end, origin }) => ({ id, roomId, date, start, end, origin }));
    return res.status(200).json({ ok: true, data: publicData });
  }

  if (method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }

    const session = readSession(req);
    const { roomId, date, start, end, name, ra, email } = body || {};
    const origin = session && body?.origin === 'admin' ? 'admin' : 'student';

    if (!roomId || !date || !start || !end || !name || !ra) {
      return res.status(400).json({ ok: false, error: 'Campos obrigatórios não preenchidos.' });
    }

    const startMin = timeInMinutes(start);
    const endMin = timeInMinutes(end);
    if (endMin <= startMin) {
      return res.status(400).json({ ok: false, error: 'Horário de término deve ser após o horário de início.' });
    }

    const reservations = await readFromStorage();

    const requestedHours = (endMin - startMin) / 60;
    const usedHours = reservations
      .filter(item => item.roomId === Number(roomId) && item.date === date && String(item.ra || '').trim().toLocaleLowerCase('pt-BR') === String(ra).trim().toLocaleLowerCase('pt-BR'))
      .reduce((total, item) => total + Math.max(0, (timeInMinutes(item.end) - timeInMinutes(item.start)) / 60), 0);
    if (origin === 'student' && usedHours + requestedHours > 2) {
      return res.status(409).json({ ok: false, error: 'Limite diário de 2 horas atingido para esta sala.' });
    }

    const conflict = reservations.find(item =>
      item.roomId === Number(roomId) &&
      item.date === date &&
      overlaps(item.start, item.end, start, end)
    );

    if (conflict) {
      return res.status(409).json({ ok: false, error: `Horário indisponível: coincide com reserva existente das ${conflict.start} às ${conflict.end}.` });
    }

    const newReservation = {
      id: body.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
      roomId: Number(roomId),
      date,
      start,
      end,
      name: String(name).trim(),
      ra: String(ra).trim(),
      email: String(email || '').trim(),
      origin,
      createdAt: new Date().toISOString()
    };

    reservations.push(newReservation);
    if (!await writeToStorage(reservations)) return res.status(500).json({ ok: false, error: 'Não foi possível salvar a reserva no banco online.' });

    return res.status(201).json({ ok: true, data: newReservation });
  }

  if (method === 'DELETE') {
    if (!requireAuth(req, res)) return;
    const id = req.query?.id || (typeof req.body === 'object' ? req.body.id : null);
    if (!id) {
      return res.status(400).json({ ok: false, error: 'ID da reserva não informado.' });
    }

    let reservations = await readFromStorage();
    const initialLen = reservations.length;
    reservations = reservations.filter(item => String(item.id) !== String(id));

    if (reservations.length === initialLen) {
      return res.status(404).json({ ok: false, error: 'Reserva não encontrada.' });
    }

    if (!await writeToStorage(reservations)) return res.status(500).json({ ok: false, error: 'Não foi possível cancelar a reserva no banco online.' });
    return res.status(200).json({ ok: true, message: 'Reserva cancelada com sucesso.' });
  }

  if (method === 'PUT') {
    if (!requireAuth(req, res)) return;
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }

    const { id, roomId, date, start, end, name, ra, email } = body || {};
    if (!id) return res.status(400).json({ ok: false, error: 'ID da reserva não informado.' });

    let reservations = await readFromStorage();
    const index = reservations.findIndex(item => String(item.id) === String(id));
    if (index === -1) {
      return res.status(404).json({ ok: false, error: 'Reserva não encontrada.' });
    }

    const conflict = reservations.find(item =>
      String(item.id) !== String(id) &&
      item.roomId === Number(roomId) &&
      item.date === date &&
      overlaps(item.start, item.end, start, end)
    );

    if (conflict) {
      return res.status(409).json({ ok: false, error: `Horário indisponível: coincide com outra reserva existente das ${conflict.start} às ${conflict.end}.` });
    }

    reservations[index] = {
      ...reservations[index],
      roomId: Number(roomId),
      date,
      start,
      end,
      name: String(name).trim(),
      ra: String(ra).trim(),
      email: String(email || '').trim(),
      updatedAt: new Date().toISOString()
    };

    if (!await writeToStorage(reservations)) return res.status(500).json({ ok: false, error: 'Não foi possível atualizar a reserva no banco online.' });
    return res.status(200).json({ ok: true, data: reservations[index] });
  }

  return res.status(405).json({ ok: false, error: 'Método não permitido.' });
};
