const DEFAULT_ROOMS = Array.from({ length: 13 }, (_, index) => ({
  id: index + 1,
  name: `Sala ${index + 1}`,
  capacity: index < 4 ? 40 : index < 9 ? 30 : 25,
  status: 'active',
}));

const TIMES = Array.from({ length: 9 }, (_, index) => `${String(index + 8).padStart(2, '0')}:00`);
const RESERVATIONS_KEY = 'gestao-salas-reservas-v2';
const LEGACY_RESERVATIONS_KEY = 'gestao-salas-reservas-v1';
const ROOMS_KEY = 'gestao-salas-ambientes-v1';
const AUTH_KEY = 'gestao-salas-admin-auth';

const state = {
  selectedDate: toDateInput(new Date()), selectedRoomId: null,
  rooms: loadRooms(), reservations: loadReservations(), activeView: 'dashboard', roomLayout: 'grid',
};

const elements = Object.fromEntries([
  'accessScreen', 'adminApp', 'studentPage', 'loginForm', 'loginUser', 'loginPassword', 'loginError',
  'roomsGrid', 'roomsList', 'selectedDate', 'availableCount', 'occupiedCount', 'todayLabel', 'pageTitle',
  'dashboardView', 'reservationsView', 'roomsView', 'reservationSearch', 'reservationsCards', 'reservationsEmpty',
  'scheduleDrawer', 'drawerBackdrop', 'drawerTitle', 'drawerDate', 'drawerSubtitle', 'timeSlots',
  'reservationDialog', 'reservationForm', 'dialogKicker', 'dialogTitle', 'reservationId', 'reservationRoom',
  'reservationDate', 'reservationStart', 'reservationEnd', 'reservationName', 'reservationRa',
  'reservationEmail', 'formError', 'deleteReservationButton', 'toast', 'sidebar', 'mobileMenu',
  'managementGrid', 'roomDialog', 'roomForm', 'roomDialogKicker', 'roomDialogTitle', 'roomId', 'roomName',
  'roomCapacity', 'roomStatus', 'roomFormError', 'deleteRoomButton', 'studentForm', 'studentName', 'studentRa',
  'studentEmail', 'studentDate', 'studentRoomId', 'studentTime', 'studentRoomChoice', 'studentRoomHelp',
  'studentRules', 'studentError', 'studentRoomPicker', 'availabilityDialog', 'availabilityBody',
].map(id => [id, document.getElementById(id)]));

function seedReservations() {
  const date = toDateInput(new Date());
  return [
    { id: crypto.randomUUID(), roomId: 2, date, start: '12:00', end: '13:00', name: 'Amanda Karla Marques de Sousa', ra: '14000071', email: 'amanda.sousa@medicinadosertao.com.br', origin: 'admin' },
    { id: crypto.randomUUID(), roomId: 5, date, start: '09:00', end: '10:00', name: 'Carlos Henrique Lima', ra: '14000128', email: 'carlos.lima@medicinadosertao.com.br', origin: 'student' },
    { id: crypto.randomUUID(), roomId: 8, date, start: '14:00', end: '15:00', name: 'Mariana Alves Rocha', ra: '14000316', email: 'mariana.rocha@medicinadosertao.com.br', origin: 'student' },
  ];
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

function persistRooms() { localStorage.setItem(ROOMS_KEY, JSON.stringify(state.rooms)); }
function persistReservations() { localStorage.setItem(RESERVATIONS_KEY, JSON.stringify(state.reservations)); }
function toDateInput(date) { const offset = date.getTimezoneOffset(); return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10); }
function formatDate(dateString, options = { weekday: 'long', day: '2-digit', month: 'long' }) { return new Intl.DateTimeFormat('pt-BR', options).format(new Date(`${dateString}T12:00:00`)); }
function formatShortDate(dateString) { return new Intl.DateTimeFormat('pt-BR').format(new Date(`${dateString}T12:00:00`)); }
function nextHour(time) { return `${String(Number(time.slice(0, 2)) + 1).padStart(2, '0')}:00`; }
function roomById(id) { return state.rooms.find(room => room.id === Number(id)); }
function roomReservations(roomId, date = state.selectedDate) { return state.reservations.filter(item => item.roomId === Number(roomId) && item.date === date); }
function getNowSlot() { return `${String(new Date().getHours()).padStart(2, '0')}:00`; }
function isWeekday(dateString) { const day = new Date(`${dateString}T12:00:00`).getDay(); return day >= 1 && day <= 5; }

