const FALLBACK_ROOMS = Array.from({ length: 13 }, (_, index) => ({
  id: index + 1,
  name: `Sala ${index + 1}`,
  capacity: index < 4 ? 40 : index < 9 ? 30 : 25,
  status: 'active',
}));
const DEFAULT_ROOMS = Array.isArray(window.ENSALAMENTO_ROOMS) && window.ENSALAMENTO_ROOMS.length ? window.ENSALAMENTO_ROOMS : FALLBACK_ROOMS;
const INSTITUTIONAL_RESERVATIONS = Array.isArray(window.ENSALAMENTO_RESERVATIONS) ? window.ENSALAMENTO_RESERVATIONS : [];

const TIMES = Array.from({ length: 9 }, (_, index) => `${String(index + 8).padStart(2, '0')}:00`);
const RESERVATIONS_KEY = 'gestao-salas-reservas-v3';
const LEGACY_RESERVATIONS_KEY = 'gestao-salas-reservas-v1';
const ROOMS_KEY = 'gestao-salas-ambientes-v2';
const USERS_KEY = 'gestao-salas-usuarios-v1';
const AUTH_KEY = 'gestao-salas-admin-auth';

const state = {
  selectedDate: toDateInput(new Date()), selectedRoomId: null,
  rooms: loadRooms(), reservations: loadReservations(), users: loadUsers(), activeView: 'dashboard', roomLayout: 'grid',
  availabilityShift: 'all', availabilityQuery: '',
};

const elements = Object.fromEntries([
  'accessScreen', 'adminApp', 'studentPage', 'loginForm', 'loginUser', 'loginPassword', 'loginError',
  'roomsGrid', 'roomsList', 'selectedDate', 'availableCount', 'occupiedCount', 'todayLabel', 'pageTitle',
  'dashboardView', 'reservationsView', 'roomsView', 'usersView', 'reservationSearch', 'reservationsCards', 'reservationsEmpty',
  'scheduleDrawer', 'drawerBackdrop', 'drawerTitle', 'drawerDate', 'drawerSubtitle', 'timeSlots',
  'reservationDialog', 'reservationForm', 'dialogKicker', 'dialogTitle', 'reservationId', 'reservationRoom',
  'reservationDate', 'reservationStart', 'reservationEnd', 'reservationName', 'reservationRa',
  'reservationEmail', 'formError', 'deleteReservationButton', 'toast', 'sidebar', 'mobileMenu',
  'managementGrid', 'roomDialog', 'roomForm', 'roomDialogKicker', 'roomDialogTitle', 'roomId', 'roomName',
  'roomCapacity', 'roomStatus', 'roomFormError', 'deleteRoomButton', 'studentForm', 'studentName', 'studentRa',
  'studentEmail', 'studentDate', 'studentRoomId', 'studentTime', 'studentDuration', 'studentRoomChoice', 'studentRoomHelp', 'durationControl', 'durationHelp',
  'studentRules', 'studentError', 'studentRoomPicker', 'availabilityDialog', 'availabilityBody', 'newReservationButton',
  'usersGrid', 'usersEmpty', 'userSearch', 'addUserButton', 'userDialog', 'userForm', 'userDialogKicker', 'userDialogTitle',
  'userId', 'userName', 'userLogin', 'userRa', 'userFormError', 'deleteUserButton',
  'slotDetailsDialog', 'slotDetailsKicker', 'slotDetailsTitle', 'slotDetailsBody', 'slotDetailsFooter', 'closeSlotDetails', 'dismissSlotDetails', 'editFromSlotDetails',
  'reservationDurationInfo', 'reservationDurationText',
  'availabilitySearch', 'availabilityDateInfo', 'availabilityStatsInfo',
].map(id => [id, document.getElementById(id)]));

function seedReservations() {
  return [];
}

function loadRooms() {
  try { const saved = JSON.parse(localStorage.getItem(ROOMS_KEY)); return Array.isArray(saved) && saved.length ? saved : DEFAULT_ROOMS; }
  catch { return DEFAULT_ROOMS; }
}

function loadReservations() {
  try {
    const current = JSON.parse(localStorage.getItem(RESERVATIONS_KEY));
    if (Array.isArray(current)) return current;
    const legacy = JSON.parse(localStorage.getItem(LEGACY_RESERVATIONS_KEY));
    if (Array.isArray(legacy)) return legacy.map(item => ({ ...item, origin: item.origin || 'admin' }));
    return seedReservations();
  } catch { return seedReservations(); }
}

function loadUsers() {
  try { const saved = JSON.parse(localStorage.getItem(USERS_KEY)); return Array.isArray(saved) ? saved : []; }
  catch { return []; }
}

