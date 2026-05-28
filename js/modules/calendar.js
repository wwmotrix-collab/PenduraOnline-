// ══════════════════════════════════════════════════
// PENDURA v2.1 — CALENDAR.JS
// Calendário de pagamentos e vencimentos
// ══════════════════════════════════════════════════

const Calendar = (() => {
  let state = {
    year:  new Date().getFullYear(),
    month: new Date().getMonth(),   // 0-indexed
    selectedDay: null,
    events: {}   // { 'YYYY-MM-DD': [{type, label, customer, amount}] }
  };

  const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                     'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const DAYS_PT   = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

  // ── EVENTOS ──────────────────────────────────────

  /**
   * Constrói mapa de eventos a partir de transações de TODOS os ledgers.
   * @param {Array} allTransactions  [{...tx, customerName}]
   * @param {Array} schedules        [{customer_id, due_date, amount, description, status}]
   */
  function buildEvents(allTransactions, schedules = []) {
    state.events = {};

    // Transações confirmadas (histórico)
    allTransactions.forEach(tx => {
      const dateStr = tx.created_at ? tx.created_at.slice(0, 10) : null;
      if (!dateStr) return;
      _addEvent(dateStr, {
        type:     tx.type === 'payment' ? 'paid' : 'purchase',
        label:    tx.description || (tx.type === 'payment' ? 'Pagamento' : 'Compra'),
        customer: tx.customerName || '—',
        amount:   tx.amount,
        status:   tx.status
      });
    });

    // Schedules (datas previstas de pagamento)
    schedules.forEach(s => {
      if (!s.due_date) return;
      const today    = new Date(); today.setHours(0,0,0,0);
      const dueDate  = new Date(s.due_date + 'T00:00:00');
      const isLate   = dueDate < today && s.status !== 'paid';
      const isPaid   = s.status === 'paid';
      _addEvent(s.due_date, {
        type:     isPaid ? 'paid' : isLate ? 'late' : 'upcoming',
        label:    s.description || 'Vencimento',
        customer: s.customerName || '—',
        amount:   s.amount,
        status:   s.status
      });
    });
  }

  function _addEvent(dateStr, ev) {
    if (!state.events[dateStr]) state.events[dateStr] = [];
    state.events[dateStr].push(ev);
  }

  // ── NAVEGAÇÃO ────────────────────────────────────
  function navigate(delta) {
    state.month += delta;
    if (state.month > 11) { state.month = 0;  state.year++; }
    if (state.month < 0)  { state.month = 11; state.year--; }
    state.selectedDay = null;
    render();
  }

  // ── RENDER GRID ──────────────────────────────────
  function render() {
    const labelEl = document.getElementById('cal-month-label');
    const gridEl  = document.getElementById('cal-grid');
    if (!labelEl || !gridEl) return;

    labelEl.textContent = `${MONTHS_PT[state.month]} ${state.year}`;

    const today     = new Date();
    const firstDay  = new Date(state.year, state.month, 1).getDay();
    const daysInMon = new Date(state.year, state.month + 1, 0).getDate();

    let html = DAYS_PT.map(d => `<div class="cal-day-header">${d}</div>`).join('');

    // Células vazias antes do dia 1
    for (let i = 0; i < firstDay; i++) {
      html += '<div class="cal-day"></div>';
    }

    for (let d = 1; d <= daysInMon; d++) {
      const dateStr = `${state.year}-${String(state.month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const evs     = state.events[dateStr] || [];

      const isToday    = today.getFullYear() === state.year &&
                         today.getMonth()    === state.month &&
                         today.getDate()     === d;
      const isSelected = state.selectedDay === dateStr;

      const hasPaid     = evs.some(e => e.type === 'paid');
      const hasUpcoming = evs.some(e => e.type === 'upcoming');
      const hasLate     = evs.some(e => e.type === 'late');

      const classes = [
        'cal-day',
        isToday    ? 'today'        : '',
        isSelected ? 'selected'     : '',
        hasLate    ? 'has-late'     : hasUpcoming ? 'has-upcoming' : hasPaid ? 'has-paid' : ''
      ].filter(Boolean).join(' ');

      html += `<div class="${classes}" onclick="App.calSelectDay('${dateStr}')">${d}</div>`;
    }

    gridEl.innerHTML = html;
    renderDayDetail(state.selectedDay);
  }

  // ── DETALHE DO DIA ───────────────────────────────
  function renderDayDetail(dateStr) {
    const titleEl = document.getElementById('cal-detail-title');
    const listEl  = document.getElementById('cal-detail-list');
    if (!listEl) return;

    if (!dateStr) {
      // Mostra próximos vencimentos
      if (titleEl) titleEl.textContent = 'Próximos vencimentos';
      const upcoming = _getUpcoming(7);
      listEl.innerHTML = upcoming.length
        ? upcoming.map(item => _eventCard(item)).join('')
        : '<div class="empty-state"><span>📅</span><p>Nenhum vencimento próximo.</p></div>';
      return;
    }

    const d    = new Date(dateStr + 'T00:00:00');
    const evs  = state.events[dateStr] || [];
    if (titleEl) {
      titleEl.textContent = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    }

    listEl.innerHTML = evs.length
      ? evs.map(e => _eventCard({ ...e, date: dateStr })).join('')
      : '<div class="empty-state"><span>🗓️</span><p>Nenhum evento neste dia.</p></div>';
  }

  function selectDay(dateStr) {
    state.selectedDay = state.selectedDay === dateStr ? null : dateStr;
    render();
  }

  // ── HELPERS ──────────────────────────────────────
  function _getUpcoming(days) {
    const today  = new Date(); today.setHours(0,0,0,0);
    const limit  = new Date(today.getTime() + days * 86400000);
    const result = [];

    Object.entries(state.events).forEach(([dateStr, evs]) => {
      const d = new Date(dateStr + 'T00:00:00');
      if (d >= today && d <= limit) {
        evs.forEach(e => result.push({ ...e, date: dateStr }));
      }
    });

    return result.sort((a, b) => a.date.localeCompare(b.date));
  }

  function _typeLabel(type) {
    const map = { paid: '✅ Pago', upcoming: '⏳ Pendente', late: '🔴 Atrasado', purchase: '🛒 Compra' };
    return map[type] || type;
  }

  function _typeClass(type) {
    const map = { paid: 'confirmed', upcoming: 'pending', late: 'contested', purchase: 'pending' };
    return map[type] || 'pending';
  }

  function _formatCurrency(v) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
  }

  function _eventCard(item) {
    const dateLabel = item.date
      ? new Date(item.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
      : '';
    return `
      <div class="tx-item tx-${item.type === 'paid' || item.type === 'purchase' ? 'payment' : 'purchase'}">
        <div class="tx-icon">${item.type === 'paid' ? '✅' : item.type === 'late' ? '🔴' : '⏳'}</div>
        <div class="tx-info">
          <div class="tx-desc">${item.label}</div>
          <div class="tx-date">${item.customer}${dateLabel ? ' · ' + dateLabel : ''}</div>
          <span class="tx-status-pill ${_typeClass(item.type)}">${_typeLabel(item.type)}</span>
        </div>
        <div class="tx-amount-col">
          <div class="tx-amount" style="color:${item.type === 'paid' ? 'var(--green-bright)' : item.type === 'late' ? 'var(--red)' : 'var(--amber)'}">
            ${_formatCurrency(item.amount)}
          </div>
        </div>
      </div>`;
  }

  // ── API PÚBLICA ──────────────────────────────────
  return { buildEvents, navigate, render, renderDayDetail, selectDay };
})();