function isRoomOccupiedNow(roomId) {
  const room = roomById(roomId);
  if (!room || room.status === 'blocked') return true;
  if (state.selectedDate !== toDateInput(new Date())) return roomReservations(roomId).length > 0;
  const currentTime = getNowSlot();
  return roomReservations(roomId).some(item => item.start <= currentTime && item.end > currentTime);
}

function renderRooms() {
  const occupiedRooms = state.rooms.filter(room => room.status === 'blocked' || roomReservations(room.id).length > 0).length;
  elements.availableCount.textContent = String(state.rooms.length - occupiedRooms);
  elements.occupiedCount.textContent = String(occupiedRooms);
  document.querySelector('.status-summary > div:last-child strong').textContent = String(state.rooms.length);
  elements.roomsGrid.innerHTML = state.rooms.map(room => {
    const reservations = roomReservations(room.id).sort((a, b) => a.start.localeCompare(b.start));
    const blocked = room.status === 'blocked'; const occupied = isRoomOccupiedNow(room.id);
    const available = blocked ? 0 : TIMES.length - reservations.length;
    const next = reservations.find(item => item.start >= getNowSlot()) || reservations[0];
    const info = blocked ? 'Sala bloqueada pela administração' : next ? `Próxima: ${next.start} às ${next.end}` : 'Nenhuma reserva para esta data';
    return `<button class="room-card" type="button" data-room-id="${room.id}" aria-label="Abrir horários da ${escapeHtml(room.name)}"><div class="room-card-header"><span class="room-icon">${roomIcon()}</span><span class="status-badge ${blocked ? 'blocked' : occupied ? 'occupied' : 'available'}"><i class="dot ${occupied ? 'red' : 'green'}"></i>${blocked ? 'Bloqueada' : occupied ? 'Indisponível' : 'Disponível'}</span></div><h3>${escapeHtml(room.name)}</h3><p>${escapeHtml(info)}</p><div class="room-card-footer"><span>${clockIcon()}${available} horários livres</span><span class="chevron">${chevronIcon()}</span></div></button>`;
  }).join('');
  elements.roomsList.innerHTML = state.rooms.map(room => {
    const reservations = roomReservations(room.id); const blocked = room.status === 'blocked'; const occupied = isRoomOccupiedNow(room.id);
    return `<button class="room-list-row" type="button" data-room-id="${room.id}"><span class="room-list-title"><span class="room-icon">${roomIcon()}</span>${escapeHtml(room.name)}</span><span>Capacidade: ${room.capacity}</span><span>${reservations.length} reserva${reservations.length === 1 ? '' : 's'} no dia</span><span class="status-badge ${blocked ? 'blocked' : occupied ? 'occupied' : 'available'}"><i class="dot ${occupied ? 'red' : 'green'}"></i>${blocked ? 'Bloqueada' : occupied ? 'Indisponível' : 'Disponível'}</span><span class="chevron">${chevronIcon()}</span></button>`;
  }).join('');
}

function renderManagement() {
  elements.managementGrid.innerHTML = state.rooms.map(room => {
    const total = state.reservations.filter(item => item.roomId === room.id).length; const blocked = room.status === 'blocked';
    return `<article class="management-card ${blocked ? 'blocked' : ''}"><div class="management-card-top"><span class="room-icon">${roomIcon()}</span><span class="status-badge ${blocked ? 'blocked' : 'available'}">${blocked ? 'Bloqueada' : 'Ativa'}</span></div><h3>${escapeHtml(room.name)}</h3><p>Capacidade para ${room.capacity} pessoas</p><div class="management-card-footer"><span>${total} reserva${total === 1 ? '' : 's'} cadastrada${total === 1 ? '' : 's'}</span><button class="mini-button" type="button" data-edit-room="${room.id}" aria-label="Editar ${escapeHtml(room.name)}">${editIcon()}</button></div></article>`;
  }).join('');
}