function persistRooms() { localStorage.setItem(ROOMS_KEY, JSON.stringify(state.rooms)); }
function persistReservations() { localStorage.setItem(RESERVATIONS_KEY, JSON.stringify(state.reservations)); }
function persistUsers() { localStorage.setItem(USERS_KEY, JSON.stringify(state.users)); }
function toDateInput(date) { const offset = date.getTimezoneOffset(); return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10); }
function formatDate(dateString, options = { weekday: 'long', day: '2-digit', month: 'long' }) { return new Intl.DateTimeFormat('pt-BR', options).format(new Date(`${dateString}T12:00:00`)); }
function formatShortDate(dateString) { return new Intl.DateTimeFormat('pt-BR').format(new Date(`${dateString}T12:00:00`)); }
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
function nextHour(time) { return addMinutesToTime(time, 60); }
function addHours(time, hours) { return addMinutesToTime(time, Number(hours) * 60); }
function formatDurationText(start, end) {
  if (!start || !end) return '';
  const totalMin = timeInMinutes(end) - timeInMinutes(start);
  if (totalMin <= 0) return '';
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}min (${hours} hora${hours > 1 ? 's' : ''} e ${mins} min)`;
  if (hours > 0) return `${hours}h (${hours} hora${hours > 1 ? 's' : ''})`;
  return `${mins} minutos`;
}
function roomById(id) { return state.rooms.find(room => room.id === Number(id)); }
function allReservations() { return [...INSTITUTIONAL_RESERVATIONS, ...state.reservations]; }
function roomReservations(roomId, date = state.selectedDate) { return allReservations().filter(item => item.roomId === Number(roomId) && item.date === date); }
function getNowSlot() { return `${String(new Date().getHours()).padStart(2, '0')}:00`; }
function isWeekday(dateString) { const day = new Date(`${dateString}T12:00:00`).getDay(); return day >= 1 && day <= 5; }
function reservationHours(reservation) { return Math.max(0, (timeInMinutes(reservation.end) - timeInMinutes(reservation.start)) / 60); }
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
function studentHoursOnRoom(ra, roomId, date, excludeId = '') {
  const normalizedRa = String(ra).trim().toLocaleLowerCase('pt-BR');
  if (!normalizedRa) return 0;
  return state.reservations
    .filter(item => item.id !== excludeId && item.roomId === Number(roomId) && item.date === date && String(item.ra).trim().toLocaleLowerCase('pt-BR') === normalizedRa)
    .reduce((total, item) => total + reservationHours(item), 0);
}

function isRoomOccupiedNow(roomId) {
  const room = roomById(roomId);
  if (!room || room.status === 'blocked') return true;
  if (state.selectedDate !== toDateInput(new Date())) return roomReservations(roomId).length > 0;
  const now = new Date();
  const currentMin = now.getHours() * 60 + now.getMinutes();
  return roomReservations(roomId).some(item => {
    const s = timeInMinutes(item.start);
    const e = timeInMinutes(item.end);
    return s <= currentMin && e > currentMin;
  });
}

function renderRooms() {
  const occupiedRooms = state.rooms.filter(room => room.status === 'blocked' || roomReservations(room.id).length > 0).length;
  elements.availableCount.textContent = String(state.rooms.length - occupiedRooms);
  elements.occupiedCount.textContent = String(occupiedRooms);
  document.querySelector('.status-summary > div:last-child strong').textContent = String(state.rooms.length);
  elements.roomsGrid.innerHTML = state.rooms.map(room => {
    const reservations = roomReservations(room.id).sort((a, b) => a.start.localeCompare(b.start));
    const blocked = room.status === 'blocked'; const occupied = isRoomOccupiedNow(room.id);
    const occupiedSlots = TIMES.filter(start => reservations.some(item => reservationOverlapsSlot(item, start))).length;
    const available = blocked ? 0 : Math.max(0, TIMES.length - occupiedSlots);
    const next = reservations.find(item => item.end > getNowSlot()) || reservations[0];
    const info = blocked ? 'Sala bloqueada pela administração' : next ? `Próxima: ${next.start} às ${next.end}` : 'Nenhuma reserva para esta data';
    const statusClass = blocked ? 'blocked' : occupied ? 'occupied' : 'available';
    const dotColor = blocked ? 'amber' : occupied ? 'red' : 'green';
    return `<button class="room-card ${statusClass}" type="button" data-room-id="${room.id}" aria-label="Abrir horários da ${escapeHtml(room.name)}"><div class="room-card-header"><span class="room-icon">${roomIcon()}</span><span class="status-badge ${statusClass}"><i class="dot ${dotColor}"></i>${blocked ? 'Bloqueada' : occupied ? 'Indisponível' : 'Disponível'}</span></div><h3>${escapeHtml(room.name)}</h3><p>${escapeHtml(info)}</p><div class="room-card-footer"><span>${clockIcon()}${available} horários livres</span><span class="chevron">${chevronIcon()}</span></div></button>`;
  }).join('');
  elements.roomsList.innerHTML = state.rooms.map(room => {
    const reservations = roomReservations(room.id); const blocked = room.status === 'blocked'; const occupied = isRoomOccupiedNow(room.id);
    const statusClass = blocked ? 'blocked' : occupied ? 'occupied' : 'available';
    const dotColor = blocked ? 'amber' : occupied ? 'red' : 'green';
    return `<button class="room-list-row ${statusClass}" type="button" data-room-id="${room.id}"><span class="room-list-title"><span class="room-icon">${roomIcon()}</span>${escapeHtml(room.name)}</span><span>${roomCapacityText(room)}</span><span>${reservations.length} ${reservations.length === 1 ? 'ocupação' : 'ocupações'} no dia</span><span class="status-badge ${statusClass}"><i class="dot ${dotColor}"></i>${blocked ? 'Bloqueada' : occupied ? 'Indisponível' : 'Disponível'}</span><span class="chevron">${chevronIcon()}</span></button>`;
  }).join('');
}

function renderManagement() {
  elements.managementGrid.innerHTML = state.rooms.map(room => {
    const total = allReservations().filter(item => item.roomId === room.id).length; const blocked = room.status === 'blocked';
    return `<article class="management-card ${blocked ? 'blocked' : ''}"><div class="management-card-top"><span class="room-icon">${roomIcon()}</span><span class="status-badge ${blocked ? 'blocked' : 'available'}">${blocked ? 'Bloqueada' : 'Ativa'}</span></div><h3>${escapeHtml(room.name)}</h3><p>${roomCapacityText(room)}</p><div class="management-card-footer"><span>${total} ${total === 1 ? 'ocupação cadastrada' : 'ocupações cadastradas'}</span><button class="mini-button" type="button" data-edit-room="${room.id}" aria-label="Editar ${escapeHtml(room.name)}">${editIcon()}</button></div></article>`;
  }).join('');
}

function openDrawer(roomId) {
  state.selectedRoomId = Number(roomId); const room = roomById(roomId); if (!room) return;
  const reservations = roomReservations(room.id); elements.drawerTitle.textContent = room.name; elements.drawerDate.textContent = formatDate(state.selectedDate);
  elements.drawerSubtitle.textContent = `${reservations.length} ${reservations.length === 1 ? 'ocupação' : 'ocupações'} · ${roomCapacityText(room).toLocaleLowerCase('pt-BR')}`;
  renderTimeSlots(); elements.drawerBackdrop.hidden = false; requestAnimationFrame(() => elements.scheduleDrawer.classList.add('open'));
  elements.scheduleDrawer.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden';
}

function closeDrawer() { elements.scheduleDrawer.classList.remove('open'); elements.scheduleDrawer.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; setTimeout(() => { elements.drawerBackdrop.hidden = true; }, 220); }

function renderTimeSlots() {
  const room = roomById(state.selectedRoomId); const reservations = roomReservations(state.selectedRoomId);
  elements.timeSlots.innerHTML = TIMES.map(start => {
    const reservation = reservations.find(item => reservationOverlapsSlot(item, start)); const end = nextHour(start);
    if (reservation?.origin === 'institutional') return `<button class="time-slot reserved institutional" type="button" data-institutional-id="${escapeHtml(reservation.id)}" data-slot-start="${start}" aria-label="Ver detalhes de ${escapeHtml(reservation.name)}"><span class="time">${start}–${end}</span><span class="slot-main"><strong>${escapeHtml(reservation.name)}</strong><small>Ocupação institucional · ${escapeHtml(reservation.start)} às ${escapeHtml(reservation.end)} · Toque para detalhes</small></span><span class="slot-status">● Ocupada</span></button>`;
    if (reservation) return `<button class="time-slot reserved" type="button" data-reservation-id="${reservation.id}" data-slot-start="${start}" aria-label="Ver reserva de ${escapeHtml(reservation.name)}"><span class="time">${start}–${end}</span><span class="slot-main"><strong>${escapeHtml(reservation.name)}</strong><small>RA: ${escapeHtml(reservation.ra)} · ${escapeHtml(reservation.email)} · Toque para detalhes</small></span><span class="slot-status">● Reservada</span></button>`;
    if (room?.status === 'blocked') return `<button class="time-slot reserved blocked" type="button" data-blocked-slot="${start}" aria-label="Sala bloqueada"><span class="time">${start}–${end}</span><span class="slot-main"><strong>Sala bloqueada</strong><small>Indisponível para novos agendamentos · Toque para detalhes</small></span><span class="slot-status">● Bloqueada</span></button>`;
    return `<button class="time-slot free" type="button" data-free-time="${start}"><span class="time">${start}–${end}</span><span class="slot-main"><strong>Horário disponível</strong><small>Clique para fazer uma reserva</small></span><span class="slot-status">● Livre</span></button>`;
  }).join('');
}

function openSlotDetails({ reservation = null, slotStart = null, isBlocked = false } = {}) {
  const room = roomById(state.selectedRoomId) || (reservation ? roomById(reservation.roomId) : null);
  const date = (reservation && reservation.date) || state.selectedDate;
  const startSlot = slotStart || (reservation ? reservation.start.slice(0, 2) + ':00' : '08:00');
  const endSlot = nextHour(startSlot);

  elements.editFromSlotDetails.hidden = true;
  elements.editFromSlotDetails.onclick = null;

  if (isBlocked) {
    elements.slotDetailsKicker.textContent = 'Sala Bloqueada';
    elements.slotDetailsTitle.textContent = `${room?.name || 'Ambiente'} - Bloqueada`;
    elements.slotDetailsBody.innerHTML = `
      <div class="slot-details-hero blocked">
        <div class="slot-details-badge-wrap">
          <span class="status-badge blocked"><i class="dot amber"></i>Bloqueada</span>
          <span class="details-pill">Indisponível</span>
        </div>
        <h3 class="slot-details-main-title">${escapeHtml(room?.name || 'Sala')} - Bloqueada pela Administração</h3>
        <p class="slot-details-subtitle">Este espaço acadêmico está bloqueado e indisponível para novos agendamentos nesta data.</p>
      </div>
      <div class="slot-details-grid">
        <div class="slot-detail-item">
          <span class="slot-detail-label">Ambiente</span>
          <strong class="slot-detail-value">${escapeHtml(room?.name || '')}</strong>
          <small>${roomCapacityText(room)}</small>
        </div>
        <div class="slot-detail-item">
          <span class="slot-detail-label">Data</span>
          <strong class="slot-detail-value">${formatDate(date, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</strong>
          <small>Data selecionada</small>
        </div>
        <div class="slot-detail-item">
          <span class="slot-detail-label">Faixa Horária</span>
          <strong class="slot-detail-value">${startSlot} às ${endSlot}</strong>
          <small>Horário indisponível</small>
        </div>
        <div class="slot-detail-item">
          <span class="slot-detail-label">Status</span>
          <strong class="slot-detail-value" style="color: #ea580c;">Bloqueada</strong>
          <small>Requer liberação pela administração</small>
        </div>
      </div>
    `;
    elements.slotDetailsDialog.showModal();
    return;
  }

  if (!reservation) return;

  const isInst = reservation.origin === 'institutional';
  const duration = formatDurationText(reservation.start, reservation.end);

  if (isInst) {
    elements.slotDetailsKicker.textContent = 'Ensalamento Acadêmico';
    elements.slotDetailsTitle.textContent = 'Detalhes da Ocupação';
    elements.slotDetailsBody.innerHTML = `
      <div class="slot-details-hero institutional">
        <div class="slot-details-badge-wrap">
          <span class="status-badge occupied"><i class="dot red"></i>Ocupada</span>
          <span class="details-pill">Ensalamento Institucional</span>
        </div>
        <h3 class="slot-details-main-title">${escapeHtml(reservation.name)}</h3>
        <p class="slot-details-subtitle">Horário reservado pela programação letiva oficial da Faculdade Medicina do Sertão.</p>
      </div>
      <div class="slot-details-grid">
        <div class="slot-detail-item">
          <span class="slot-detail-label">Ambiente</span>
          <strong class="slot-detail-value">${escapeHtml(room?.name || 'Sala')}</strong>
          <small>${roomCapacityText(room)}</small>
        </div>
        <div class="slot-detail-item">
          <span class="slot-detail-label">Data</span>
          <strong class="slot-detail-value">${formatDate(reservation.date || date, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</strong>
          <small>Dia da aula / atividade</small>
        </div>
        <div class="slot-detail-item">
          <span class="slot-detail-label">Horário de Realização</span>
          <strong class="slot-detail-value">${escapeHtml(reservation.start)} às ${escapeHtml(reservation.end)}</strong>
          <small>${duration ? `Duração: ${duration}` : 'Horário oficial'}</small>
        </div>
        <div class="slot-detail-item">
          <span class="slot-detail-label">Faixa no Painel</span>
          <strong class="slot-detail-value">${startSlot} às ${endSlot}</strong>
          <small>Horário selecionado</small>
        </div>
        <div class="slot-detail-item">
          <span class="slot-detail-label">Origem / Referência</span>
          <strong class="slot-detail-value">${escapeHtml(reservation.source || 'Grade Curricular')}</strong>
          <small>Fonte: Ensalamento Institucional</small>
        </div>
        <div class="slot-detail-item">
          <span class="slot-detail-label">Disponibilidade</span>
          <strong class="slot-detail-value" style="color: var(--red);">Indisponível</strong>
          <small>Espaço em uso acadêmico</small>
        </div>
      </div>
    `;
  } else {
    elements.slotDetailsKicker.textContent = reservation.origin === 'student' ? 'Portal do Aluno' : 'Administração';
    elements.slotDetailsTitle.textContent = 'Detalhes da Reserva';
    elements.slotDetailsBody.innerHTML = `
      <div class="slot-details-hero student">
        <div class="slot-details-badge-wrap">
          <span class="status-badge occupied"><i class="dot red"></i>Reservada</span>
          <span class="details-pill">${reservation.origin === 'student' ? 'Portal do Aluno' : 'Administração'}</span>
        </div>
        <h3 class="slot-details-main-title">${escapeHtml(reservation.name)}</h3>
        <p class="slot-details-subtitle">Reserva agendada para uso do espaço acadêmico.</p>
      </div>
      <div class="slot-details-grid">
        <div class="slot-detail-item">
          <span class="slot-detail-label">Solicitante</span>
          <strong class="slot-detail-value">${escapeHtml(reservation.name)}</strong>
          <small>Responsável pelo agendamento</small>
        </div>
        <div class="slot-detail-item">
          <span class="slot-detail-label">RA</span>
          <strong class="slot-detail-value">${escapeHtml(reservation.ra || 'Não informado')}</strong>
          <small>Registro Acadêmico</small>
        </div>
        <div class="slot-detail-item">
          <span class="slot-detail-label">E-mail</span>
          <strong class="slot-detail-value">${escapeHtml(reservation.email || 'Não informado')}</strong>
          <small>Contato</small>
        </div>
        <div class="slot-detail-item">
          <span class="slot-detail-label">Ambiente</span>
          <strong class="slot-detail-value">${escapeHtml(room?.name || 'Sala')}</strong>
          <small>${roomCapacityText(room)}</small>
        </div>
        <div class="slot-detail-item">
          <span class="slot-detail-label">Data</span>
          <strong class="slot-detail-value">${formatDate(reservation.date || date, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</strong>
          <small>Dia reservado</small>
        </div>
        <div class="slot-detail-item">
          <span class="slot-detail-label">Horário</span>
          <strong class="slot-detail-value">${escapeHtml(reservation.start)} às ${escapeHtml(reservation.end)}</strong>
          <small>${duration ? `Duração: ${duration}` : 'Período agendado'}</small>
        </div>
      </div>
    `;

    if (state.reservations.some(item => item.id === reservation.id)) {
      elements.editFromSlotDetails.hidden = false;
      elements.editFromSlotDetails.onclick = () => {
        elements.slotDetailsDialog.close();
        openReservationDialog({ reservation });
      };
    }
  }

  elements.slotDetailsDialog.showModal();
}

function fillRoomOptions() {
  const activeRooms = state.rooms.filter(room => room.status === 'active');
  elements.reservationRoom.innerHTML = activeRooms.map(room => `<option value="${room.id}">${escapeHtml(room.name)}</option>`).join('');
}

function updateAdminDurationDisplay() {
  if (!elements.reservationDurationText || !elements.reservationDurationInfo) return;
  const start = elements.reservationStart.value;
  const end = elements.reservationEnd.value;
  if (!start || !end) {
    elements.reservationDurationText.textContent = 'Informe os horários inicial e final';
    elements.reservationDurationInfo.classList.remove('invalid');
    return;
  }
  const startMin = timeInMinutes(start);
  const endMin = timeInMinutes(end);
  if (endMin <= startMin) {
    elements.reservationDurationText.textContent = 'O horário final deve ser posterior ao inicial';
    elements.reservationDurationInfo.classList.add('invalid');
    return;
  }
  elements.reservationDurationInfo.classList.remove('invalid');
  const durationText = formatDurationText(start, end);
  elements.reservationDurationText.textContent = `Duração: ${durationText} (${endMin - startMin} minutos)`;
}

function openReservationDialog({ reservation = null, roomId = null, date = null, start = null } = {}) {
  fillRoomOptions();
  elements.reservationForm.reset();
  elements.formError.hidden = true;
  elements.reservationId.value = reservation?.id || '';

  const targetRoom = reservation?.roomId || roomId || state.selectedRoomId || state.rooms.find(room => room.status === 'active')?.id;
  elements.reservationRoom.value = String(targetRoom || '');
  elements.reservationDate.value = reservation?.date || date || state.selectedDate;

  const initialStart = reservation?.start || start || '08:00';
  const initialEnd = reservation?.end || (start ? addHours(start, 1) : '09:00');
  elements.reservationStart.value = initialStart;
  elements.reservationEnd.value = initialEnd;
  updateAdminDurationDisplay();

  elements.reservationName.value = reservation?.name || '';
  elements.reservationRa.value = reservation?.ra || '';
  elements.reservationEmail.value = reservation?.email || '';
  elements.dialogKicker.textContent = reservation ? 'Detalhes da reserva' : 'Novo agendamento';
  elements.dialogTitle.textContent = reservation ? 'Editar reserva' : 'Reservar sala';
  elements.deleteReservationButton.hidden = !reservation;
  elements.reservationDialog.showModal();
  setTimeout(() => elements.reservationName.focus(), 50);
}

function validateReservation(data) {
  if (!data.name || !data.roomId || !data.date || !data.start || !data.end) return 'Preencha todos os campos obrigatórios.';
  if (data.email && !/^\S+@\S+\.\S+$/.test(data.email)) return 'Informe um e-mail válido.';
  if (!isWeekday(data.date)) return 'As reservas são permitidas apenas de segunda a sexta-feira.';
  if (roomById(data.roomId)?.status !== 'active') return 'A sala selecionada está bloqueada.';

  const startMin = timeInMinutes(data.start);
  const endMin = timeInMinutes(data.end);
  if (endMin <= startMin) return 'O horário final deve ser posterior ao horário inicial.';
  if (endMin - startMin < 15) return 'A reserva deve ter duração mínima de 15 minutos.';

  if (data.origin === 'student') {
    if (!data.ra || !data.email) return 'Preencha RA e e-mail para reservas de alunos.';
    const requestedHours = reservationHours(data);
    const alreadyReserved = studentHoursOnRoom(data.ra, data.roomId, data.date, data.id);
    if (alreadyReserved + requestedHours > 2) return `Cada aluno pode reservar no máximo 2 horas por dia na mesma sala. Este RA já possui ${alreadyReserved}h reservada${alreadyReserved === 1 ? '' : 's'} nessa sala.`;
  }

  const conflict = allReservations().find(item =>
    item.id !== data.id &&
    item.roomId === data.roomId &&
    item.date === data.date &&
    timeInMinutes(item.start) < endMin &&
    timeInMinutes(item.end) > startMin
  );
  if (conflict) {
    return `Conflito de horário: a sala já está ocupada por "${conflict.name}" das ${conflict.start} às ${conflict.end}.`;
  }
  return '';
}

function saveReservation(event) {
  event.preventDefault();
  const data = {
    id: elements.reservationId.value || crypto.randomUUID(),
    roomId: Number(elements.reservationRoom.value),
    date: elements.reservationDate.value,
    start: elements.reservationStart.value,
    end: elements.reservationEnd.value,
    name: elements.reservationName.value.trim(),
    ra: elements.reservationRa.value.trim(),
    email: elements.reservationEmail.value.trim(),
    origin: 'admin'
  };
  const error = validateReservation(data);
  if (error) return showFormError(elements.formError, error);
  const index = state.reservations.findIndex(item => item.id === data.id);
  if (index >= 0) state.reservations[index] = { ...state.reservations[index], ...data };
  else state.reservations.push(data);
  persistReservations();
  elements.reservationDialog.close();
  state.selectedDate = data.date;
  elements.selectedDate.value = data.date;
  renderAll();
  if (elements.scheduleDrawer.classList.contains('open')) openDrawer(data.roomId);
  showToast(index >= 0 ? 'Reserva atualizada com sucesso.' : 'Reserva confirmada com sucesso.');
}

function deleteCurrentReservation() {
  const id = elements.reservationId.value; if (!id || !window.confirm('Deseja cancelar esta reserva?')) return;
  state.reservations = state.reservations.filter(item => item.id !== id); persistReservations(); elements.reservationDialog.close(); renderAll();
  if (elements.scheduleDrawer.classList.contains('open')) renderTimeSlots(); showToast('Reserva cancelada.');
}

function renderReservations() {
  const query = elements.reservationSearch.value.trim().toLocaleLowerCase('pt-BR');
  const filtered = allReservations().filter(item => { const room = roomById(item.roomId)?.name || ''; return !query || [room, item.name, item.ra, item.email, item.date, item.source].some(value => String(value || '').toLocaleLowerCase('pt-BR').includes(query)); }).sort((a, b) => `${b.date}${b.start}`.localeCompare(`${a.date}${a.start}`));
  elements.reservationsEmpty.hidden = filtered.length > 0;
  const visible = filtered.slice(0, 250);
  const cards = visible.map(item => { const institutional = item.origin === 'institutional'; return `<article class="reservation-card ${institutional ? 'institutional' : ''}"><div class="reservation-card-top"><div class="reservation-room"><span class="room-icon">${roomIcon()}</span><span><strong>${escapeHtml(roomById(item.roomId)?.name || 'Sala removida')}</strong><small>${formatShortDate(item.date)}</small></span></div><span class="reservation-time-pill">${item.start} às ${item.end}</span></div><div class="reservation-person"><strong>${escapeHtml(item.name)}</strong>${institutional ? `<span>Ocupação da grade acadêmica</span><span>Fonte: ${escapeHtml(item.source || 'Ensalamento 2.2026')}</span>` : `<span>RA: ${escapeHtml(item.ra)}</span><span>${escapeHtml(item.email)}</span>`}</div><div class="reservation-card-footer"><span class="reservation-origin">${institutional ? 'Ensalamento institucional' : item.origin === 'student' ? 'Portal do aluno' : 'Administração'}</span>${institutional ? '' : `<button class="mini-button" type="button" data-edit-reservation="${item.id}" aria-label="Editar reserva">${editIcon()}</button>`}</div></article>`; }).join('');
  const limitNotice = filtered.length > visible.length ? `<article class="results-notice">Mostrando 250 de ${filtered.length} ocupações. Use a busca para localizar uma sala, data ou turma específica.</article>` : '';
  elements.reservationsCards.innerHTML = limitNotice + cards;
}

function openRoomDialog(room = null) {
  elements.roomForm.reset(); elements.roomFormError.hidden = true; elements.roomId.value = room?.id || ''; elements.roomName.value = room?.name || ''; elements.roomCapacity.value = room ? (room.capacity || '') : 30; elements.roomStatus.value = room?.status || 'active';
  elements.roomDialogKicker.textContent = room ? 'Configurações da sala' : 'Nova sala'; elements.roomDialogTitle.textContent = room ? 'Editar sala' : 'Adicionar sala'; elements.deleteRoomButton.hidden = !room; elements.roomDialog.showModal();
}

function saveRoom(event) {
  event.preventDefault(); const id = Number(elements.roomId.value); const name = elements.roomName.value.trim(); const capacity = Number(elements.roomCapacity.value);
  if (!name || !capacity || capacity < 1) return showFormError(elements.roomFormError, 'Informe um nome e uma capacidade válida.');
  if (state.rooms.some(room => room.id !== id && room.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) return showFormError(elements.roomFormError, 'Já existe uma sala com este nome.');
  if (id) { const index = state.rooms.findIndex(room => room.id === id); state.rooms[index] = { ...state.rooms[index], name, capacity, status: elements.roomStatus.value }; }
  else { const nextId = Math.max(0, ...state.rooms.map(room => room.id)) + 1; state.rooms.push({ id: nextId, name, capacity, status: elements.roomStatus.value }); }
  persistRooms(); elements.roomDialog.close(); fillRoomOptions(); renderAll(); showToast(id ? 'Sala atualizada com sucesso.' : 'Sala adicionada com sucesso.');
}

function deleteCurrentRoom() {
  const id = Number(elements.roomId.value); const room = roomById(id); if (!room || !window.confirm(`Remover ${room.name}? As reservas vinculadas também serão removidas.`)) return;
  state.rooms = state.rooms.filter(item => item.id !== id); state.reservations = state.reservations.filter(item => item.roomId !== id); persistRooms(); persistReservations(); elements.roomDialog.close(); renderAll(); showToast('Sala e reservas vinculadas foram removidas.');
}

function renderUsers() {
  const query = elements.userSearch.value.trim().toLocaleLowerCase('pt-BR');
  const filtered = state.users.filter(user => !query || [user.name, user.login, user.ra].some(value => String(value).toLocaleLowerCase('pt-BR').includes(query))).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  elements.usersEmpty.hidden = filtered.length > 0;
  elements.usersGrid.innerHTML = filtered.map(user => `<article class="management-card user-card"><div class="management-card-top"><span class="user-avatar">${escapeHtml(user.name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'US')}</span><span class="status-badge available">Ativo</span></div><h3>${escapeHtml(user.name)}</h3><p>Login: ${escapeHtml(user.login)}</p><div class="management-card-footer"><span>RA: ${escapeHtml(user.ra)}</span><button class="mini-button" type="button" data-edit-user="${user.id}" aria-label="Editar ${escapeHtml(user.name)}">${editIcon()}</button></div></article>`).join('');
}

function openUserDialog(user = null) {
  elements.userForm.reset(); elements.userFormError.hidden = true; elements.userId.value = user?.id || ''; elements.userName.value = user?.name || ''; elements.userLogin.value = user?.login || ''; elements.userRa.value = user?.ra || '';
  elements.userDialogKicker.textContent = user ? 'Dados do usuário' : 'Novo usuário'; elements.userDialogTitle.textContent = user ? 'Editar usuário' : 'Adicionar usuário'; elements.deleteUserButton.hidden = !user; elements.userDialog.showModal();
  setTimeout(() => elements.userName.focus(), 50);
}

function saveUser(event) {
  event.preventDefault(); const id = elements.userId.value; const name = elements.userName.value.trim(); const login = elements.userLogin.value.trim(); const ra = elements.userRa.value.trim();
  if (!name || !login || !ra) return showFormError(elements.userFormError, 'Preencha nome completo, login e RA.');
  if (state.users.some(user => user.id !== id && user.login.toLocaleLowerCase('pt-BR') === login.toLocaleLowerCase('pt-BR'))) return showFormError(elements.userFormError, 'Este login já está cadastrado.');
  if (state.users.some(user => user.id !== id && user.ra.toLocaleLowerCase('pt-BR') === ra.toLocaleLowerCase('pt-BR'))) return showFormError(elements.userFormError, 'Este RA já está cadastrado.');
  const data = { id: id || crypto.randomUUID(), name, login, ra };
  const index = state.users.findIndex(user => user.id === id); if (index >= 0) state.users[index] = data; else state.users.push(data);
  persistUsers(); elements.userDialog.close(); renderUsers(); showToast(index >= 0 ? 'Usuário atualizado com sucesso.' : 'Usuário cadastrado com sucesso.');
}

function deleteCurrentUser() {
  const id = elements.userId.value; const user = state.users.find(item => item.id === id); if (!user || !window.confirm(`Remover o usuário ${user.name}?`)) return;
  state.users = state.users.filter(item => item.id !== id); persistUsers(); elements.userDialog.close(); renderUsers(); showToast('Usuário removido com sucesso.');
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
  elements.studentRoomId.value = roomId; elements.studentTime.value = time; elements.studentDuration.value = ''; elements.durationControl.hidden = false;
  const twoHourButton = document.querySelector('[data-duration="2"]'); twoHourButton.disabled = !canReserveTwo;
  document.querySelectorAll('[data-duration]').forEach(button => button.classList.remove('active'));
  const room = roomById(roomId); elements.studentRoomChoice.textContent = `${room.name} · a partir das ${time}`;
  elements.studentRoomHelp.textContent = 'Selecione obrigatoriamente a duração da reserva.';
  elements.durationHelp.textContent = canReserveTwo ? 'Escolha 1 ou 2 horas.' : 'Somente 1 hora está disponível a partir deste horário.';
  elements.availabilityDialog.close();
}

function updateStudentDuration(duration) {
  const room = roomById(elements.studentRoomId.value); const time = elements.studentTime.value; if (!room || !time) return;
  elements.studentDuration.value = String(duration); document.querySelectorAll('[data-duration]').forEach(button => button.classList.toggle('active', Number(button.dataset.duration) === Number(duration)));
  elements.studentRoomChoice.textContent = `${room.name} · ${time} às ${addHours(time, duration)}`;
  elements.studentRoomHelp.textContent = `${formatDate(elements.studentDate.value, { day: '2-digit', month: 'long', year: 'numeric' })} · ${duration} hora${Number(duration) === 1 ? '' : 's'} · ${roomCapacityText(room).toLocaleLowerCase('pt-BR')}`;
}

function saveStudentReservation(event) {
  event.preventDefault(); const duration = Number(elements.studentDuration.value); if (![1, 2].includes(duration)) return showFormError(elements.studentError, 'Escolha a duração da reserva: 1 hora ou 2 horas.'); const data = { id: crypto.randomUUID(), roomId: Number(elements.studentRoomId.value), date: elements.studentDate.value, start: elements.studentTime.value, end: elements.studentTime.value ? addHours(elements.studentTime.value, duration) : '', name: elements.studentName.value.trim(), ra: elements.studentRa.value.trim(), email: elements.studentEmail.value.trim(), origin: 'student' };
  const error = validateReservation(data); if (error) return showFormError(elements.studentError, error); if (!elements.studentRules.checked) return showFormError(elements.studentError, 'Confirme que você leu e concorda com as regras.');
  state.reservations.push(data); persistReservations(); elements.studentForm.reset(); elements.studentDate.value = state.selectedDate; resetStudentChoice(); renderAll(); showToast('Reserva confirmada! O horário já está registrado.');
}

function resetStudentChoice() { elements.studentRoomId.value = ''; elements.studentTime.value = ''; elements.studentDuration.value = ''; elements.durationControl.hidden = true; document.querySelectorAll('[data-duration]').forEach(button => button.classList.remove('active')); elements.studentRoomChoice.textContent = 'Escolher sala e horário'; elements.studentRoomHelp.textContent = 'Veja apenas os horários disponíveis'; }
function showAccess() { elements.accessScreen.hidden = false; elements.studentPage.hidden = true; elements.adminApp.hidden = true; document.body.style.overflow = ''; }
function showStudentPage() { elements.accessScreen.hidden = true; elements.adminApp.hidden = true; elements.studentPage.hidden = false; elements.studentDate.value = state.selectedDate; resetStudentChoice(); window.scrollTo(0, 0); }
function showAdmin() { elements.accessScreen.hidden = true; elements.studentPage.hidden = true; elements.adminApp.hidden = false; switchView(state.activeView); }

function login(event) {
  event.preventDefault();
  if (elements.loginUser.value.trim() === 'admin' && elements.loginPassword.value === 'admin') { sessionStorage.setItem(AUTH_KEY, 'true'); elements.loginError.hidden = true; elements.loginForm.reset(); showAdmin(); return; }
  showFormError(elements.loginError, 'Usuário ou senha incorretos.');
}

function logout() { sessionStorage.removeItem(AUTH_KEY); showAccess(); }

function switchView(view) {
  state.activeView = view; const views = { dashboard: elements.dashboardView, reservations: elements.reservationsView, rooms: elements.roomsView, users: elements.usersView };
  Object.entries(views).forEach(([key, element]) => element.classList.toggle('active', key === view));
  const titles = { dashboard: 'Visão geral das salas', reservations: 'Gestão de reservas', rooms: 'Gerenciar salas', users: 'Gerenciar usuários' }; elements.pageTitle.textContent = titles[view]; elements.newReservationButton.hidden = view === 'users';
  document.querySelectorAll('.nav-item[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === view)); elements.sidebar.classList.remove('open'); elements.mobileMenu.setAttribute('aria-expanded', 'false');
  if (view === 'reservations') renderReservations(); if (view === 'rooms') renderManagement(); if (view === 'users') renderUsers();
}

function setRoomLayout(layout) { state.roomLayout = layout; elements.roomsGrid.hidden = layout !== 'grid'; elements.roomsList.hidden = layout !== 'list'; document.querySelectorAll('[data-layout]').forEach(button => button.classList.toggle('active', button.dataset.layout === layout)); }
function showFormError(element, message) { element.textContent = message; element.hidden = false; }
function showToast(message) { elements.toast.textContent = message; elements.toast.classList.add('show'); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => elements.toast.classList.remove('show'), 3000); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char])); }
function roomIcon() { return '<svg viewBox="0 0 24 24"><path d="M4 20V7l8-4 8 4v13M9 20v-5h6v5M8 9h1M15 9h1M8 12h1M15 12h1"/></svg>'; }
function clockIcon() { return '<svg viewBox="0 0 24 24"><path d="M12 8v4l2.5 2.5M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"/></svg>'; }
function chevronIcon() { return '<svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>'; }
function editIcon() { return '<svg viewBox="0 0 24 24"><path d="m14 5 5 5M4 20l3.5-.7L19 7.8a2.1 2.1 0 0 0-3-3L4.7 16.3 4 20Z"/></svg>'; }
function renderAll() { renderRooms(); renderReservations(); renderManagement(); renderUsers(); }

function bindEvents() {
  elements.loginForm.addEventListener('submit', login); document.getElementById('openStudentPage').addEventListener('click', showStudentPage); document.getElementById('openStudentFromMenu').addEventListener('click', showStudentPage);
  document.getElementById('backToAccess')?.addEventListener('click', () => sessionStorage.getItem(AUTH_KEY) === 'true' ? showAdmin() : showAccess()); document.getElementById('logoutButton').addEventListener('click', logout);
  [elements.roomsGrid, elements.roomsList].forEach(container => container.addEventListener('click', event => { const card = event.target.closest('[data-room-id]'); if (card) openDrawer(card.dataset.roomId); }));
  document.getElementById('closeDrawer').addEventListener('click', closeDrawer); elements.drawerBackdrop.addEventListener('click', closeDrawer);
  elements.timeSlots.addEventListener('click', event => {
    const inst = event.target.closest('[data-institutional-id]');
    const reserved = event.target.closest('[data-reservation-id]');
    const blocked = event.target.closest('[data-blocked-slot]');
    const free = event.target.closest('[data-free-time]');

    if (inst) {
      const res = INSTITUTIONAL_RESERVATIONS.find(item => item.id === inst.dataset.institutionalId);
      if (res) openSlotDetails({ reservation: res, slotStart: inst.dataset.slotStart });
      return;
    }
    if (reserved) {
      const res = state.reservations.find(item => item.id === reserved.dataset.reservationId);
      if (res) openSlotDetails({ reservation: res, slotStart: reserved.dataset.slotStart });
      return;
    }
    if (blocked) {
      openSlotDetails({ isBlocked: true, slotStart: blocked.dataset.blockedSlot });
      return;
    }
    if (free) {
      openReservationDialog({ roomId: state.selectedRoomId, date: state.selectedDate, start: free.dataset.freeTime });
    }
  });
  elements.closeSlotDetails?.addEventListener('click', () => elements.slotDetailsDialog.close());
  elements.dismissSlotDetails?.addEventListener('click', () => elements.slotDetailsDialog.close());
  elements.selectedDate.addEventListener('change', event => { state.selectedDate = event.target.value; renderRooms(); if (elements.scheduleDrawer.classList.contains('open')) openDrawer(state.selectedRoomId); });
  elements.newReservationButton.addEventListener('click', () => openReservationDialog());
  elements.reservationStart.addEventListener('input', () => {
    const startMin = timeInMinutes(elements.reservationStart.value);
    const endMin = timeInMinutes(elements.reservationEnd.value);
    if (!elements.reservationEnd.value || endMin <= startMin) {
      elements.reservationEnd.value = addHours(elements.reservationStart.value, 1);
    }
    updateAdminDurationDisplay();
  });
  elements.reservationEnd.addEventListener('input', updateAdminDurationDisplay);

  document.querySelectorAll('[data-duration-add]').forEach(button => {
    button.addEventListener('click', () => {
      const start = elements.reservationStart.value || '08:00';
      const addMins = Number(button.dataset.durationAdd);
      elements.reservationEnd.value = addMinutesToTime(start, addMins);
      updateAdminDurationDisplay();
    });
  });

  document.querySelectorAll('[data-preset-shift]').forEach(button => {
    button.addEventListener('click', () => {
      const shift = button.dataset.presetShift;
      if (shift === 'manha') {
        elements.reservationStart.value = '08:00';
        elements.reservationEnd.value = '12:00';
      } else if (shift === 'tarde') {
        elements.reservationStart.value = '13:30';
        elements.reservationEnd.value = '17:30';
      } else if (shift === 'noite') {
        elements.reservationStart.value = '18:30';
        elements.reservationEnd.value = '22:00';
      }
      updateAdminDurationDisplay();
    });
  });

  elements.reservationForm.addEventListener('submit', saveReservation); elements.deleteReservationButton.addEventListener('click', deleteCurrentReservation); elements.reservationSearch.addEventListener('input', renderReservations);
  elements.reservationsCards.addEventListener('click', event => {
    const editBtn = event.target.closest('[data-edit-reservation]');
    if (editBtn) {
      openReservationDialog({ reservation: state.reservations.find(item => item.id === editBtn.dataset.editReservation) });
      return;
    }
    const card = event.target.closest('.reservation-card');
    if (card && card.classList.contains('institutional')) {
      const title = card.querySelector('.reservation-person strong')?.textContent;
      const res = INSTITUTIONAL_RESERVATIONS.find(item => item.name === title);
      if (res) openSlotDetails({ reservation: res });
    }
  });
  document.querySelectorAll('.nav-item[data-view]').forEach(button => button.addEventListener('click', () => switchView(button.dataset.view))); document.querySelectorAll('[data-layout]').forEach(button => button.addEventListener('click', () => setRoomLayout(button.dataset.layout)));
  elements.mobileMenu.addEventListener('click', () => { const open = elements.sidebar.classList.toggle('open'); elements.mobileMenu.setAttribute('aria-expanded', String(open)); });
  document.getElementById('addRoomButton').addEventListener('click', () => openRoomDialog()); elements.managementGrid.addEventListener('click', event => { const button = event.target.closest('[data-edit-room]'); if (button) openRoomDialog(roomById(button.dataset.editRoom)); });
  elements.roomForm.addEventListener('submit', saveRoom); elements.deleteRoomButton.addEventListener('click', deleteCurrentRoom); elements.studentRoomPicker.addEventListener('click', openAvailabilityDialog); elements.studentDate.addEventListener('change', resetStudentChoice);
  elements.availabilitySearch?.addEventListener('input', renderAvailability);
  document.querySelectorAll('[data-avail-shift]').forEach(button => {
    button.addEventListener('click', () => {
      state.availabilityShift = button.dataset.availShift;
      document.querySelectorAll('[data-avail-shift]').forEach(b => b.classList.toggle('active', b === button));
      renderAvailability();
    });
  });
  elements.addUserButton.addEventListener('click', () => openUserDialog()); elements.userSearch.addEventListener('input', renderUsers); elements.usersGrid.addEventListener('click', event => { const button = event.target.closest('[data-edit-user]'); if (button) openUserDialog(state.users.find(user => user.id === button.dataset.editUser)); }); elements.userForm.addEventListener('submit', saveUser); elements.deleteUserButton.addEventListener('click', deleteCurrentUser);
  elements.availabilityBody.addEventListener('click', event => { const button = event.target.closest('[data-student-room]'); if (button) chooseStudentSlot(button.dataset.studentRoom, button.dataset.studentTime, button.dataset.canTwo === 'true'); });
  document.querySelectorAll('[data-duration]').forEach(button => button.addEventListener('click', () => { if (!button.disabled) updateStudentDuration(Number(button.dataset.duration)); }));
  document.getElementById('closeAvailability').addEventListener('click', () => elements.availabilityDialog.close()); elements.studentForm.addEventListener('submit', saveStudentReservation);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && elements.scheduleDrawer.classList.contains('open')) closeDrawer(); });
}

function init() {
  elements.todayLabel.textContent = formatDate(toDateInput(new Date())); elements.selectedDate.value = state.selectedDate; elements.studentDate.min = toDateInput(new Date()); elements.studentDate.value = state.selectedDate;
  fillRoomOptions(); bindEvents(); renderAll(); setRoomLayout('grid'); if (sessionStorage.getItem(AUTH_KEY) === 'true') showAdmin(); else showAccess();
}

init();
