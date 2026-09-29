const ROOMS = Array.from({ length: 13 }, (_, index) => ({
  id: index + 1,
  name: `Sala ${index + 1}`,
  capacity: index < 4 ? 40 : index < 9 ? 30 : 25,
}));

const TIMES = Array.from({ length: 14 }, (_, index) => {
  const hour = index + 7;
  return `${String(hour).padStart(2, '0')}:00`;
});

const STORAGE_KEY = 'gestao-salas-reservas-v1';
const state = {
  selectedDate: toDateInput(new Date()),
  selectedRoomId: null,
  reservations: loadReservations(),
  activeView: 'dashboard',
};

const elements = {
  roomsGrid: document.querySelector('#roomsGrid'),
  selectedDate: document.querySelector('#selectedDate'),
  availableCount: document.querySelector('#availableCount'),
  occupiedCount: document.querySelector('#occupiedCount'),
  todayLabel: document.querySelector('#todayLabel'),
  pageTitle: document.querySelector('#pageTitle'),
  dashboardView: document.querySelector('#dashboardView'),
  reservationsView: document.querySelector('#reservationsView'),
  reservationSearch: document.querySelector('#reservationSearch'),
  reservationsTableBody: document.querySelector('#reservationsTableBody'),
  reservationsEmpty: document.querySelector('#reservationsEmpty'),
  drawer: document.querySelector('#scheduleDrawer'),
  drawerBackdrop: document.querySelector('#drawerBackdrop'),
  drawerTitle: document.querySelector('#drawerTitle'),
  drawerDate: document.querySelector('#drawerDate'),
  drawerSubtitle: document.querySelector('#drawerSubtitle'),
  timeSlots: document.querySelector('#timeSlots'),
  dialog: document.querySelector('#reservationDialog'),
  form: document.querySelector('#reservationForm'),
  dialogKicker: document.querySelector('#dialogKicker'),
  dialogTitle: document.querySelector('#dialogTitle'),
  reservationId: document.querySelector('#reservationId'),
  reservationRoom: document.querySelector('#reservationRoom'),
  reservationDate: document.querySelector('#reservationDate'),
  reservationStart: document.querySelector('#reservationStart'),
  reservationEnd: document.querySelector('#reservationEnd'),
  reservationName: document.querySelector('#reservationName'),
  reservationRa: document.querySelector('#reservationRa'),
  reservationEmail: document.querySelector('#reservationEmail'),
  formError: document.querySelector('#formError'),
  deleteButton: document.querySelector('#deleteReservationButton'),
  toast: document.querySelector('#toast'),
  sidebar: document.querySelector('#sidebar'),
  mobileMenu: document.querySelector('#mobileMenu'),
};

function seedReservations() {
  const date = toDateInput(new Date());
  return [
    { id: crypto.randomUUID(), roomId: 2, date, start: '12:00', end: '13:00', name: 'Amanda Karla Marques de Sousa', ra: '14000071', email: 'amanda.sousa@medicinadosertao.com.br' },
    { id: crypto.randomUUID(), roomId: 5, date, start: '09:00', end: '10:00', name: 'Carlos Henrique Lima', ra: '14000128', email: 'carlos.lima@medicinadosertao.com.br' },
    { id: crypto.randomUUID(), roomId: 8, date, start: '14:00', end: '15:00', name: 'Mariana Alves Rocha', ra: '14000316', email: 'mariana.rocha@medicinadosertao.com.br' },
  ];
}

function loadReservations() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : seedReservations();
  } catch {
    return seedReservations();
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.reservations));
}

function toDateInput(date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function formatDate(dateString, options = { weekday: 'long', day: '2-digit', month: 'long' }) {
  return new Intl.DateTimeFormat('pt-BR', options).format(new Date(`${dateString}T12:00:00`));
}

function formatShortDate(dateString) {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(`${dateString}T12:00:00`));
}