function openDrawer(roomId) {
  state.selectedRoomId = Number(roomId); const room = roomById(roomId); if (!room) return;
  const reservations = roomReservations(room.id); elements.drawerTitle.textContent = room.name; elements.drawerDate.textContent = formatDate(state.selectedDate);
  elements.drawerSubtitle.textContent = `${reservations.length} reserva${reservations.length === 1 ? '' : 's'} · capacidade para ${room.capacity} pessoas`;
  renderTimeSlots(); elements.drawerBackdrop.hidden = false; requestAnimationFrame(() => elements.scheduleDrawer.classList.add('open'));
  elements.scheduleDrawer.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden';
}

function closeDrawer() { elements.scheduleDrawer.classList.remove('open'); elements.scheduleDrawer.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; setTimeout(() => { elements.drawerBackdrop.hidden = true; }, 220); }

function renderTimeSlots() {
  const room = roomById(state.selectedRoomId); const reservations = roomReservations(state.selectedRoomId);
  elements.timeSlots.innerHTML = TIMES.map(start => {
    const reservation = reservations.find(item => item.start === start); const end = nextHour(start);
    if (reservation) return `<button class="time-slot reserved" type="button" data-reservation-id="${reservation.id}"><span class="time">${start}–${end}</span><span class="slot-main"><strong>${escapeHtml(reservation.name)}</strong><small>RA: ${escapeHtml(reservation.ra)} · ${escapeHtml(reservation.email)}</small></span><span class="slot-status">● Reservada</span></button>`;
    if (room?.status === 'blocked') return `<div class="time-slot reserved"><span class="time">${start}–${end}</span><span class="slot-main"><strong>Sala bloqueada</strong><small>Indisponível para novos agendamentos</small></span><span class="slot-status">● Bloqueada</span></div>`;
    return `<button class="time-slot free" type="button" data-free-time="${start}"><span class="time">${start}–${end}</span><span class="slot-main"><strong>Horário disponível</strong><small>Clique para fazer uma reserva</small></span><span class="slot-status">● Livre</span></button>`;
  }).join('');
}

function fillRoomOptions() {
  const activeRooms = state.rooms.filter(room => room.status === 'active');
  elements.reservationRoom.innerHTML = activeRooms.map(room => `<option value="${room.id}">${escapeHtml(room.name)}</option>`).join('');
  elements.reservationStart.innerHTML = TIMES.map(time => `<option value="${time}">${time}</option>`).join('');
}

function openReservationDialog({ reservation = null, roomId = null, date = null, start = null } = {}) {
  fillRoomOptions(); elements.reservationForm.reset(); elements.formError.hidden = true; elements.reservationId.value = reservation?.id || '';
  const targetRoom = reservation?.roomId || roomId || state.selectedRoomId || state.rooms.find(room => room.status === 'active')?.id;
  elements.reservationRoom.value = String(targetRoom || ''); elements.reservationDate.value = reservation?.date || date || state.selectedDate;
  elements.reservationStart.value = reservation?.start || start || TIMES[0]; elements.reservationEnd.value = reservation?.end || nextHour(elements.reservationStart.value);
  elements.reservationName.value = reservation?.name || ''; elements.reservationRa.value = reservation?.ra || ''; elements.reservationEmail.value = reservation?.email || '';
  elements.dialogKicker.textContent = reservation ? 'Detalhes da reserva' : 'Novo agendamento'; elements.dialogTitle.textContent = reservation ? 'Editar reserva' : 'Reservar sala';
  elements.deleteReservationButton.hidden = !reservation; elements.reservationDialog.showModal(); setTimeout(() => elements.reservationName.focus(), 50);
}

