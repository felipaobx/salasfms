const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const TIME_PATTERN = /(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/;
const TARGET_ROOMS = [
  'TUTORIA 1',
  'TUTORIA 2',
  'TUTORIA 3',
  'TUTORIA 4',
  'TUTORIA 5',
  'TUTORIA 6',
  'TUTORIA 7',
  'TUTORIA 8',
  'TUTORIA 9',
  'TUTORIA 10',
  'TUTORIA 11',
  'TUTORIA 12',
  'TUTORIA 13',
  'TUTORIA 14',
  'ACOLHIMENTO',
  'BIBLIOTECA',
  'REPOUSO ALUNOS'
];

function cleanRoomName(value) {
  const name = String(value || '').replace(/\s+/g, ' ').trim().toUpperCase();
  const replacements = {
    'AUTIDÓRIO': 'AUDITÓRIO',
    'SALA METODOLO ATIVA 5': 'SALA METODOLOGIA ATIVA 5',
    'SALA METODOLO ATIVA 6': 'SALA METODOLOGIA ATIVA 6',
  };
  return replacements[name] || name;
}

function displayRoomInfo(name, id) {
  const fixed = {
    'ACOLHIMENTO': { name: 'Acolhimento', capacity: 20 },
    'REPOUSO ALUNOS': { name: 'Repouso dos Alunos', capacity: 20 },
    'BIBLIOTECA': { name: 'Biblioteca', capacity: 50 },
  };
  if (fixed[name]) {
    return { id, name: fixed[name].name, capacity: fixed[name].capacity, status: 'active' };
  }
  if (name.startsWith('TUTORIA ')) {
    return { id, name: 'Tutoria ' + name.split(' ').slice(1).join(' '), capacity: 16, status: 'active' };
  }
  return { id, name, capacity: 16, status: 'active' };
}

function cleanEvent(value) {
  let text = String(value || '').replace(/\s+/g, ' ').trim();
  text = text.replace(/(\d)º/g, '$1º');
  return text;
}

function formatIso(d) {
  if (d instanceof Date) {
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(d || '').trim();
}

function build(sourcePath, outputPath) {
  const resolvedSource = path.resolve(sourcePath);
  const resolvedOutput = path.resolve(outputPath);

  const workbook = XLSX.readFile(resolvedSource, { cellDates: true });

  const roomIds = {};
  TARGET_ROOMS.forEach((name, idx) => {
    roomIds[name] = idx + 1;
  });

  const rooms = TARGET_ROOMS.map(name => displayRoomInfo(name, roomIds[name]));
  const events = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    const headerRows = [];
    data.forEach((row, r) => {
      if (row && row[1] && String(row[1]).toUpperCase().includes('PER') && row[2]) {
        headerRows.push(r);
      }
    });

    headerRows.forEach((headerRow, hIdx) => {
      const nextHeader = hIdx + 1 < headerRows.length ? headerRows[hIdx + 1] : data.length;

      let bookingDate = null;
      for (let r = headerRow; r < nextHeader; r++) {
        const cellVal = data[r] && data[r][0];
        if (cellVal instanceof Date) {
          bookingDate = formatIso(cellVal);
          break;
        }
      }
      if (!bookingDate) return;

      const rowHeader = data[headerRow];
      for (let col = 2; col < rowHeader.length; col++) {
        const roomKey = cleanRoomName(rowHeader[col]);
        if (!roomIds[roomKey]) continue;

        const dailyEvents = [];
        for (let r = headerRow + 1; r < nextHeader; r++) {
          const timeVal = data[r] && data[r][1];
          const match = String(timeVal || '').match(TIME_PATTERN);
          const eventVal = data[r] && data[r][col];
          if (!match || !eventVal) continue;
          const desc = cleanEvent(eventVal);
          if (!desc || desc.toUpperCase().includes('INTERVALO') || desc.toUpperCase().includes('ALMOÇO')) continue;
          const [_, start, end] = match;
          if (dailyEvents.length && dailyEvents[dailyEvents.length - 1].end === start && dailyEvents[dailyEvents.length - 1].name === desc) {
            dailyEvents[dailyEvents.length - 1].end = end;
          } else {
            dailyEvents.push({ start, end, name: desc });
          }
        }

        dailyEvents.forEach(item => {
          events.push({
            roomId: roomIds[roomKey],
            date: bookingDate,
            start: item.start,
            end: item.end,
            name: item.name,
            ra: '',
            email: '',
            origin: 'institutional',
            source: sheetName,
          });
        });
      }
    });
  }

  events.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.start !== b.start) return a.start.localeCompare(b.start);
    if (a.roomId !== b.roomId) return a.roomId - b.roomId;
    return a.name.localeCompare(b.name);
  });

  events.forEach((ev, idx) => {
    ev.id = 'ensalamento-' + String(idx + 1).padStart(5, '0');
  });

  const payload = (
    '// Gerado a partir do arquivo de ensalamento 2026.\n' +
    `window.ENSALAMENTO_ROOMS = ${JSON.stringify(rooms, null, 0)};\n` +
    `window.ENSALAMENTO_RESERVATIONS = ${JSON.stringify(events, null, 0)};\n`
  );

  fs.writeFileSync(resolvedOutput, payload, 'utf-8');

  // Also write to dist/ensalamento-data.js if dist exists
  const distOutput = path.resolve('dist', path.basename(outputPath));
  if (fs.existsSync(path.dirname(distOutput))) {
    fs.writeFileSync(distOutput, payload, 'utf-8');
  }

  const result = {
    rooms: rooms.length,
    reservations: events.length,
    first_date: events[0] ? events[0].date : null,
    last_date: events[events.length - 1] ? events[events.length - 1].date : null,
    by_sheet: workbook.SheetNames.reduce((acc, sheet) => {
      acc[sheet] = events.filter(ev => ev.source === sheet).length;
      return acc;
    }, {})
  };

  console.log(JSON.stringify(result, null, 2));
  return result;
}

const sourceFile = process.argv[2] || path.join(__dirname, 'data', 'ensalamento-2026.xlsx');
const targetFile = process.argv[3] || path.join(__dirname, 'ensalamento-data.js');

build(sourceFile, targetFile);
