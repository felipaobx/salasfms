const FALLBACK_ROOMS = Array.from({ length: 13 }, (_, index) => ({
  id: index + 1,
  name: `Sala ${index + 1}`,
  capacity: index < 4 ? 40 : index < 9 ? 30 : 25,
  status: 'active',
}));
const ROOMS = Array.isArray(window.ENSALAMENTO_ROOMS) && window.ENSALAMENTO_ROOMS.length ? window.ENSALAMENTO_ROOMS : FALLBACK_ROOMS;
const INSTITUTIONAL_RESERVATIONS = Array.isArray(window.ENSALAMENTO_RESERVATIONS) ? window.ENSALAMENTO_RESERVATIONS : [];

const TIMES = Array.from({ length: 9 }, (_, index) => `${String(index + 8).padStart(2, '0')}:00`);
const RESERVATIONS_KEY = 'gestao-salas-reservas-v3';

const state = {
  rooms: ROOMS,
  userReservations: loadLocalReservations(),
  selectedDate: toDateInput(new Date()),
  availabilityShift: 'all',
  availabilityQuery: '',
};

const elements = {
  studentForm: document.getElementById('studentForm'),
  studentName: document.getElementById('studentName'),
  studentRa: document.getElementById('studentRa'),
  studentEmail: document.getElementById('studentEmail'),
  studentDate: document.getElementById('studentDate'),
  studentRoomId: document.getElementById('studentRoomId'),
  studentTime: document.getElementById('studentTime'),
  studentDuration: document.getElementById('studentDuration'),
  studentRoomChoice: document.getElementById('studentRoomChoice'),
  studentRoomHelp: document.getElementById('studentRoomHelp'),
  durationControl: document.getElementById('durationControl'),
  durationHelp: document.getElementById('durationHelp'),
  studentRules: document.getElementById('studentRules'),
  studentError: document.getElementById('studentError'),
  studentRoomPicker: document.getElementById('studentRoomPicker'),
  submitButton: document.getElementById('submitButton'),
  availabilityDialog: document.getElementById('availabilityDialog'),
  availabilityBody: document.getElementById('availabilityBody'),
  closeAvailability: document.getElementById('closeAvailability'),
  availabilitySearch: document.getElementById('availabilitySearch'),
  availabilityDateInfo: document.getElementById('availabilityDateInfo'),
  availabilityStatsInfo: document.getElementById('availabilityStatsInfo'),
  toast: document.getElementById('toast'),
};