function validateReservation(data) {
  if (!data.name || !data.ra || !data.email || !data.roomId || !data.date || !data.start) return 'Preencha todos os campos obrigatórios.';
  if (!/^\S+@\S+\.\S+$/.test(data.email)) return 'Informe um e-mail válido.';
  if (!isWeekday(data.date)) return 'As reservas são permitidas apenas de segunda a sexta-feira.';
  if (roomById(data.roomId)?.status !== 'active') return 'A sala selecionada está bloqueada.';
  const conflict = state.reservations.find(item => item.id !== data.id && item.roomId === data.roomId && item.date === data.date && item.start === data.start);
  return conflict ? 'Este horário já está reservado para a sala selecionada.' : '';
}

function saveReservation(event) {
  event.preventDefault();
  const data = { id: elements.reservationId.value || crypto.randomUUID(), roomId: Number(elements.reservationRoom.value), date: elements.reservationDate.value, start: elements.reservationStart.value, end: nextHour(elements.reservationStart.value), name: elements.reservationName.value.trim(), ra: elements.reservationRa.value.trim(), email: elements.reservationEmail.value.trim(), origin: 'admin' };
  const error = validateReservation(data); if (error) return showFormError(elements.formError, error);
  const index = state.reservations.findIndex(item => item.id === data.id); if (index >= 0) state.reservations[index] = { ...state.reservations[index], ...data }; else state.reservations.push(data);
  persistReservations(); elements.reservationDialog.close(); state.selectedDate = data.date; elements.selectedDate.value = data.date; renderAll();
  if (elements.scheduleDrawer.classList.contains('open')) openDrawer(data.roomId); showToast(index >= 0 ? 'Reserva atualizada com sucesso.' : 'Reserva confirmada com sucesso.');
}

function deleteCurrentReservation() {
  const id = elements.reservationId.value; if (!id || !window.confirm('Deseja cancelar esta reserva?')) return;
  state.reservations = state.reservations.filter(item => item.id !== id); persistReservations(); elements.reservationDialog.close(); renderAll();
  if (elements.scheduleDrawer.classList.contains('open')) renderTimeSlots(); showToast('Reserva cancelada.');
}

function renderReservations() {
  const query = elements.reservationSearch.value.trim().toLocaleLowerCase('pt-BR');
  const filtered = [...state.reservations].filter(item => { const room = roomById(item.roomId)?.name || ''; return !query || [room, item.name, item.ra, item.email, item.date].some(value => String(value).toLocaleLowerCase('pt-BR').includes(query)); }).sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
  elements.reservationsEmpty.hidden = filtered.length > 0;
  elements.reservationsCards.innerHTML = filtered.map(item => `<article class="reservation-card"><div class="reservation-card-top"><div class="reservation-room"><span class="room-icon">${roomIcon()}</span><span><strong>${escapeHtml(roomById(item.roomId)?.name || 'Sala removida')}</strong><small>${formatShortDate(item.date)}</small></span></div><span class="reservation-time-pill">${item.start} às ${item.end}</span></div><div class="reservation-person"><strong>${escapeHtml(item.name)}</strong><span>RA: ${escapeHtml(item.ra)}</span><span>${escapeHtml(item.email)}</span></div><div class="reservation-card-footer"><span class="reservation-origin">${item.origin === 'student' ? 'Portal do aluno' : 'Administração'}</span><button class="mini-button" type="button" data-edit-reservation="${item.id}" aria-label="Editar reserva">${editIcon()}</button></div></article>`).join('');
}