function getNowSlot() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:00`;
}

function roomReservations(roomId, date = state.selectedDate) {
  return state.reservations.filter(item => item.roomId === roomId && item.date === date);
}

function isRoomOccupiedNow(roomId) {
  if (state.selectedDate !== toDateInput(new Date())) return roomReservations(roomId).length > 0;
  const currentTime = getNowSlot();
  return roomReservations(roomId).some(item => item.start <= currentTime && item.end > currentTime);
}

function renderRooms() {
  const occupiedRooms = ROOMS.filter(room => roomReservations(room.id).length > 0).length;
  elements.availableCount.textContent = String(ROOMS.length - occupiedRooms);
  elements.occupiedCount.textContent = String(occupiedRooms);

  elements.roomsGrid.innerHTML = ROOMS.map(room => {
    const reservations = roomReservations(room.id).sort((a, b) => a.start.localeCompare(b.start));
    const unavailable = reservations.length;
    const available = TIMES.length - unavailable;
    const occupiedNow = isRoomOccupiedNow(room.id);
    const status = occupiedNow ? 'occupied' : 'available';
    const statusText = occupiedNow ? 'Indisponível' : 'Disponível';
    const next = reservations.find(item => item.start >= getNowSlot()) || reservations[0];
    const info = next ? `Próxima: ${next.start} às ${next.end}` : 'Nenhuma reserva para esta data';

    return `<button class="room-card" type="button" data-room-id="${room.id}" aria-label="Abrir horários da ${escapeHtml(room.name)}">
      <div class="room-card-header">
        <span class="room-icon"><svg viewBox="0 0 24 24"><path d="M4 20V7l8-4 8 4v13M9 20v-5h6v5M8 9h1M15 9h1M8 12h1M15 12h1"/></svg></span>
        <span class="status-badge ${status}"><i class="dot ${occupiedNow ? 'red' : 'green'}"></i>${statusText}</span>
      </div>
      <h3>${escapeHtml(room.name)}</h3>
      <p>${escapeHtml(info)}</p>
      <div class="room-card-footer">
        <span><svg viewBox="0 0 24 24"><path d="M12 8v4l2.5 2.5M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"/></svg>${available} horários livres</span>
        <span class="chevron"><svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg></span>
      </div>
    </button>`;
  }).join('');
}

function openDrawer(roomId) {
  state.selectedRoomId = Number(roomId);
  const room = ROOMS.find(item => item.id === state.selectedRoomId);
  const reservations = roomReservations(state.selectedRoomId);
  elements.drawerTitle.textContent = room.name;
  elements.drawerDate.textContent = formatDate(state.selectedDate);
  elements.drawerSubtitle.textContent = `${reservations.length} reserva${reservations.length === 1 ? '' : 's'} · capacidade para ${room.capacity} pessoas`;
  renderTimeSlots();
  elements.drawerBackdrop.hidden = false;
  requestAnimationFrame(() => elements.drawer.classList.add('open'));
  elements.drawer.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeDrawer() {
  elements.drawer.classList.remove('open');
  elements.drawer.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  setTimeout(() => { elements.drawerBackdrop.hidden = true; }, 220);
}

function renderTimeSlots() {
  const reservations = roomReservations(state.selectedRoomId);
  elements.timeSlots.innerHTML = TIMES.map(start => {
    const reservation = reservations.find(item => item.start === start);
    const end = nextHour(start);
    if (reservation) {
      return `<button class="time-slot reserved" type="button" data-reservation-id="${reservation.id}">
        <span class="time">${start}–${end}</span>
        <span class="slot-main"><strong>${escapeHtml(reservation.name)}</strong><small>RA: ${escapeHtml(reservation.ra)} · ${escapeHtml(reservation.email)}</small></span>
        <span class="slot-status">● Reservada</span>
      </button>`;
    }
    return `<button class="time-slot free" type="button" data-free-time="${start}">
      <span class="time">${start}–${end}</span>
      <span class="slot-main"><strong>Horário disponível</strong><small>Clique para fazer uma reserva</small></span>
      <span class="slot-status">● Livre</span>
    </button>`;
  }).join('');
}

function nextHour(time) {
  const hour = Number(time.slice(0, 2)) + 1;
  return `${String(hour).padStart(2, '0')}:00`;
}

function fillRoomOptions() {
  elements.reservationRoom.innerHTML = ROOMS.map(room => `<option value="${room.id}">${room.name}</option>`).join('');
  elements.reservationStart.innerHTML = TIMES.map(time => `<option value="${time}">${time}</option>`).join('');
}

function openReservationDialog({ reservation = null, roomId = null, date = null, start = null } = {}) {
  elements.form.reset();
  elements.formError.hidden = true;
  elements.reservationId.value = reservation?.id || '';
  elements.reservationRoom.value = String(reservation?.roomId || roomId || state.selectedRoomId || 1);
  elements.reservationDate.value = reservation?.date || date || state.selectedDate;
  elements.reservationStart.value = reservation?.start || start || TIMES[0];
  elements.reservationEnd.value = reservation?.end || nextHour(elements.reservationStart.value);
  elements.reservationName.value = reservation?.name || '';
  elements.reservationRa.value = reservation?.ra || '';
  elements.reservationEmail.value = reservation?.email || '';
  elements.dialogKicker.textContent = reservation ? 'Detalhes da reserva' : 'Novo agendamento';
  elements.dialogTitle.textContent = reservation ? 'Editar reserva' : 'Reservar sala';
  elements.deleteButton.hidden = !reservation;
  elements.dialog.showModal();
  setTimeout(() => elements.reservationName.focus(), 50);
}

function validateReservation(data) {
  if (!data.name || !data.ra || !data.email) return 'Preencha nome, RA e e-mail.';
  if (!/^\S+@\S+\.\S+$/.test(data.email)) return 'Informe um e-mail válido.';
  const conflict = state.reservations.find(item => item.id !== data.id && item.roomId === data.roomId && item.date === data.date && item.start === data.start);
  if (conflict) return 'Este horário já está reservado para a sala selecionada.';
  return '';
}

function saveReservation(event) {
  event.preventDefault();
  const data = {
    id: elements.reservationId.value || crypto.randomUUID(),
    roomId: Number(elements.reservationRoom.value),
    date: elements.reservationDate.value,
    start: elements.reservationStart.value,
    end: nextHour(elements.reservationStart.value),
    name: elements.reservationName.value.trim(),
    ra: elements.reservationRa.value.trim(),
    email: elements.reservationEmail.value.trim(),
  };
  const error = validateReservation(data);
  if (error) {
    elements.formError.textContent = error;
    elements.formError.hidden = false;
    return;
  }
  const index = state.reservations.findIndex(item => item.id === data.id);
  if (index >= 0) state.reservations[index] = data;
  else state.reservations.push(data);
  persist();
  elements.dialog.close();
  state.selectedDate = data.date;
  elements.selectedDate.value = data.date;
  renderAll();
  if (elements.drawer.classList.contains('open')) {
    state.selectedRoomId = data.roomId;
    openDrawer(data.roomId);
  }
  showToast(index >= 0 ? 'Reserva atualizada com sucesso.' : 'Reserva confirmada com sucesso.');
}

function deleteCurrentReservation() {
  const id = elements.reservationId.value;
  if (!id || !window.confirm('Deseja cancelar esta reserva?')) return;
  state.reservations = state.reservations.filter(item => item.id !== id);
  persist();
  elements.dialog.close();
  renderAll();
  if (elements.drawer.classList.contains('open')) renderTimeSlots();
  showToast('Reserva cancelada.');
}

function renderReservationsTable() {
  const query = elements.reservationSearch.value.trim().toLocaleLowerCase('pt-BR');
  const filtered = [...state.reservations]
    .filter(item => {
      const room = ROOMS.find(roomItem => roomItem.id === item.roomId)?.name || '';
      return !query || [room, item.name, item.ra, item.email, item.date].some(value => String(value).toLocaleLowerCase('pt-BR').includes(query));
    })
    .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));

  elements.reservationsEmpty.hidden = filtered.length > 0;
  elements.reservationsTableBody.innerHTML = filtered.map(item => `<tr>
    <td><strong>${formatShortDate(item.date)}</strong></td>
    <td>${escapeHtml(ROOMS.find(room => room.id === item.roomId)?.name || '')}</td>
    <td>${item.start} às ${item.end}</td>
    <td><strong>${escapeHtml(item.name)}</strong></td>
    <td>${escapeHtml(item.ra)}</td>
    <td>${escapeHtml(item.email)}</td>
    <td><div class="table-actions"><button class="mini-button" type="button" data-edit-reservation="${item.id}" aria-label="Editar reserva"><svg viewBox="0 0 24 24"><path d="m14 5 5 5M4 20l3.5-.7L19 7.8a2.1 2.1 0 0 0-3-3L4.7 16.3 4 20Z"/></svg></button></div></td>
  </tr>`).join('');
}

function switchView(view) {
  state.activeView = view;
  const dashboard = view === 'dashboard';
  elements.dashboardView.classList.toggle('active', dashboard);
  elements.reservationsView.classList.toggle('active', !dashboard);
  elements.pageTitle.textContent = dashboard ? 'Visão geral das salas' : 'Gestão de reservas';
  document.querySelectorAll('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  elements.sidebar.classList.remove('open');
  elements.mobileMenu.setAttribute('aria-expanded', 'false');
  if (!dashboard) renderReservationsTable();
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => elements.toast.classList.remove('show'), 2800);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

function renderAll() {
  renderRooms();
  renderReservationsTable();
}

function bindEvents() {
  elements.roomsGrid.addEventListener('click', event => {
    const card = event.target.closest('[data-room-id]');
    if (card) openDrawer(card.dataset.roomId);
  });
  document.querySelector('#closeDrawer').addEventListener('click', closeDrawer);
  elements.drawerBackdrop.addEventListener('click', closeDrawer);
  elements.timeSlots.addEventListener('click', event => {
    const reserved = event.target.closest('[data-reservation-id]');
    const free = event.target.closest('[data-free-time]');
    if (reserved) openReservationDialog({ reservation: state.reservations.find(item => item.id === reserved.dataset.reservationId) });
    if (free) openReservationDialog({ roomId: state.selectedRoomId, date: state.selectedDate, start: free.dataset.freeTime });
  });
  elements.selectedDate.addEventListener('change', event => {
    state.selectedDate = event.target.value;
    renderRooms();
    if (elements.drawer.classList.contains('open')) openDrawer(state.selectedRoomId);
  });
  document.querySelector('#newReservationButton').addEventListener('click', () => openReservationDialog());
  elements.reservationStart.addEventListener('change', () => { elements.reservationEnd.value = nextHour(elements.reservationStart.value); });
  elements.form.addEventListener('submit', saveReservation);
  elements.deleteButton.addEventListener('click', deleteCurrentReservation);
  elements.reservationSearch.addEventListener('input', renderReservationsTable);
  elements.reservationsTableBody.addEventListener('click', event => {
    const button = event.target.closest('[data-edit-reservation]');
    if (button) openReservationDialog({ reservation: state.reservations.find(item => item.id === button.dataset.editReservation) });
  });
  document.querySelectorAll('.nav-item').forEach(button => button.addEventListener('click', () => switchView(button.dataset.view)));
  elements.mobileMenu.addEventListener('click', () => {
    const open = elements.sidebar.classList.toggle('open');
    elements.mobileMenu.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && elements.drawer.classList.contains('open')) closeDrawer(); });
}

function init() {
  elements.todayLabel.textContent = formatDate(toDateInput(new Date()));
  elements.selectedDate.value = state.selectedDate;
  fillRoomOptions();
  bindEvents();
  renderAll();
}

init();