function loadLocalReservations() {
  try {
    const saved = JSON.parse(localStorage.getItem(RESERVATIONS_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function persistLocalReservations(data) {
  try {
    localStorage.setItem(RESERVATIONS_KEY, JSON.stringify(data));
  } catch {}
}

async function syncReservationsFromServer() {
  try {
    const res = await fetch('/api/reservations');
    if (res.ok) {
      const json = await res.json();
      if (json.ok && Array.isArray(json.data)) {
        state.userReservations = json.data;
        persistLocalReservations(state.userReservations);
      }
    }
  } catch (err) {
    console.warn('Backend sync offline, using local storage cache.');
  }
}

function toDateInput(date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function formatDate(dateString, options = { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) {
  return new Intl.DateTimeFormat('pt-BR', options).format(new Date(`${dateString}T12:00:00`));
}

function timeInMinutes(time) {
  const [hours, minutes] = String(time || '00:00').split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function addMinutesToTime(time, minutesToAdd) {
  const [h, m] = String(time || '08:00').split(':').map(Number);
  const totalMin = (h || 0) * 60 + (m || 0) + Number(minutesToAdd);
  const clampedMin = Math.min(23 * 60 + 59, Math.max(0, totalMin));
  const newH = String(Math.floor(clampedMin / 60)).padStart(2, '0');
  const newM = String(clampedMin % 60).padStart(2, '0');
  return `${newH}:${newM}`;
}

function nextHour(time) {
  return addMinutesToTime(time, 60);
}

function addHours(time, hours) {
  return addMinutesToTime(time, Number(hours) * 60);
}

function roomById(id) {
  return state.rooms.find(room => room.id === Number(id));
}

function allReservations() {
  return [...INSTITUTIONAL_RESERVATIONS, ...state.userReservations];
}

function roomReservations(roomId, date = state.selectedDate) {
  return allReservations().filter(item => item.roomId === Number(roomId) && item.date === date);
}

function isWeekday(dateString) {
  const day = new Date(`${dateString}T12:00:00`).getDay();
  return day >= 1 && day <= 5;
}

function reservationHours(reservation) {
  return Math.max(0, (timeInMinutes(reservation.end) - timeInMinutes(reservation.start)) / 60);
}

function reservationOverlapsSlot(reservation, slotStart) {
  const slotStartMin = timeInMinutes(slotStart);
  const slotEndMin = slotStartMin + 60;
  const resStartMin = timeInMinutes(reservation.start);
  const resEndMin = timeInMinutes(reservation.end);
  return resStartMin < slotEndMin && resEndMin > slotStartMin;
}

function defaultCapacityForRoom(name) {
  const n = String(name || '').toLowerCase();
  if (n.includes('auditório') || n.includes('auditorio')) return 120;
  if (n.includes('anfiteatro')) return 80;
  if (n.includes('metodologia')) return 45;
  if (n.includes('tutoria')) return 16;
  if (n.includes('informática') || n.includes('informatica') || n.includes('lab')) return 35;
  if (n.includes('habilidades') || n.includes('morfofuncional')) return 30;
  return 35;
}

function getRoomCapacity(room) {
  const cap = Number(room?.capacity);
  return cap > 0 ? cap : defaultCapacityForRoom(room?.name);
}

function roomCapacityText(room) {
  return `Capacidade para ${getRoomCapacity(room)} pessoas`;
}

function studentHoursOnRoom(ra, roomId, date) {
  const normalizedRa = String(ra).trim().toLocaleLowerCase('pt-BR');
  if (!normalizedRa) return 0;
  return state.userReservations
    .filter(item => item.roomId === Number(roomId) && item.date === date && String(item.ra).trim().toLocaleLowerCase('pt-BR') === normalizedRa)
    .reduce((total, item) => total + reservationHours(item), 0);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

function roomIcon() {
  return '<svg viewBox="0 0 24 24"><path d="M4 20V7l8-4 8 4v13M9 20v-5h6v5M8 9h1M15 9h1M8 12h1M15 12h1"/></svg>';
}

function showFormError(element, message) {
  element.textContent = message;
  element.hidden = false;
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => elements.toast.classList.remove('show'), 3500);
}

function openAvailabilityDialog() {
  const date = elements.studentDate.value;
  if (!date) return showFormError(elements.studentError, 'Escolha uma data antes de consultar as salas.');
  if (!isWeekday(date)) return showFormError(elements.studentError, 'Escolha uma data entre segunda e sexta-feira.');
  elements.studentError.hidden = true;

  if (elements.availabilitySearch) elements.availabilitySearch.value = '';
  state.availabilityShift = 'all';
  document.querySelectorAll('.avail-filter-pill').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.availShift === 'all');
  });

  renderAvailability();
  elements.availabilityDialog.showModal();
}

function renderAvailability() {
  const date = elements.studentDate.value;
  if (!date) return;
  const studentRa = elements.studentRa.value.trim();
  const query = (elements.availabilitySearch?.value || '').trim().toLocaleLowerCase('pt-BR');
  const shift = state.availabilityShift || 'all';

  const shiftSlots = TIMES.filter(slot => {
    const hour = Number(slot.slice(0, 2));
    if (shift === 'morning') return hour >= 8 && hour < 12;
    if (shift === 'afternoon') return hour >= 12 && hour < 17;
    return true;
  });

  const activeRooms = state.rooms.filter(room => room.status === 'active');
  const filteredRooms = activeRooms.filter(room => !query || room.name.toLocaleLowerCase('pt-BR').includes(query));

  if (elements.availabilityDateInfo) {
    elements.availabilityDateInfo.textContent = formatDate(date, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  }
  if (elements.availabilityStatsInfo) {
    const shiftLabel = shift === 'morning' ? 'Manhã (08h–12h)' : shift === 'afternoon' ? 'Tarde (12h–17h)' : 'Todos os turnos';
    elements.availabilityStatsInfo.textContent = `${filteredRooms.length} sala${filteredRooms.length === 1 ? '' : 's'} · ${shiftLabel}`;
  }

  if (filteredRooms.length === 0) {
    elements.availabilityBody.innerHTML = `
      <div class="avail-search-empty">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
        </div>
        <h3>Nenhuma sala encontrada</h3>
        <p>Não encontramos nenhuma sala correspondente a "<strong>${escapeHtml(query)}</strong>".</p>
        <button type="button" class="secondary-button" id="clearAvailSearch">Limpar busca</button>
      </div>
    `;
    document.getElementById('clearAvailSearch')?.addEventListener('click', () => {
      if (elements.availabilitySearch) elements.availabilitySearch.value = '';
      renderAvailability();
    });
    return;
  }

  elements.availabilityBody.innerHTML = filteredRooms.map(room => {
    const roomBookings = roomReservations(room.id, date);
    const occupied = TIMES.filter(slot => roomBookings.some(item => reservationOverlapsSlot(item, slot)));
    const usedHours = studentHoursOnRoom(studentRa, room.id, date);
    const allFreeSlots = usedHours >= 2 ? [] : TIMES.filter(time => !occupied.includes(time));
    const freeInShift = usedHours >= 2 ? [] : shiftSlots.filter(time => !occupied.includes(time));

    const totalSlotsCount = shiftSlots.length;
    const freeSlotsCount = freeInShift.length;
    const percentFree = totalSlotsCount > 0 ? Math.round((freeSlotsCount / totalSlotsCount) * 100) : 0;
    const capacityVal = getRoomCapacity(room);

    let emptyMessage = 'Sem horários livres neste turno.';
    if (usedHours >= 2) {
      emptyMessage = 'Limite diário de 2h atingido para esta sala.';
    } else if (allFreeSlots.length > 0 && freeInShift.length === 0) {
      emptyMessage = 'Não há horários disponíveis no turno selecionado. Experimente outro turno.';
    }

    const slotsHtml = freeInShift.length ? `
      <div class="avail-slots-grid">
        ${freeInShift.map(time => {
          const followingSlot = nextHour(time);
          const canReserveTwo = usedHours === 0 && TIMES.includes(followingSlot) && !occupied.includes(followingSlot);
          const endTime = nextHour(time);
          return `
            <button class="avail-slot-btn" type="button" data-student-room="${room.id}" data-student-time="${time}" data-can-two="${canReserveTwo}" aria-label="Reservar ${escapeHtml(room.name)} às ${time}">
              <div class="slot-btn-top">
                <span class="slot-btn-time">
                  <svg viewBox="0 0 24 24"><path d="M12 8v4l2.5 2.5M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"/></svg>
                  ${time} às ${endTime}
                </span>
                ${canReserveTwo ? '<span class="slot-btn-tag">Até 2h</span>' : '<span class="slot-btn-tag" style="background:#e0f2fe;color:#0369a1;">1h</span>'}
              </div>
              <div class="slot-btn-sub">
                <span>Disponível</span>
                <span class="slot-btn-action">Reservar →</span>
              </div>
            </button>
          `;
        }).join('')}
      </div>
    ` : `
      <div class="avail-empty-room">
        <svg viewBox="0 0 24 24" width="16" height="16" style="flex:none;color:#94a3b8;"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
        <span>${escapeHtml(emptyMessage)}</span>
      </div>
    `;

    return `
      <article class="avail-room-card">
        <div class="avail-room-header">
          <div class="avail-room-info-group">
            <span class="avail-room-icon-box">${roomIcon()}</span>
            <div>
              <div class="avail-room-title-line">
                <strong>${escapeHtml(room.name)}</strong>
              </div>
              <div class="avail-room-badges">
                <span class="avail-badge">
                  <svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  Capacidade: ${capacityVal} pessoas
                </span>
                ${studentRa ? `
                  <span class="avail-badge used-hours">
                    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                    ${usedHours}h de 2h utilizadas
                  </span>
                ` : ''}
              </div>
            </div>
          </div>
          <span class="avail-status-tag ${freeInShift.length > 0 ? 'available' : 'empty'}">
            <i class="dot ${freeInShift.length > 0 ? 'green' : 'red'}"></i>
            ${freeInShift.length > 0 ? `${freeInShift.length} horário${freeInShift.length === 1 ? '' : 's'} livre${freeInShift.length === 1 ? '' : 's'}` : 'Indisponível'}
          </span>
        </div>
        <div class="avail-bar-wrap" title="${percentFree}% de horários livres">
          <div class="avail-bar-fill" style="width: ${percentFree}%"></div>
        </div>
        ${slotsHtml}
      </article>
    `;
  }).join('');
}

function chooseStudentSlot(roomId, time, canReserveTwo) {
  elements.studentRoomId.value = roomId;
  elements.studentTime.value = time;
  elements.studentDuration.value = '';
  elements.durationControl.hidden = false;

  const twoHourButton = document.querySelector('[data-duration="2"]');
  twoHourButton.disabled = !canReserveTwo;
  document.querySelectorAll('[data-duration]').forEach(button => button.classList.remove('active'));

  const room = roomById(roomId);
  elements.studentRoomChoice.textContent = `${room.name} · a partir das ${time}`;
  elements.studentRoomHelp.textContent = 'Selecione obrigatoriamente a duração da reserva abaixo:';
  elements.durationHelp.textContent = canReserveTwo ? 'Escolha 1 ou 2 horas.' : 'Somente 1 hora está disponível a partir deste horário.';
  elements.availabilityDialog.close();
}

function updateStudentDuration(duration) {
  const room = roomById(elements.studentRoomId.value);
  const time = elements.studentTime.value;
  if (!room || !time) return;

  elements.studentDuration.value = String(duration);
  document.querySelectorAll('[data-duration]').forEach(button => button.classList.toggle('active', Number(button.dataset.duration) === Number(duration)));
  elements.studentRoomChoice.textContent = `${room.name} · ${time} às ${addHours(time, duration)}`;
  elements.studentRoomHelp.textContent = `${formatDate(elements.studentDate.value, { day: '2-digit', month: 'long', year: 'numeric' })} · ${duration} hora${Number(duration) === 1 ? '' : 's'} · ${roomCapacityText(room).toLocaleLowerCase('pt-BR')}`;
}

async function saveStudentReservation(event) {
  event.preventDefault();
  const duration = Number(elements.studentDuration.value);
  if (![1, 2].includes(duration)) {
    return showFormError(elements.studentError, 'Escolha a duração da reserva: 1 hora ou 2 horas.');
  }

  const roomId = Number(elements.studentRoomId.value);
  const date = elements.studentDate.value;
  const start = elements.studentTime.value;
  const end = start ? addHours(start, duration) : '';
  const name = elements.studentName.value.trim();
  const ra = elements.studentRa.value.trim();
  const email = elements.studentEmail.value.trim();

  if (!roomId || !start || !end) {
    return showFormError(elements.studentError, 'Escolha uma sala e horário disponíveis.');
  }
  if (!name || !ra) {
    return showFormError(elements.studentError, 'Preencha seu nome completo e RA.');
  }
  if (!elements.studentRules.checked) {
    return showFormError(elements.studentError, 'Confirme que você leu e concorda com as regras.');
  }

  elements.studentError.hidden = true;
  elements.submitButton.disabled = true;
  elements.submitButton.textContent = 'Confirmando reserva...';

  const reservationData = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    roomId,
    date,
    start,
    end,
    name,
    ra,
    email,
    origin: 'student'
  };

  try {
    const res = await fetch('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reservationData)
    });

    const json = await res.json();
    if (!res.ok || !json.ok) {
      elements.submitButton.disabled = false;
      elements.submitButton.textContent = 'Confirmar reserva';
      return showFormError(elements.studentError, json.error || 'Não foi possível confirmar a reserva.');
    }

    const saved = json.data || reservationData;
    state.userReservations.push(saved);
    persistLocalReservations(state.userReservations);

    const room = roomById(roomId);
    showToast(`✅ Reserva confirmada! ${room?.name} agendada para ${start} às ${end}.`);

    elements.studentForm.reset();
    elements.studentDate.value = state.selectedDate;
    resetStudentChoice();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    console.error('Reservation submission error:', err);
    state.userReservations.push(reservationData);
    persistLocalReservations(state.userReservations);
    showToast('Reserva registrada localmente.');
    elements.studentForm.reset();
    elements.studentDate.value = state.selectedDate;
    resetStudentChoice();
  } finally {
    elements.submitButton.disabled = false;
    elements.submitButton.textContent = 'Confirmar reserva';
  }
}

function resetStudentChoice() {
  elements.studentRoomId.value = '';
  elements.studentTime.value = '';
  elements.studentDuration.value = '';
  elements.durationControl.hidden = true;
  document.querySelectorAll('[data-duration]').forEach(button => button.classList.remove('active'));
  elements.studentRoomChoice.textContent = 'Escolher sala e horário';
  elements.studentRoomHelp.textContent = 'Veja apenas os horários disponíveis';
}

function bindEvents() {
  elements.studentRoomPicker.addEventListener('click', openAvailabilityDialog);
  elements.studentDate.addEventListener('change', resetStudentChoice);
  elements.closeAvailability.addEventListener('click', () => elements.availabilityDialog.close());

  elements.availabilitySearch?.addEventListener('input', renderAvailability);
  document.querySelectorAll('[data-avail-shift]').forEach(button => {
    button.addEventListener('click', () => {
      state.availabilityShift = button.dataset.availShift;
      document.querySelectorAll('[data-avail-shift]').forEach(b => b.classList.toggle('active', b === button));
      renderAvailability();
    });
  });

  elements.availabilityBody.addEventListener('click', event => {
    const button = event.target.closest('[data-student-room]');
    if (button) {
      chooseStudentSlot(button.dataset.studentRoom, button.dataset.studentTime, button.dataset.canTwo === 'true');
    }
  });

  document.querySelectorAll('[data-duration]').forEach(button => {
    button.addEventListener('click', () => {
      if (!button.disabled) updateStudentDuration(Number(button.dataset.duration));
    });
  });

  elements.studentForm.addEventListener('submit', saveStudentReservation);
}

async function init() {
  const today = toDateInput(new Date());
  elements.studentDate.min = today;
  elements.studentDate.value = today;
  state.selectedDate = today;

  bindEvents();
  await syncReservationsFromServer();
}

init();