function openRoomDialog(room = null) {
  elements.roomForm.reset(); elements.roomFormError.hidden = true; elements.roomId.value = room?.id || ''; elements.roomName.value = room?.name || ''; elements.roomCapacity.value = room?.capacity || 30; elements.roomStatus.value = room?.status || 'active';
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

function renderAvailability() {
  const date = elements.studentDate.value; if (!date) return showFormError(elements.studentError, 'Escolha uma data antes de consultar as salas.');
  if (!isWeekday(date)) return showFormError(elements.studentError, 'Escolha uma data entre segunda e sexta-feira.'); elements.studentError.hidden = true;
  const activeRooms = state.rooms.filter(room => room.status === 'active');
  elements.availabilityBody.innerHTML = activeRooms.map(room => { const reserved = roomReservations(room.id, date).map(item => item.start); const free = TIMES.filter(time => !reserved.includes(time)); return `<section class="availability-room"><div class="availability-room-header"><strong>${escapeHtml(room.name)}</strong><span>Capacidade: ${room.capacity}</span></div><div class="availability-times">${free.length ? free.map(time => `<button class="availability-time" type="button" data-student-room="${room.id}" data-student-time="${time}">${time}–${nextHour(time)}</button>`).join('') : '<span class="availability-empty">Sem horários disponíveis nesta data.</span>'}</div></section>`; }).join('') || '<p class="availability-empty">Nenhuma sala está disponível para reservas.</p>';
  elements.availabilityDialog.showModal();
}

function chooseStudentSlot(roomId, time) {
  const room = roomById(roomId); elements.studentRoomId.value = roomId; elements.studentTime.value = time; elements.studentRoomChoice.textContent = `${room.name} · ${time} às ${nextHour(time)}`;
  elements.studentRoomHelp.textContent = `${formatDate(elements.studentDate.value, { day: '2-digit', month: 'long', year: 'numeric' })} · capacidade para ${room.capacity} pessoas`; elements.availabilityDialog.close();
}

function saveStudentReservation(event) {
  event.preventDefault(); const data = { id: crypto.randomUUID(), roomId: Number(elements.studentRoomId.value), date: elements.studentDate.value, start: elements.studentTime.value, end: elements.studentTime.value ? nextHour(elements.studentTime.value) : '', name: elements.studentName.value.trim(), ra: elements.studentRa.value.trim(), email: elements.studentEmail.value.trim(), origin: 'student' };
  const error = validateReservation(data); if (error) return showFormError(elements.studentError, error); if (!elements.studentRules.checked) return showFormError(elements.studentError, 'Confirme que você leu e concorda com as regras.');
  state.reservations.push(data); persistReservations(); elements.studentForm.reset(); elements.studentDate.value = state.selectedDate; resetStudentChoice(); renderAll(); showToast('Reserva confirmada! O horário já está registrado.');
}

function resetStudentChoice() { elements.studentRoomId.value = ''; elements.studentTime.value = ''; elements.studentRoomChoice.textContent = 'Escolher sala e horário'; elements.studentRoomHelp.textContent = 'Veja apenas os horários disponíveis'; }
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
  state.activeView = view; const views = { dashboard: elements.dashboardView, reservations: elements.reservationsView, rooms: elements.roomsView };
  Object.entries(views).forEach(([key, element]) => element.classList.toggle('active', key === view));
  const titles = { dashboard: 'Visão geral das salas', reservations: 'Gestão de reservas', rooms: 'Gerenciar salas' }; elements.pageTitle.textContent = titles[view];
  document.querySelectorAll('.nav-item[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === view)); elements.sidebar.classList.remove('open'); elements.mobileMenu.setAttribute('aria-expanded', 'false');
  if (view === 'reservations') renderReservations(); if (view === 'rooms') renderManagement();
}

function setRoomLayout(layout) { state.roomLayout = layout; elements.roomsGrid.hidden = layout !== 'grid'; elements.roomsList.hidden = layout !== 'list'; document.querySelectorAll('[data-layout]').forEach(button => button.classList.toggle('active', button.dataset.layout === layout)); }
function showFormError(element, message) { element.textContent = message; element.hidden = false; }
function showToast(message) { elements.toast.textContent = message; elements.toast.classList.add('show'); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => elements.toast.classList.remove('show'), 3000); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char])); }
function roomIcon() { return '<svg viewBox="0 0 24 24"><path d="M4 20V7l8-4 8 4v13M9 20v-5h6v5M8 9h1M15 9h1M8 12h1M15 12h1"/></svg>'; }
function clockIcon() { return '<svg viewBox="0 0 24 24"><path d="M12 8v4l2.5 2.5M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"/></svg>'; }
function chevronIcon() { return '<svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>'; }
function editIcon() { return '<svg viewBox="0 0 24 24"><path d="m14 5 5 5M4 20l3.5-.7L19 7.8a2.1 2.1 0 0 0-3-3L4.7 16.3 4 20Z"/></svg>'; }
function renderAll() { renderRooms(); renderReservations(); renderManagement(); }

