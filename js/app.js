// ══════════════════════════════════════════════════
// PENDURA v2.1.4 — APP.JS
// ══════════════════════════════════════════════════

const App = (() => {

  const S = {
    merchant: null, customer: null, ledger: null,
    transactions: [], allCustomers: [], allLedgers: [],
    confirmTx: null, quickType: null, payMethod: 'dinheiro',
    ledgerFilter: 'all', ledgerTab: 'history',
    confResult: null, photoFile: null, photoDataUrl: null,
    pickerResults: [],
  };

  const fmt = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
  const normalizePhone = p => (p || '').replace(/\D/g, '');
  const fmtPhone = p => {
    const d = (p || '').replace(/\D/g, '');
    if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
    return p;
  };
  const fmtDate = iso => {
    try {
      const d = new Date(iso), now = new Date(), diff = now - d;
      if (diff < 60000)     return 'Agora mesmo';
      if (diff < 3600000)   return `${Math.floor(diff/60000)} min atrás`;
      if (diff < 86400000)  return `${Math.floor(diff/3600000)}h atrás`;
      if (diff < 172800000) return 'Ontem';
      return d.toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' });
    } catch { return ''; }
  };

  // ── INIT ─────────────────────────────────────────
  async function init() {
    initSupabase();
    const params = _parseUrlParams();
    await _sleep(1400);
    const splash = document.getElementById('splash');
    splash.classList.add('fade-out');
    await _sleep(500);
    splash.classList.add('hidden');

    const isDeepLink = params.customerId || params.accessPhone;
    if (isDeepLink) { await _handleDeepLink(params); return; }

    const session = loadSession();
    if (session) { await _restoreSession(session); return; }
    showScreen('login');
  }

  document.addEventListener('DOMContentLoaded', init);

  // ── NAVEGAÇÃO ────────────────────────────────────
  // FIX: tab listeners adicionados apenas uma vez via flag
  let _tabListenersBound = false;
  function showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const el = document.getElementById('screen-' + name);
    if (el) {
      el.classList.remove('hidden');
      el.querySelectorAll('.scroll-area').forEach(a => { a.scrollTop = 0; });
    }
    if (!_tabListenersBound) {
      _tabListenersBound = true;
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
          document.getElementById('tab-' + btn.dataset.tab)?.classList.remove('hidden');
        });
      });
    }
  }

  function goBackToDashboard() {
    if (S.merchant) { _loadMerchantDashboard(); showScreen('merchant-dashboard'); }
    else showScreen('login');
  }

  // ── LOGIN ─────────────────────────────────────────
  async function loginMerchant() {
    const phone = normalizePhone(_val('merchant-phone'));
    const password = _val('merchant-password');
    if (!phone || phone.length < 10) { toast('📱 Telefone inválido', 'error'); return; }
    if (!password || password.length < 4) { toast('🔑 Mínimo 4 caracteres', 'error'); return; }

    showLoading('Entrando...');
    try {
      if (DEMO_MODE) {
        await _sleep(500);
        let m = DB.merchant;
        if (!m || m.phone !== phone) { m = { id: 'demo-' + phone, name: '', phone, created_at: new Date().toISOString() }; DB.merchant = m; }
        hideLoading();
        await _enterMerchant(m);
        return;
      }

      const { data: m, error } = await dbGetMerchantByPhone(phone);
      if (!m || error) {
        hideLoading();
        toast('❌ Comerciante não encontrado', 'error');
        return;
      }
      if (m.password_hash !== simpleHash(password)) {
        hideLoading();
        toast('❌ Senha incorreta', 'error');
        return;
      }

      hideLoading();
      await _enterMerchant(m);
    } catch (e) {
      console.error('[Pendura] loginMerchant:', e);
      hideLoading();
      toast('❌ Erro ao entrar. Recarregue e tente novamente.', 'error');
    }
  }

  async function loginCustomer() {
    const phone = normalizePhone(_val('customer-phone'));
    if (!phone || phone.length < 10) { toast('📱 Digite seu telefone', 'error'); return; }

    const hint = document.getElementById('customer-login-hint');
    if (hint) hint.style.display = 'none';

    showLoading('Buscando sua pendura...');
    try {
      if (DEMO_MODE && (!DB.merchant || !DB.customers.length)) seedDemo(DB.merchant?.id || 'demo-merchant-default');

      const { data: results, error } = await dbFindCustomerByPhone(phone);
      if (error || !results || results.length === 0) {
        hideLoading();
        toast('❌ Nenhuma pendura encontrada', 'error');
        if (hint) { hint.textContent = 'Nenhuma pendura encontrada. Peça ao comerciante um link de acesso.'; hint.style.display = 'block'; }
        return;
      }

      hideLoading();
      if (results.length === 1) await _enterCustomer(results[0].customer, results[0].merchant, results[0].ledger);
      else _showMerchantPicker(results);
    } catch (e) {
      console.error('[Pendura] loginCustomer:', e);
      hideLoading();
      toast('❌ Erro ao buscar sua pendura. Recarregue e tente novamente.', 'error');
    }
  }

  async function registerMerchant() {
    const name = _val('reg-name').trim();
    const phone = normalizePhone(_val('reg-phone'));
    const password = _val('reg-password');
    if (!name) { toast('🏪 Nome obrigatório', 'error'); return; }
    if (!phone || phone.length < 10) { toast('📱 Telefone inválido', 'error'); return; }
    if (!password || password.length < 4) { toast('🔑 Mínimo 4 caracteres', 'error'); return; }
    showLoading('Criando caderneta...');
    const { data: m, error } = await dbCreateMerchant(name, phone, simpleHash(password));
    hideLoading();
    if (error) { toast('❌ Erro. Tente outro telefone.', 'error'); return; }
    toast('🎉 Caderneta criada!', 'success');
    await _enterMerchant(m);
  }

  // ── SESSÕES ──────────────────────────────────────
  async function _enterMerchant(merchant) {
    hideLoading();
    let profile = MerchantProfile.load(merchant.id);
    if (!profile) {
      profile = MerchantProfile.createFromMerchant(merchant);
      if (merchant.name) profile.business_name = merchant.name;
      await MerchantProfile.save(profile);
    }
    merchant.profile = profile;
    S.merchant = merchant;
    saveSession('merchant', merchant);
    if (DEMO_MODE) { DB.merchant = merchant; seedDemo(merchant.id); }
    _updateMerchantHeader();
    await _loadMerchantDashboard();
    showScreen('merchant-dashboard');
    if (!MerchantProfile.isComplete(profile)) setTimeout(() => openProfileModal(true), 700);
  }

  async function _enterCustomer(customer, merchant, ledger) {
    // FIX: hideLoading antes de qualquer await para não travar a tela
    hideLoading();

    if (!merchant && DEMO_MODE) merchant = DB.merchant;
    if (!merchant) merchant = { id: customer.merchant_id || 'unknown', name: 'Comércio', phone: '' };

    if (!ledger) {
      if (DEMO_MODE) {
        ledger = DB.ledgers.find(l => l.customer_id === customer.id) || null;
      } else if (customer?.id && merchant?.id && merchant.id !== 'unknown') {
        try {
          const { data: fl } = await dbGetLedger(merchant.id, customer.id);
          ledger = fl || null;
        } catch(e) { ledger = null; }
      }
    }
    if (!ledger) ledger = { id: null, merchant_id: merchant.id, customer_id: customer.id, balance: 0 };

    S.customer = customer;
    S.merchant = merchant;
    S.ledger = ledger;

    const profile = merchant.profile
      || (merchant.id && merchant.id !== 'unknown' ? MerchantProfile.load(merchant.id) : null)
      || MerchantProfile.createFromMerchant(merchant);
    if (!profile.business_name && merchant.name) profile.business_name = merchant.name;
    merchant.profile = profile;

    saveSession('customer', { customer, merchant, ledger });

    const merchantName = MerchantProfile.displayName(profile);
    _setTxt('customer-name-display', customer.name);
    _setTxt('customer-merchant-display', merchantName);
    _setTxt('customer-merchant-name', merchantName);
    _setTxt('customer-wp-btn', `💬 Falar com ${merchantName}`);
    const av = document.getElementById('customer-avatar');
    if (av) av.textContent = (customer.name || 'CL').slice(0,2).toUpperCase();

    // FIX: showScreen ANTES de _loadCustomerDashboard para não travar na tela branca
    showScreen('customer-dashboard');
    await _loadCustomerDashboard();
  }

  async function _restoreSession(session) {
    if (session.type === 'merchant') await _enterMerchant(session.data);
    else if (session.type === 'customer') {
      const { customer, merchant, ledger } = session.data;
      await _enterCustomer(customer, merchant, ledger);
    } else showScreen('login');
  }

  function logout() {
    clearSession();
    Object.assign(S, { merchant: null, customer: null, ledger: null,
      transactions: [], allCustomers: [], allLedgers: [], confResult: null, pickerResults: [] });
    showScreen('login');
  }

  // ── DEEP LINK ────────────────────────────────────
  async function _handleDeepLink(params) {
    showLoading('Carregando sua pendura...');
    try {
      if (params.accessPhone) {
        const phone = params.accessPhone.replace(/\D/g, '');
        const { data: results, error } = await dbFindCustomerByPhone(phone, params.merchantId || null);
        hideLoading();
        if (error || !results || results.length === 0) { toast('❌ Pendura não encontrada.', 'error'); showScreen('login'); return; }
        if (results.length === 1) {
          await _enterCustomer(results[0].customer, results[0].merchant, results[0].ledger);
          if (params.confirmTxId) {
            const _dtxs = DEMO_MODE ? DB.transactions : ((await dbGetTransactions(S.ledger?.id || '')).data || []);
            const tx = _dtxs.find(t => t.id === params.confirmTxId);
            if (tx?.status === 'pending') setTimeout(() => _openConfirmModal(tx), 500);
          }
        } else { _showMerchantPicker(results); }
        return;
      }
      if (params.customerId) {
        const { data: customer } = await dbGetCustomerById(params.customerId);
        if (!customer) { hideLoading(); showScreen('login'); return; }
        const merchant = customer.merchants || DB.merchant;
        let ledger = DEMO_MODE ? (DB.ledgers.find(l => l.id === params.ledgerId || l.customer_id === params.customerId) || null) : null;
        if (!ledger) { const { data } = await dbGetLedger(customer.merchant_id, params.customerId); ledger = data || null; }
        hideLoading();
        await _enterCustomer(customer, merchant, ledger);
        if (params.confirmTxId && S.ledger?.id) {
          const { data: _txList } = await dbGetTransactions(S.ledger.id);
          const _confirmTx = (_txList || []).find(t => t.id === params.confirmTxId);
          if (_confirmTx?.status === 'pending') setTimeout(() => _openConfirmModal(_confirmTx), 500);
        }
        return;
      }
      hideLoading(); showScreen('login');
    } catch (e) { console.error('[Pendura] deepLink:', e); hideLoading(); showScreen('login'); }
  }

  // ── PICKER DE MÚLTIPLOS COMÉRCIOS ────────────────
  // FIX DEFINITIVO: onclick inline simples com índice numérico.
  // Sem addEventListener, sem delegation, sem cloneNode.
  // O onclick inline chama uma função global _PENDURA_PICK(idx)
  // que lê S.pickerResults — o caminho mais direto possível.
  window._PENDURA_PICK = async function(idx) {
    const item = S.pickerResults[idx];
    if (!item) { App.toast('❌ Pendura não encontrada', 'error'); return; }
    App.showLoading('Carregando...');
    try {
      await _enterCustomer(item.customer, item.merchant, item.ledger);
    } catch(e) {
      console.error('[Pendura] pick:', e);
      App.hideLoading();
      App.toast('❌ ' + (e.message || 'Erro'), 'error');
    }
  };

  function _showMerchantPicker(results) {
    S.pickerResults = results;
    const list = document.getElementById('merchant-picker-list');
    const text = document.getElementById('picker-found-text');
    if (!list) return;

    if (text) text.textContent = results.length > 1
      ? `Encontramos sua pendura em ${results.length} comércios`
      : 'Encontramos sua pendura!';

    list.innerHTML = results.map(({ customer, merchant, ledger }, idx) => {
      const profile = MerchantProfile.load(merchant?.id) || MerchantProfile.createFromMerchant(merchant || {});
      const mName   = MerchantProfile.displayName(profile);
      const balance = ledger?.balance || 0;
      const balClass = balance < 0 ? 'credit' : balance === 0 ? 'zero' : '';
      const balText  = balance < 0 ? '🎁 Crédito' : balance === 0 ? '✅ Zerado' : fmt(balance);
      const initials = mName.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
      // onclick inline chama função global — funciona em qualquer contexto mobile
      return `<div class="merchant-picker-card" onclick="_PENDURA_PICK(${idx})" style="cursor:pointer">
        <div class="mpc-avatar">${initials}</div>
        <div class="mpc-info">
          <h4 style="pointer-events:none">${mName}</h4>
          <p style="pointer-events:none">${customer.name}</p>
        </div>
        <div class="mpc-balance ${balClass}" style="pointer-events:none">${balText}</div>
      </div>`;
    }).join('');

    showScreen('merchant-picker');
  }

  // ── DASHBOARD COMERCIANTE ────────────────────────
  function _updateMerchantHeader() {
    const p = S.merchant?.profile;
    _setTxt('merchant-name-display', p ? MerchantProfile.displayName(p) : 'Meu Comércio');
    _setTxt('merchant-phone-display', p && MerchantProfile.waPhone(p) ? fmtPhone(MerchantProfile.waPhone(p)) : 'Configure →');
    const av = document.getElementById('merchant-avatar-initials');
    if (av) av.textContent = p ? MerchantProfile.initials(p) : 'M';
  }

  async function _loadMerchantDashboard() {
    const mid = S.merchant.id;
    const [{ data: custs }, { data: ledgers }] = await Promise.all([dbGetCustomers(mid), dbGetLedgersForMerchant(mid)]);
    S.allCustomers = custs || [];
    S.allLedgers   = ledgers || [];

    let totalPending = 0, pendingConf = 0, todayPay = 0;
    const today = new Date().toDateString();
    for (const l of S.allLedgers) {
      if (l.balance > 0) totalPending += l.balance;
      const txSource = DEMO_MODE ? DB.transactions.filter(t => t.ledger_id === l.id) : ((await dbGetTransactions(l.id)).data || []);
      pendingConf += txSource.filter(t => t.status === 'pending').length;
      todayPay    += txSource.filter(t => t.type === 'payment' && t.status === 'confirmed' && new Date(t.created_at).toDateString() === today).reduce((s, t) => s + t.amount, 0);
    }

    _setTxt('total-pending', fmt(totalPending));
    _setTxt('total-customers-count', `${S.allCustomers.length} cliente${S.allCustomers.length !== 1 ? 's' : ''}`);
    _setTxt('pending-confirmations', pendingConf);
    _setTxt('today-payments', fmt(todayPay).replace('R$\u00a0','R$'));

    const badge = document.getElementById('pending-conf-badge');
    if (badge) { badge.textContent = `⏳ ${pendingConf} pendente${pendingConf !== 1 ? 's' : ''}`; badge.style.display = pendingConf > 0 ? '' : 'none'; }

    // FIX calendário: schedules derivados das transações com due_date
    const schedules = DEMO_MODE ? (DB.schedules || []) : ((await dbGetSchedules(mid)).data || []);
    const upcoming  = schedules.filter(s => s.status !== 'paid').length;
    // FIX: contar também transações com due_date pendente
    const txWithDue = S.allLedgers.length > 0 ? (() => {
      if (DEMO_MODE) return DB.transactions.filter(t => t.due_date && t.status === 'pending').length;
      return 0;
    })() : 0;
    _setTxt('next-due-count', (upcoming + txWithDue) || '—');

    _renderCustomersList(S.allCustomers);
  }

  function _renderCustomersList(customers) {
    const el = document.getElementById('customers-list');
    if (!el) return;
    if (!customers.length) { el.innerHTML = '<div class="empty-state"><span>📋</span><p>Nenhum cliente ainda.</p></div>'; return; }

    el.innerHTML = customers.map((c, i) => {
      const l = S.allLedgers.find(l => l.customer_id === c.id);
      const balance = l ? l.balance : 0;
      const _txCache = DEMO_MODE ? DB.transactions : [];
      const pending = _txCache.filter(t => l && t.ledger_id === l.id && t.status === 'pending');
      const txs = _txCache.filter(t => l && t.ledger_id === l.id);
      const conf = Confidence.calculate(txs, l, c);
      const balClass = balance < 0 ? 'credit' : balance === 0 ? 'zero' : 'debt';
      const balText = balance < 0 ? `🎁 +${fmt(Math.abs(balance))}` : balance === 0 ? '✅ Zerado' : fmt(balance);
      const initials = c.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
      // onclick inline — mesmo padrão confiável do picker
      return `<div class="customer-card${pending.length ? ' has-pending' : ''}"
                   onclick="App.openLedger('${c.id}')"
                   style="animation-delay:${i*40}ms">
        <div class="cc-avatar">${initials}</div>
        <div class="cc-info">
          <h4>${c.name}</h4>
          <p>${fmtPhone(c.phone)}</p>
          ${conf.score > 0 ? `<p class="cc-conf">${conf.badge.icon} ${conf.badge.label}</p>` : ''}
        </div>
        <div class="cc-balance">
          <div class="cc-amount ${balClass}">${balText}</div>
          ${pending.length ? `<div class="cc-pending-pill">⏳ ${pending.length} pendente${pending.length>1?'s':''}</div>` : ''}
        </div>
      </div>`;
    }).join('');

    el.querySelectorAll('.customer-card').forEach((card, i) => FX.slideIn(card, i * 50));
  }

  function filterCustomers(q) {
    const filtered = S.allCustomers.filter(c => c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q.replace(/\D/g,'')));
    _renderCustomersList(filtered);
  }

  // ── NOVO CLIENTE ─────────────────────────────────
  function toggleCreditLimit(checked) { document.getElementById('cust-limit-fields')?.classList.toggle('hidden', !checked); }

  async function createCustomer() {
    const name  = _val('cust-name').trim();
    const phone = normalizePhone(_val('cust-phone'));
    if (!name)                       { toast('👤 Nome obrigatório', 'error'); return; }
    if (!phone || phone.length < 10) { toast('📱 WhatsApp inválido', 'error'); return; }
    const profile = S.merchant?.profile;
    if (!MerchantProfile.isComplete(profile)) { toast('⚠️ Configure seu comércio primeiro', 'warning'); setTimeout(() => openProfileModal(true), 400); return; }
    const limitToggle = document.getElementById('cust-limit-toggle');
    const limitTotal  = limitToggle?.checked ? parseFloat(_val('cust-limit-total')) || null : null;
    const limitVis    = document.getElementById('cust-limit-visible')?.checked ?? true;
    showLoading('Adicionando cliente...');
    const { data: c, error } = await dbCreateCustomer(S.merchant.id, name, phone, limitTotal, limitVis);
    if (error) { hideLoading(); toast('❌ ' + (error.message || 'Erro ao criar cliente'), 'error'); return; }
    const { data: l } = await dbGetLedger(S.merchant.id, c.id);
    hideLoading();
    toast(`✅ ${name} adicionado!`, 'success');
    FX.celebrate('confirm');
    _setVal('cust-name', ''); _setVal('cust-phone', '');
    await _loadMerchantDashboard();
    setTimeout(() => {
      if (confirm(`Enviar link de acesso para ${name} pelo WhatsApp?`)) {
        WA.welcome(phone, MerchantProfile.displayName(profile), MerchantProfile.waPhone(profile), c.id, l?.id || '', S.merchant?.id);
      }
      showScreen('merchant-dashboard');
    }, 300);
  }

  // ── CANAL PRIVADO ─────────────────────────────────
  async function openLedger(customerId) {
    const c = S.allCustomers.find(c => c.id === customerId);
    const l = S.allLedgers.find(l => l.customer_id === customerId);
    if (!c || !l) return;
    S.customer = c; S.ledger = l;
    _setTxt('ledger-customer-name', c.name);
    _setTxt('ledger-customer-phone', fmtPhone(c.phone));
    const balance = await recalcBalance(l.id);
    S.ledger.balance = balance;
    _refreshBalanceUI(balance, 'ledger-balance', 'balance-label-text');
    _renderLimitBar(c, balance);
    await _loadLedgerTransactions();
    showScreen('ledger');
    setTimeout(() => { S.confResult = Confidence.calculate(S.transactions, l, c); Confidence.renderPill(S.confResult); }, 300);
  }

  function _renderLimitBar(customer, balance) {
    const wrap = document.getElementById('ledger-limit-bar');
    if (!wrap) return;
    if (!customer.limit_total) { wrap.classList.add('hidden'); return; }
    wrap.classList.remove('hidden');
    const pct = Math.min(100, Math.max(0, (balance / customer.limit_total) * 100));
    const fill = document.getElementById('limit-bar-fill');
    const usedLbl = document.getElementById('limit-used-label');
    const totLbl  = document.getElementById('limit-total-label');
    if (fill) { fill.style.width = '0%'; setTimeout(() => FX.animateBar(fill, pct), 200); }
    if (usedLbl) usedLbl.textContent = fmt(Math.max(0, balance));
    if (totLbl)  totLbl.textContent  = `limite ${fmt(customer.limit_total)}`;
    if (fill) fill.style.background = pct > 85 ? 'linear-gradient(90deg,var(--amber),var(--red))' : 'linear-gradient(90deg,var(--green),var(--gold-bright))';
  }

  async function _loadLedgerTransactions() {
    const { data } = await dbGetTransactions(S.ledger.id);
    S.transactions = data || [];
    _renderTransactions(S.ledgerFilter);
  }

  function _renderTransactions(filter) {
    const el = document.getElementById('ledger-transactions');
    if (!el) return;
    let txs = S.transactions;
    if (filter === 'pending')  txs = txs.filter(t => t.status === 'pending');
    if (filter === 'purchase') txs = txs.filter(t => t.type === 'purchase');
    if (filter === 'payment')  txs = txs.filter(t => t.type === 'payment');
    if (!txs.length) { el.innerHTML = '<div class="empty-state"><span>📝</span><p>Nenhum lançamento.</p></div>'; return; }
    const statusLabels = { pending: '⏳ Aguardando', confirmed: '✅ Confirmado', contested: '❌ Contestado', cancelled: '🚫 Cancelado' };
    el.innerHTML = txs.map((tx, i) => {
      const isPurchase = tx.type === 'purchase';
      const desc = tx.description || (isPurchase ? 'Compra' : 'Pagamento');
      const dueStr = tx.due_date ? `📅 Prazo: ${new Date(tx.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}` : '';
      const isLate = tx.due_date && tx.status === 'pending' && new Date(tx.due_date + 'T00:00:00') < new Date();
      return `<div class="tx-item tx-${tx.type}" style="animation-delay:${i*40}ms">
        <div class="tx-icon">${isPurchase ? '🛒' : '💰'}</div>
        <div class="tx-info">
          <div class="tx-desc">${desc}</div>
          <div class="tx-date">${fmtDate(tx.created_at)}</div>
          ${dueStr ? `<div class="tx-due-date${isLate?' overdue':''}">${dueStr}${isLate?' 🔴':''}</div>` : ''}
          <span class="tx-status-pill ${tx.status}">${statusLabels[tx.status]||tx.status}</span>
          ${tx.status === 'pending' ? `<button class="tx-wa-btn" onclick="App.notifyPending('${tx.id}')">💬 Notificar</button>` : ''}
          ${tx.attachment_url ? `<button class="tx-photo-btn" onclick="App.viewPhoto('${tx.attachment_url.replace(/'/g,"\\'")}')">🖼️ Ver foto</button>` : ''}
        </div>
        <div class="tx-amount-col">
          <div class="tx-amount">${isPurchase ? '+' : '-'} ${fmt(tx.amount)}</div>
        </div>
      </div>`;
    }).join('');
  }

  function filterLedger(f, btn) {
    S.ledgerFilter = f;
    document.querySelectorAll('.fc').forEach(b => b.classList.remove('active'));
    btn?.classList.add('active');
    _renderTransactions(f);
  }

  function switchLedgerTab(tab, btn) {
    S.ledgerTab = tab;
    document.querySelectorAll('.lt-tab').forEach(b => b.classList.remove('active'));
    btn?.classList.add('active');
    document.getElementById('ltab-history')?.classList.toggle('hidden', tab !== 'history');
    document.getElementById('ltab-insight')?.classList.toggle('hidden', tab !== 'insight');
    if (tab === 'insight') {
      if (!S.confResult) S.confResult = Confidence.calculate(S.transactions, S.ledger, S.customer);
      Confidence.renderInsightTab(S.confResult, S.customer, S.transactions);
    }
  }

  // ── TRANSAÇÕES ───────────────────────────────────
  function _merchantName() { return S.merchant?.profile ? MerchantProfile.displayName(S.merchant.profile) : '—'; }
  function _merchantPhone() { return S.merchant?.profile ? MerchantProfile.waPhone(S.merchant.profile) : ''; }
  function currentCustomerId() { return S.customer?.id || null; }

  // Modal de compra unificado
  function openPurchaseFromDashboard() { _preparePurchaseModal(null); }

  function _preparePurchaseModal(contextCustomerId) {
    _setVal('purchase-amount', ''); _setVal('purchase-desc', ''); _setVal('purchase-due-date', '');
    S.photoFile = null; S.photoDataUrl = null;
    const wrap = document.getElementById('photo-preview-wrap');
    if (wrap) wrap.classList.add('hidden');
    const img = document.getElementById('photo-preview-img');
    if (img) img.src = '';
    const pname = document.getElementById('photo-preview-name');
    if (pname) pname.textContent = '';
    ['purchase-photo-camera','purchase-photo-gallery'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

    let selWrap = document.getElementById('purchase-customer-wrap');
    if (!selWrap) {
      selWrap = document.createElement('div');
      selWrap.id = 'purchase-customer-wrap';
      selWrap.className = 'field-group';
      selWrap.innerHTML = `<label>Cliente</label>
        <select id="purchase-customer-select" class="field-select" onchange="App.updatePurchaseWaPreview()">
          <option value="">— escolha o cliente —</option>
        </select>`;
      const body = document.querySelector('#modal-purchase .modal-body');
      if (body) body.insertBefore(selWrap, body.firstChild);
    }

    const sel = document.getElementById('purchase-customer-select');
    if (contextCustomerId) {
      selWrap.style.display = 'none';
      if (sel) sel.value = contextCustomerId;
    } else {
      selWrap.style.display = '';
      if (sel) {
        sel.innerHTML = '<option value="">— escolha o cliente —</option>';
        S.allCustomers.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.name; sel.appendChild(o); });
        sel.value = '';
      }
    }
    updatePurchaseWaPreview();
    showModal('modal-purchase');
  }

  function updatePurchaseWaPreview() {
    const selEl = document.getElementById('purchase-customer-select');
    const cid = selEl?.value || (S.customer?.id) || '';
    const amount = parseFloat(_val('purchase-amount')) || 0;
    const desc = _val('purchase-desc');
    const bubble = document.getElementById('purchase-wa-bubble');
    if (!bubble) return;
    const c = cid ? S.allCustomers.find(c => c.id === cid) : S.customer;
    if (c) bubble.innerHTML = WA.previewPurchase(_merchantName(), c.name, amount, desc);
    else bubble.innerHTML = '<p>📒 <b>Pendura Online</b></p><p>Selecione um cliente...</p>';
  }

  async function createTransaction(type) {
    const amtId  = type === 'purchase' ? 'purchase-amount' : 'payment-amount';
    const descId = type === 'purchase' ? 'purchase-desc'   : 'payment-desc';
    const dueId  = type === 'purchase' ? 'purchase-due-date' : null;

    if (type === 'purchase') {
      const selEl = document.getElementById('purchase-customer-select');
      const selCid = selEl?.value;
      if (selCid && selCid !== S.customer?.id) {
        const c = S.allCustomers.find(c => c.id === selCid);
        const l = S.allLedgers.find(l => l.customer_id === selCid);
        if (!c || !l) { toast('❌ Cliente não encontrado', 'error'); return; }
        S.customer = c; S.ledger = l;
      } else if (!selCid && !S.customer) { toast('👤 Selecione um cliente', 'error'); return; }
    }

    const amount = parseFloat(_val(amtId));
    const desc   = _val(descId).trim();
    const due    = dueId ? (_val(dueId) || null) : null;
    if (!amount || amount <= 0) { toast('💵 Valor inválido', 'error'); return; }

    showLoading(type === 'purchase' ? 'Lançando compra...' : 'Registrando pagamento...');
    const { data: tx, error } = await dbCreateTransaction(S.ledger.id, type, amount, desc, 'merchant', due);
    if (error) { hideLoading(); toast('❌ Erro', 'error'); return; }

    if (type === 'purchase' && S.photoFile) {
      try { const url = await dbSaveAttachment(tx.id, S.photoFile); if (url) { await dbUpdateTransactionAttachment(tx.id, url); tx.attachment_url = url; } } catch(e) {}
      S.photoFile = null; S.photoDataUrl = null;
      const w = document.getElementById('photo-preview-wrap'); if (w) w.classList.add('hidden');
      ['purchase-photo-camera','purchase-photo-gallery'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    }

    if (type === 'payment') { await dbUpdateTransactionStatus(tx.id, 'confirmed', 'merchant'); tx.status = 'confirmed'; }

    const newBalance = await recalcBalance(S.ledger.id);
    S.ledger.balance = newBalance;
    _refreshBalanceUI(newBalance, 'ledger-balance', 'balance-label-text');
    _renderLimitBar(S.customer, newBalance);
    await _loadLedgerTransactions();
    closeModal(type === 'purchase' ? 'modal-purchase' : 'modal-payment');
    _setVal(amtId, ''); _setVal(descId, '');
    await _loadMerchantDashboard();
    hideLoading();

    if (type === 'payment') {
      FX.celebrate('payment'); FX.vibrate([30,30,60]); toast('✅ Pagamento registrado!', 'success');
      setTimeout(() => WA.paymentReceipt(S.customer.phone, _merchantName(), amount, newBalance), 600);
    } else {
      FX.celebrate('purchase'); toast('✅ Compra lançada!', 'success');
      setTimeout(() => WA.purchase(S.customer.phone, _merchantName(), amount, desc, tx.id, S.customer.id, S.merchant?.id), 600);
    }
  }

  async function createTransactionOnly() {
    const amount = parseFloat(_val('purchase-amount'));
    const desc   = _val('purchase-desc').trim();
    const due    = _val('purchase-due-date') || null;
    // Resolve cliente se veio do dashboard
    const selEl = document.getElementById('purchase-customer-select');
    const selCid = selEl?.value;
    if (selCid && selCid !== S.customer?.id) {
      const c = S.allCustomers.find(c => c.id === selCid);
      const l = S.allLedgers.find(l => l.customer_id === selCid);
      if (!c || !l) { toast('❌ Cliente não encontrado', 'error'); return; }
      S.customer = c; S.ledger = l;
    }
    if (!amount || amount <= 0) { toast('💵 Valor inválido', 'error'); return; }
    showLoading('Lançando...');
    const { data: tx } = await dbCreateTransaction(S.ledger.id, 'purchase', amount, desc, 'merchant', due);
    if (tx && S.photoFile) {
      try { const url = await dbSaveAttachment(tx.id, S.photoFile); if (url) await dbUpdateTransactionAttachment(tx.id, url); } catch(e) {}
      S.photoFile = null; S.photoDataUrl = null;
      const w = document.getElementById('photo-preview-wrap'); if (w) w.classList.add('hidden');
    }
    await _loadLedgerTransactions();
    closeModal('modal-purchase'); _setVal('purchase-amount',''); _setVal('purchase-desc','');
    hideLoading(); toast('✅ Lançado (sem notificação)', 'success'); FX.celebrate('purchase');
  }

  async function createPaymentOnly() {
    const amount = parseFloat(_val('payment-amount'));
    if (!amount || amount <= 0) { toast('💵 Valor inválido', 'error'); return; }
    showLoading('Registrando...');
    const { data: tx } = await dbCreateTransaction(S.ledger.id, 'payment', amount, '', 'merchant');
    await dbUpdateTransactionStatus(tx.id, 'confirmed', 'merchant');
    const newBalance = await recalcBalance(S.ledger.id);
    S.ledger.balance = newBalance;
    _refreshBalanceUI(newBalance, 'ledger-balance', 'balance-label-text');
    await _loadLedgerTransactions();
    closeModal('modal-payment'); _setVal('payment-amount','');
    hideLoading(); FX.celebrate('payment'); toast('✅ Pagamento registrado', 'success');
  }

  function updatePaymentPreview() {
    const amount = parseFloat(_val('payment-amount')) || 0;
    const balance = S.ledger?.balance || 0;
    const wrap = document.getElementById('partial-preview');
    if (!wrap) return;
    if (amount > 0 && balance > 0) {
      wrap.style.display = '';
      const remaining = balance - amount;
      const pct = Math.min(100, Math.max(0, (amount / balance) * 100));
      FX.animateBar(document.getElementById('pp-fill'), pct, 400);
      const lbl = document.getElementById('pp-label');
      if (lbl) lbl.textContent = remaining > 0 ? `Saldo restante: ${fmt(remaining)}` : remaining < 0 ? `Crédito: ${fmt(Math.abs(remaining))} 🎁` : 'Saldo zerado! 🎉';
    } else { wrap.style.display = 'none'; }
  }

  function notifyPending(txId) {
    const tx = S.transactions.find(t => t.id === txId);
    if (!tx) return;
    WA.confirmationRequest(S.customer.phone, _merchantName(), tx.id, S.customer.id, tx.type, tx.amount, tx.description, S.merchant?.id);
  }

  // ── QUICK LAUNCH (só pagamento) ───────────────────
  function showQuickLaunch(type) {
    if (type === 'purchase') { openPurchaseFromDashboard(); return; }
    S.quickType = 'payment';
    _setTxt('quick-launch-title', '💰 Registrar Pagamento');
    const sel = document.getElementById('quick-customer-select');
    if (sel) {
      sel.innerHTML = '<option value="">— escolha o cliente —</option>';
      S.allCustomers.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.name; sel.appendChild(o); });
    }
    _setVal('quick-amount',''); _setVal('quick-desc','');
    updateQuickWaPreview();
    showModal('modal-quick-launch');
  }

  function updateQuickWaPreview() {
    const cid = _val('quick-customer-select');
    const amount = parseFloat(_val('quick-amount')) || 0;
    const bubble = document.getElementById('quick-wa-bubble');
    if (!bubble) return;
    if (!cid) { bubble.innerHTML = '<p>Selecione um cliente...</p>'; return; }
    const c = S.allCustomers.find(c => c.id === cid);
    bubble.innerHTML = WA.previewPayment(_merchantName(), c?.name, amount);
  }

  async function submitQuickLaunch() {
    const cid    = _val('quick-customer-select');
    const amount = parseFloat(_val('quick-amount'));
    const desc   = _val('quick-desc').trim();
    if (!cid)                   { toast('👤 Selecione um cliente', 'error'); return; }
    if (!amount || amount <= 0) { toast('💵 Valor inválido', 'error'); return; }
    const c = S.allCustomers.find(c => c.id === cid);
    const l = S.allLedgers.find(l => l.customer_id === cid);
    if (!c || !l) { toast('❌ Canal não encontrado', 'error'); return; }
    S.customer = c; S.ledger = l;
    showLoading('Registrando pagamento...');
    const { data: tx, error: txError } = await dbCreateTransaction(l.id, 'payment', amount, desc, 'merchant', null);
    if (txError) { hideLoading(); toast('❌ ' + (txError.message || 'Erro'), 'error'); return; }
    await dbUpdateTransactionStatus(tx.id, 'confirmed', 'merchant');
    const newBalance = await recalcBalance(l.id);
    await _loadMerchantDashboard();
    closeModal('modal-quick-launch');
    hideLoading();
    FX.celebrate('payment');
    toast('✅ Pagamento registrado!', 'success');
    setTimeout(() => WA.paymentReceipt(c.phone, _merchantName(), amount, newBalance), 600);
  }

  // ── WA ───────────────────────────────────────────
  function openWhatsAppCustomer() { if (S.customer) WA.open(S.customer.phone, `Olá, *${S.customer.name}*! Aqui é *${_merchantName()}*. 📒`); }
  function sendWhatsAppConfirmation() {
    const pending = S.transactions.filter(t => t.status === 'pending');
    if (!pending.length) { toast('✅ Sem pendências', 'success'); return; }
    const tx = pending[0];
    WA.confirmationRequest(S.customer.phone, _merchantName(), tx.id, S.customer.id, tx.type, tx.amount, tx.description, S.merchant?.id);
  }
  function sendWhatsAppBalance() {
    if (!S.customer || !S.ledger) return;
    WA.balance(S.customer.phone, _merchantName(), S.customer.name, S.ledger.balance, S.transactions.filter(t => t.status === 'pending').length);
  }
  function sendWhatsAppLink() { if (S.customer && S.ledger) WA.accessLink(S.customer.phone, _merchantName(), S.customer.id, S.ledger.id, S.merchant?.id); }
  function sendWhatsAppReminder() {
    if (!S.customer || !S.ledger) return;
    WA.reminder(S.customer.phone, _merchantName(), S.customer.name, S.ledger.balance, S.transactions.find(t => t.status === 'pending' && t.due_date)?.due_date || null);
  }

  function showConfidenceDetail() { if (S.confResult) { Confidence.renderModal(S.confResult, S.customer?.name); showModal('modal-confidence'); } }

  // ── DASHBOARD CLIENTE ─────────────────────────────
  async function _loadCustomerDashboard() {
    const ledger = S.ledger;
    if (!ledger) return;
    const balance = ledger.id ? await recalcBalance(ledger.id) : 0;
    S.ledger.balance = balance;
    const { data: txs } = ledger.id ? await dbGetTransactions(ledger.id) : { data: [] };
    S.transactions = txs || [];

    const balEl  = document.getElementById('customer-balance');
    const statEl = document.getElementById('customer-balance-status');
    if (balEl) {
      if (balance < 0) { balEl.textContent = `+ ${fmt(Math.abs(balance))}`; balEl.className = 'ch-amount credit'; if (statEl) statEl.textContent = '🎁 Você tem crédito aqui!'; }
      else if (balance === 0) { balEl.textContent = fmt(0); balEl.className = 'ch-amount zero'; if (statEl) statEl.textContent = 'Tudo em dia! 🎉'; }
      else { balEl.textContent = fmt(balance); balEl.className = 'ch-amount debt'; if (statEl) statEl.textContent = `Você deve ${fmt(balance)}`; }
    }

    const totalPurchased = S.transactions.filter(t => t.type === 'purchase' && t.status === 'confirmed').reduce((s,t) => s + t.amount, 0);
    const totalPaid      = S.transactions.filter(t => t.type === 'payment'  && t.status === 'confirmed').reduce((s,t) => s + t.amount, 0);
    const progWrap  = document.getElementById('ch-progress-wrap');
    const progFill  = document.getElementById('ch-progress-fill');
    const progLabel = document.getElementById('ch-progress-label');
    if (totalPurchased > 0 && balance > 0) {
      const pct = Math.round((totalPaid / totalPurchased) * 100);
      if (progWrap) progWrap.style.display = '';
      setTimeout(() => FX.animateBar(progFill, pct), 400);
      if (progLabel) progLabel.textContent = `${pct}% pago · ${fmt(balance)} restante`;
    } else if (progWrap) progWrap.style.display = 'none';

    const pending   = S.transactions.filter(t => t.status === 'pending');
    const pendSec   = document.getElementById('customer-pending-section');
    const pendCount = document.getElementById('customer-pending-count');
    if (pendSec) pendSec.classList.toggle('hidden', !pending.length);
    if (pendCount) pendCount.textContent = `${pending.length} lançamento${pending.length !== 1 ? 's' : ''} aguardando confirmação`;
    _renderCustomerPending(pending);

    const conf = Confidence.calculate(S.transactions, ledger, S.customer);
    Confidence.renderCustomerConfidence(conf);

    const insightsWrap = document.getElementById('cust-insights');
    if (insightsWrap && conf.score > 0) {
      insightsWrap.style.display = '';
      const ci1 = document.getElementById('ci-streak');
      const ci2 = document.getElementById('ci-since');
      if (ci1) ci1.innerHTML = conf.streaks.length
        ? `<p class="ic-label">${conf.streaks[0].icon} Conquista</p><p class="ic-value" style="font-size:0.82rem">${conf.streaks[0].text}</p>`
        : `<p class="ic-label">🛒 Compras</p><p class="ic-value">${conf.totalPurchases}</p><p class="ic-sub">registradas</p>`;
      if (ci2) ci2.innerHTML = `<p class="ic-label">📅 Cliente desde</p><p class="ic-value" style="font-size:0.85rem">${S.customer?.created_at ? new Date(S.customer.created_at).toLocaleDateString('pt-BR',{month:'short',year:'numeric'}) : '—'}</p>`;
      FX.slideIn(insightsWrap, 150);
    } else if (insightsWrap) insightsWrap.style.display = 'none';

    _renderCustomerTransactions(S.transactions.filter(t => t.status !== 'pending'));
  }

  function _renderCustomerPending(pending) {
    const el = document.getElementById('customer-pending-list');
    if (!el) return;
    el.innerHTML = pending.map(tx => {
      const typeLabel = tx.type === 'purchase' ? '🛒 Compra' : '💰 Pagamento';
      return `<div class="pending-confirm-card">
        <div class="pcc-header"><span class="pcc-type">${typeLabel}</span><span class="pcc-amount">${fmt(tx.amount)}</span></div>
        <div class="pcc-desc">${tx.description || typeLabel} · ${fmtDate(tx.created_at)}</div>
        ${tx.attachment_url ? `<button class="tx-photo-btn" style="margin-bottom:0.5rem" onclick="App.viewPhoto('${tx.attachment_url.replace(/'/g,"\\'")}')">🖼️ Ver foto da compra</button>` : ''}
        <div class="pcc-actions">
          <button class="btn-pcc-yes" onclick="App.customerConfirmTx('${tx.id}')">✅ Confirmar</button>
          <button class="btn-pcc-no"  onclick="App.openContestModal('${tx.id}')">❌ Contestar</button>
        </div>
      </div>`;
    }).join('');
  }

  function _renderCustomerTransactions(txs) {
    const el = document.getElementById('customer-transactions');
    if (!el) return;
    if (!txs.length) { el.innerHTML = '<div class="empty-state"><span>📋</span><p>Nenhum lançamento confirmado ainda.</p></div>'; return; }
    const sMap = { confirmed:'✅ Confirmado', contested:'❌ Contestado', cancelled:'🚫 Cancelado' };
    el.innerHTML = txs.map((tx,i) => `
      <div class="tx-item tx-${tx.type}" style="animation-delay:${i*35}ms">
        <div class="tx-icon">${tx.type==='purchase'?'🛒':'💰'}</div>
        <div class="tx-info">
          <div class="tx-desc">${tx.description||(tx.type==='purchase'?'Compra':'Pagamento')}</div>
          <div class="tx-date">${fmtDate(tx.created_at)}</div>
          <span class="tx-status-pill ${tx.status}">${sMap[tx.status]||tx.status}</span>
          ${tx.attachment_url ? `<button class="tx-photo-btn" onclick="App.viewPhoto('${tx.attachment_url.replace(/'/g,"\\'")}')">🖼️ Ver foto</button>` : ''}
        </div>
        <div class="tx-amount-col"><div class="tx-amount">${tx.type==='purchase'?'+':'-'} ${fmt(tx.amount)}</div></div>
      </div>`).join('');
  }

  // ── CONFIRMAR / CONTESTAR ─────────────────────────
  async function customerConfirmTx(txId) {
    const tx = S.transactions.find(t => t.id === txId);
    if (!tx) return;
    showLoading('Confirmando...');
    await dbUpdateTransactionStatus(txId, 'confirmed', 'customer');
    tx.status = 'confirmed';
    const newBalance = await recalcBalance(S.ledger.id);
    S.ledger.balance = newBalance;
    await _loadCustomerDashboard();
    hideLoading(); FX.celebrate('confirm'); FX.vibrate([30, 60]); toast('✅ Confirmado!', 'success');
    const mPhone = _merchantPhone();
    if (mPhone) setTimeout(() => WA.merchantConfirmed(mPhone, S.customer.name, tx.type, tx.amount, newBalance, tx.description), 800);
  }

  function _openConfirmModal(tx) {
    S.confirmTx = tx;
    const mName = S.merchant ? MerchantProfile.displayName(S.merchant.profile) : '—';
    _setTxt('confirm-merchant-name', mName);
    _setTxt('confirm-type-badge', tx.type === 'purchase' ? '🛒 Compra' : '💰 Pagamento');
    _setTxt('confirm-amount', fmt(tx.amount));
    _setTxt('confirm-desc', tx.description || '');
    _setTxt('confirm-date', fmtDate(tx.created_at));
    showModal('modal-confirm');
  }

  async function confirmTransaction() { if (!S.confirmTx) return; closeModal('modal-confirm'); await customerConfirmTx(S.confirmTx.id); S.confirmTx = null; }
  function contestTransaction() { closeModal('modal-confirm'); showModal('modal-contest'); }
  function openContestModal(txId) { S.confirmTx = S.transactions.find(t => t.id === txId); showModal('modal-contest'); }

  async function submitContest() {
    const reason = _val('contest-reason').trim();
    if (!reason) { toast('💬 Digite o motivo', 'error'); return; }
    const tx = S.confirmTx; if (!tx) return;
    showLoading('Enviando...');
    await dbUpdateTransactionStatus(tx.id, 'contested', null);
    tx.status = 'contested';
    await _loadCustomerDashboard();
    closeModal('modal-contest'); _setVal('contest-reason',''); hideLoading(); S.confirmTx = null;
    toast('⚠️ Contestação enviada!', 'warning');
    const mPhone = _merchantPhone();
    if (mPhone) setTimeout(() => WA.contest(mPhone, S.customer.name, _merchantName(), tx.id, reason), 500);
  }

  function contactMerchantWhatsApp() { const mPhone = _merchantPhone(); if (mPhone && S.customer) WA.customerToMerchant(mPhone, S.customer.name, S.ledger?.balance || 0); }

  // ── PERFIL ────────────────────────────────────────
  function openProfileModal(isFirst = false) {
    const profile = S.merchant?.profile; if (!profile) return;
    MerchantProfile.openModal(profile, isFirst); showModal('modal-profile');
  }

  async function saveProfile() {
    const data = MerchantProfile.readForm();
    const error = MerchantProfile.validate(data);
    if (error) { toast('⚠️ ' + error, 'error'); return; }
    showLoading('Salvando...');
    const profile = { ...S.merchant.profile, ...data };
    await MerchantProfile.save(profile);
    S.merchant.profile = profile;
    if (DEMO_MODE && DB.merchant) { DB.merchant.name = profile.business_name; DB.merchant.phone = profile.whatsapp || profile.phone; }
    saveSession('merchant', S.merchant);
    _updateMerchantHeader(); hideLoading(); closeModal('modal-profile');
    FX.celebrate('confirm'); toast('✅ Comércio atualizado!', 'success');
  }

  function skipProfileSetup() { closeModal('modal-profile'); toast('⚠️ Configure antes de usar o WhatsApp', 'warning'); }

  // ── CALENDÁRIO ────────────────────────────────────
  // FIX: carrega transações com due_date para popular o calendário
  async function showCalendarScreen() {
    showScreen('calendar');
    const mid = S.merchant?.id;
    if (!mid) return;

    // Busca transações de todos os ledgers com due_date
    const { data: allTx } = await dbGetAllTransactionsForMerchant(mid);

    // Busca schedules da tabela payment_schedules
    let schedules = [];
    try {
      const { data: sc } = await dbGetSchedules(mid);
      schedules = sc || [];
    } catch(e) { schedules = []; }

    // FIX: adiciona transações com due_date como schedules para o calendário
    const txSchedules = (allTx || [])
      .filter(t => t.due_date && t.status !== 'cancelled')
      .map(t => ({
        due_date:     t.due_date,
        amount:       t.amount,
        description:  t.description || 'Vencimento',
        customerName: t.customerName || '—',
        status:       t.status === 'confirmed' ? 'paid' : 'pending',
      }));

    Calendar.buildEvents(allTx || [], [...schedules, ...txSchedules]);
    Calendar.render();
  }

  function calNav(delta)         { Calendar.navigate(delta); }
  function calSelectDay(dateStr) { Calendar.selectDay(dateStr); }

  // ── PAY METHOD ────────────────────────────────────
  function selectPayMethod(btn) {
    document.querySelectorAll('.pm-chip').forEach(b => b.classList.remove('active'));
    btn?.classList.add('active');
    S.payMethod = btn?.dataset.method || 'dinheiro';
  }

  // ── MODAIS ────────────────────────────────────────
  function showModal(id) { document.getElementById(id)?.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
  function closeModal(id) { document.getElementById(id)?.classList.add('hidden'); document.body.style.overflow = ''; }
  function closeModalOutside(e, id) { if (e.target.id === id) closeModal(id); }

  // ── TOAST ─────────────────────────────────────────
  function toast(msg, type = 'default') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast t-${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => { el.classList.add('fade-out'); setTimeout(() => el.remove(), 300); }, 3000);
  }

  // ── LOADING ───────────────────────────────────────
  function showLoading(text = 'Aguarde...') { _setTxt('loading-text', text); document.getElementById('loading-overlay')?.classList.remove('hidden'); }
  function hideLoading() { document.getElementById('loading-overlay')?.classList.add('hidden'); }

  // ── UI HELPERS ────────────────────────────────────
  function _refreshBalanceUI(balance, amtId, labelId) {
    const balEl = document.getElementById(amtId);
    const lblEl = document.getElementById(labelId);
    if (!balEl) return;
    if (balance < 0)      { balEl.textContent = `+ ${fmt(Math.abs(balance))}`; balEl.className = 'lh-amount credit'; if (lblEl) lblEl.textContent = '🎁 Crédito a favor'; }
    else if (balance === 0) { balEl.textContent = fmt(0); balEl.className = 'lh-amount zero'; if (lblEl) lblEl.textContent = '✅ Sem dívidas!'; }
    else                  { balEl.textContent = fmt(balance); balEl.className = 'lh-amount debt'; if (lblEl) lblEl.textContent = 'Saldo devedor'; }
    FX.glowBalance(balance <= 0);
  }

  function _val(id)       { return document.getElementById(id)?.value || ''; }
  function _setVal(id, v) { const el = document.getElementById(id); if (el) el.value = v; }
  function _setTxt(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }
  function _sleep(ms)     { return new Promise(r => setTimeout(r, ms)); }

  function _parseUrlParams() {
    const p = new URLSearchParams(window.location.search);
    return { customerId: p.get('customer'), ledgerId: p.get('ledger'), confirmTxId: p.get('confirm'), merchantId: p.get('merchant'), accessMode: p.get('access'), accessPhone: p.get('phone') || p.get('cliente') };
  }

  // ── FOTO / ANEXO ─────────────────────────────────
  function handlePhotoSelected(input) {
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast('❌ Foto muito grande (máx 8 MB)', 'error'); input.value = ''; return; }
    const otherId = input.id === 'purchase-photo-camera' ? 'purchase-photo-gallery' : 'purchase-photo-camera';
    const other = document.getElementById(otherId); if (other) other.value = '';
    S.photoFile = file;
    const reader = new FileReader();
    reader.onload = e => {
      S.photoDataUrl = e.target.result;
      const img = document.getElementById('photo-preview-img'); if (img) img.src = e.target.result;
      const wrap = document.getElementById('photo-preview-wrap'); if (wrap) wrap.classList.remove('hidden');
      const name = document.getElementById('photo-preview-name'); if (name) name.textContent = '📎 ' + file.name;
    };
    reader.readAsDataURL(file);
  }

  function removePhoto() {
    S.photoFile = null; S.photoDataUrl = null;
    ['purchase-photo-camera','purchase-photo-gallery'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const wrap = document.getElementById('photo-preview-wrap'); if (wrap) wrap.classList.add('hidden');
    const img  = document.getElementById('photo-preview-img');  if (img)  img.src = '';
    const name = document.getElementById('photo-preview-name'); if (name) name.textContent = '';
  }

  function viewPhoto(url) { const img = document.getElementById('photo-view-img'); if (img) img.src = url; showModal('modal-photo-view'); }

  // ── EXPORTS ───────────────────────────────────────
  return {
    loginMerchant, loginCustomer, registerMerchant, logout,
    showScreen, goBackToDashboard, showCalendarScreen,
    toggleCreditLimit, createCustomer, filterCustomers,
    openLedger, filterLedger, switchLedgerTab, updatePaymentPreview, notifyPending,
    createTransaction, createTransactionOnly, createPaymentOnly,
    openPurchaseFromDashboard, updatePurchaseWaPreview, _preparePurchaseModal,
    showQuickLaunch, updateQuickWaPreview, submitQuickLaunch,
    openWhatsAppCustomer, sendWhatsAppConfirmation, sendWhatsAppBalance, sendWhatsAppLink, sendWhatsAppReminder,
    customerConfirmTx, confirmTransaction, contestTransaction, openContestModal, submitContest, contactMerchantWhatsApp,
    openProfileModal, saveProfile, skipProfileSetup,
    calNav, calSelectDay,
    handlePhotoSelected, removePhoto, viewPhoto,
    pickMerchantByIndex: (idx) => window._PENDURA_PICK(idx),
    selectPayMethod, showModal, closeModal, closeModalOutside,
    showConfidenceDetail, toast, showLoading, hideLoading,
    currentCustomerId,
  };
})();