function bindEvents() {
  elements.loginForm.addEventListener('submit', login); document.getElementById('openStudentPage').addEventListener('click', showStudentPage); document.getElementById('openStudentFromMenu').addEventListener('click', showStudentPage);
  document.getElementById('backToAccess').addEventListener('click', () => sessionStorage.getItem(AUTH_KEY) === 'true' ? showAdmin() : showAccess()); document.getElementById('logoutButton').addEventListener('click', logout);
  [elements.roomsGrid, elements.roomsList].forEach(container => container.addEventListener('click', event => { const card = event.target.closest('[data-room-id]'); if (card) openDrawer(card.dataset.roomId); }));
  document.getElementById('closeDrawer').addEventListener('click', closeDrawer); elements.drawerBackdrop.addEventListener('click', closeDrawer);
  elements.timeSlots.addEventListener('click', event => { const reserved = event.target.closest('[data-reservation-id]'); const free = event.target.closest('[data-free-time]'); if (reserved) openReservationDialog({ reservation: state.reservations.find(item => item.id === reserved.dataset.reservationId) }); if (free) openReservationDialog({ roomId: state.selectedRoomId, date: state.selectedDate, start: free.dataset.freeTime }); });
  elements.selectedDate.addEventListener('change', event => { state.selectedDate = event.target.value; renderRooms(); if (elements.scheduleDrawer.classList.contains('open')) openDrawer(state.selectedRoomId); });
  document.getElementById('newReservationButton').addEventListener('click', () => openReservationDialog()); elements.reservationStart.addEventListener('change', () => { elements.reservationEnd.value = nextHour(elements.reservationStart.value); });
  elements.reservationForm.addEventListener('submit', saveReservation); elements.deleteReservationButton.addEventListener('click', deleteCurrentReservation); elements.reservationSearch.addEventListener('input', renderReservations);
  elements.reservationsCards.addEventListener('click', event => { const button = event.target.closest('[data-edit-reservation]'); if (button) openReservationDialog({ reservation: state.reservations.find(item => item.id === button.dataset.editReservation) }); });
  document.querySelectorAll('.nav-item[data-view]').forEach(button => button.addEventListener('click', () => switchView(button.dataset.view))); document.querySelectorAll('[data-layout]').forEach(button => button.addEventListener('click', () => setRoomLayout(button.dataset.layout)));
  elements.mobileMenu.addEventListener('click', () => { const open = elements.sidebar.classList.toggle('open'); elements.mobileMenu.setAttribute('aria-expanded', String(open)); });
  document.getElementById('addRoomButton').addEventListener('click', () => openRoomDialog()); elements.managementGrid.addEventListener('click', event => { const button = event.target.closest('[data-edit-room]'); if (button) openRoomDialog(roomById(button.dataset.editRoom)); });
  elements.roomForm.addEventListener('submit', saveRoom); elements.deleteRoomButton.addEventListener('click', deleteCurrentRoom); elements.studentRoomPicker.addEventListener('click', renderAvailability); elements.studentDate.addEventListener('change', resetStudentChoice);
  elements.availabilityBody.addEventListener('click', event => { const button = event.target.closest('[data-student-room]'); if (button) chooseStudentSlot(button.dataset.studentRoom, button.dataset.studentTime); });
  document.getElementById('closeAvailability').addEventListener('click', () => elements.availabilityDialog.close()); elements.studentForm.addEventListener('submit', saveStudentReservation);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && elements.scheduleDrawer.classList.contains('open')) closeDrawer(); });
}

function init() {
  elements.todayLabel.textContent = formatDate(toDateInput(new Date())); elements.selectedDate.value = state.selectedDate; elements.studentDate.min = toDateInput(new Date()); elements.studentDate.value = state.selectedDate;
  fillRoomOptions(); bindEvents(); renderAll(); setRoomLayout('grid'); if (sessionStorage.getItem(AUTH_KEY) === 'true') showAdmin(); else showAccess();
}

init();
