// ══════════════════════════════════════════════════
// PENDURA v2.1 — SUPABASE.JS
// Camada de dados — Supabase + demo fallback
// ══════════════════════════════════════════════════

let supabaseClient = null;

function initSupabase() {
  if (DEMO_MODE || !window.supabase) return null;
  try {
    supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
  } catch (e) { console.error('Supabase init:', e); }
  return supabaseClient;
}

// ── MERCHANTS ────────────────────────────────────

async function dbGetMerchantByPhone(phone) {
  if (DEMO_MODE) {
    const m = DB.merchant?.phone === phone ? DB.merchant : null;
    return { data: m, error: null };
  }
  const { data, error } = await supabaseClient
    .from('merchants').select('*').eq('phone', phone).single();
  return { data, error };
}

async function dbCreateMerchant(name, phone, passwordHash) {
  if (DEMO_MODE) {
    const m = { id: _uid(), name, phone, password_hash: passwordHash, created_at: new Date().toISOString() };
    DB.merchant = m;
    return { data: m, error: null };
  }
  const { data, error } = await supabaseClient
    .from('merchants').insert([{ name, phone, password_hash: passwordHash }])
    .select().single();
  return { data, error };
}

// ── CUSTOMERS ────────────────────────────────────

async function dbGetCustomers(merchantId) {
  if (DEMO_MODE) {
    return { data: DB.customers.filter(c => c.merchant_id === merchantId), error: null };
  }
  const { data, error } = await supabaseClient
    .from('customers').select('*').eq('merchant_id', merchantId)
    .order('created_at', { ascending: false });
  return { data, error };
}

async function dbGetCustomerById(id) {
  if (DEMO_MODE) {
    const c = DB.customers.find(c => c.id === id);
    return { data: c ? { ...c, merchants: DB.merchant } : null, error: null };
  }
  const { data, error } = await supabaseClient
    .from('customers').select('*, merchants(*)').eq('id', id).single();
  return { data, error };
}

async function dbCreateCustomer(merchantId, name, phone, limitTotal = null, limitVisible = true) {
  if (DEMO_MODE) {
    const c = {
      id: _uid(), merchant_id: merchantId, name, phone,
      limit_total: limitTotal, limit_visible: limitVisible,
      created_at: new Date().toISOString()
    };
    DB.customers.push(c);
    const l = { id: _uid(), merchant_id: merchantId, customer_id: c.id, balance: 0, updated_at: new Date().toISOString() };
    DB.ledgers.push(l);
    return { data: c, error: null };
  }
  const { data: customer, error } = await supabaseClient
    .from('customers')
    .insert([{ merchant_id: merchantId, name, phone, limit_total: limitTotal, limit_visible: limitVisible }])
    .select().single();
  if (error) return { data: null, error };
  await supabaseClient.from('ledgers').insert([{ merchant_id: merchantId, customer_id: customer.id, balance: 0 }]);
  return { data: customer, error: null };
}

// ── LEDGERS ──────────────────────────────────────

async function dbGetLedger(merchantId, customerId) {
  if (DEMO_MODE) {
    const l = DB.ledgers.find(l => l.merchant_id === merchantId && l.customer_id === customerId);
    return { data: l || null, error: null };
  }
  const { data, error } = await supabaseClient
    .from('ledgers').select('*')
    .eq('merchant_id', merchantId).eq('customer_id', customerId).single();
  return { data, error };
}

async function dbGetLedgersForMerchant(merchantId) {
  if (DEMO_MODE) {
    return { data: DB.ledgers.filter(l => l.merchant_id === merchantId), error: null };
  }
  const { data, error } = await supabaseClient
    .from('ledgers').select('*, customers(*)').eq('merchant_id', merchantId);
  return { data, error };
}

async function dbUpdateLedgerBalance(ledgerId, balance) {
  if (DEMO_MODE) {
    const i = DB.ledgers.findIndex(l => l.id === ledgerId);
    if (i >= 0) { DB.ledgers[i].balance = balance; DB.ledgers[i].updated_at = new Date().toISOString(); }
    return { error: null };
  }
  const { error } = await supabaseClient
    .from('ledgers').update({ balance, updated_at: new Date().toISOString() }).eq('id', ledgerId);
  return { error };
}

// ── TRANSACTIONS ─────────────────────────────────

async function dbGetTransactions(ledgerId) {
  if (DEMO_MODE) {
    return {
      data: DB.transactions
        .filter(t => t.ledger_id === ledgerId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
      error: null
    };
  }
  const { data, error } = await supabaseClient
    .from('transactions').select('*').eq('ledger_id', ledgerId)
    .order('created_at', { ascending: false });
  return { data, error };
}

async function dbGetAllTransactionsForMerchant(merchantId) {
  if (DEMO_MODE) {
    const ledgerIds = DB.ledgers.filter(l => l.merchant_id === merchantId).map(l => l.id);
    const txs = DB.transactions.filter(t => ledgerIds.includes(t.ledger_id));
    // Enriquecer com nome do cliente
    return {
      data: txs.map(t => {
        const ledger   = DB.ledgers.find(l => l.id === t.ledger_id);
        const customer = ledger ? DB.customers.find(c => c.id === ledger.customer_id) : null;
        return { ...t, customerName: customer?.name || '—' };
      }),
      error: null
    };
  }
  const { data, error } = await supabaseClient
    .from('transactions')
    .select('*, ledgers!inner(merchant_id, customers(name))')
    .eq('ledgers.merchant_id', merchantId)
    .order('created_at', { ascending: false });
  return { data, error };
}

async function dbCreateTransaction(ledgerId, type, amount, description, createdBy, dueDate = null) {
  if (DEMO_MODE) {
    const tx = {
      id: _uid(), ledger_id: ledgerId, type,
      amount: parseFloat(amount), description: description || '',
      status: 'pending', created_by: createdBy, confirmed_by: null,
      due_date: dueDate, created_at: new Date().toISOString()
    };
    DB.transactions.push(tx);
    return { data: tx, error: null };
  }
  const { data, error } = await supabaseClient
    .from('transactions')
    .insert([{ ledger_id: ledgerId, type, amount, description, status: 'pending', created_by: createdBy, due_date: dueDate }])
    .select().single();
  return { data, error };
}

async function dbUpdateTransactionStatus(txId, status, confirmedBy) {
  if (DEMO_MODE) {
    const i = DB.transactions.findIndex(t => t.id === txId);
    if (i >= 0) { DB.transactions[i].status = status; DB.transactions[i].confirmed_by = confirmedBy; }
    return { error: null };
  }
  const { error } = await supabaseClient
    .from('transactions').update({ status, confirmed_by: confirmedBy }).eq('id', txId);
  return { error };
}

// ── SCHEDULES ────────────────────────────────────

async function dbGetSchedules(merchantId) {
  if (DEMO_MODE) {
    const ledgerIds = DB.ledgers.filter(l => l.merchant_id === merchantId).map(l => l.id);
    return { data: DB.schedules.filter(s => ledgerIds.includes(s.ledger_id)), error: null };
  }
  const { data, error } = await supabaseClient
    .from('payment_schedules').select('*, customers(name)')
    .eq('merchant_id', merchantId);
  return { data, error };
}

// ── RECALC BALANCE ───────────────────────────────
// Fonte de verdade: soma das transações confirmadas.
// Saldo positivo = cliente deve. Negativo = crédito.

async function recalcBalance(ledgerId) {
  const { data: txs } = await dbGetTransactions(ledgerId);
  if (!txs) return 0;

  let balance = 0;
  for (const tx of txs) {
    if (tx.status === 'confirmed') {
      if (tx.type === 'purchase') balance += tx.amount;
      if (tx.type === 'payment')  balance -= tx.amount;
    }
  }
  balance = Math.round(balance * 100) / 100;
  await dbUpdateLedgerBalance(ledgerId, balance);
  return balance;
}

// ── AUTH HELPERS ─────────────────────────────────

function saveSession(type, data) {
  try { localStorage.setItem('pendura_session', JSON.stringify({ type, data, ts: Date.now() })); } catch {}
}

function loadSession() {
  try {
    const s = JSON.parse(localStorage.getItem('pendura_session') || 'null');
    if (!s) return null;
    if (Date.now() - s.ts > 30 * 86400000) { localStorage.removeItem('pendura_session'); return null; }
    return s;
  } catch { return null; }
}

function clearSession() { localStorage.removeItem('pendura_session'); }

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; }
  return h.toString(36);
}

// ── BUSCA CLIENTE POR TELEFONE ───────────────────
// Normaliza o phone e busca em todos os comércios.
// Retorna array de { customer, merchant, ledger }.
async function dbFindCustomerByPhone(phone, merchantId = null) {
  const np = phone.replace(/\D/g, '');

  if (DEMO_MODE) {
    // No demo, garante que os dados existam antes de buscar
    if (!DB.customers.length) {
      seedDemo(DB.merchant?.id || 'demo-merchant-default');
    }

    const matches = DB.customers.filter(c => {
      const cp = (c.phone || '').replace(/\D/g, '');
      // No demo: busca por telefone — ignora merchant_id porque o seed
      // pode ter sido criado com merchant_id diferente do comerciante logado
      if (merchantId) {
        return cp === np && c.merchant_id === merchantId;
      }
      return cp === np;
    });

    // Monta merchant correto: usa DB.merchant se disponível, 
    // senão cria um a partir do merchant_id do customer
    return {
      data: matches.map(c => {
        const merchant = DB.merchant || {
          id:   c.merchant_id,
          name: 'Comércio',
          phone: ''
        };
        return {
          customer: c,
          merchant: merchant,
          ledger:   DB.ledgers.find(l => l.customer_id === c.id) || null
        };
      }),
      error: null
    };
  }

  // Supabase real
  let q = supabaseClient
    .from('customers')
    .select('*, merchants(*)')
    .eq('phone', np);
  if (merchantId) q = q.eq('merchant_id', merchantId);

  const { data: custs, error } = await q;
  if (error || !custs) return { data: [], error };

  const results = await Promise.all(custs.map(async c => {
    const { data: l } = await supabaseClient
      .from('ledgers').select('*')
      .eq('customer_id', c.id).maybeSingle();
    return { customer: c, merchant: c.merchants, ledger: l };
  }));
  return { data: results, error: null };
}

// ── ATTACHMENT (foto da compra) ──────────────────
// Salva imagem no Supabase Storage ou retorna base64 como fallback.
async function dbSaveAttachment(transactionId, file) {
  if (!file) return null;

  // Fallback: base64 em memória (não persiste entre sessões no demo)
  if (DEMO_MODE || !supabaseClient) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result); // data URL base64
      reader.readAsDataURL(file);
    });
  }

  // Supabase Storage
  const ext  = file.name.split('.').pop() || 'jpg';
  const path = `transactions/${transactionId}/foto.${ext}`;
  const { error } = await supabaseClient.storage
    .from('transaction-attachments')
    .upload(path, file, { upsert: true });

  if (error) {
    console.warn('Storage upload error:', error.message);
    return null;
  }

  const { data: { publicUrl } } = supabaseClient.storage
    .from('transaction-attachments')
    .getPublicUrl(path);

  return publicUrl;
}

// Salva attachment_url na transação
async function dbUpdateTransactionAttachment(transactionId, url) {
  if (DEMO_MODE) {
    const i = DB.transactions.findIndex(t => t.id === transactionId);
    if (i >= 0) DB.transactions[i].attachment_url = url;
    return { error: null };
  }
  const { error } = await supabaseClient
    .from('transactions')
    .update({ attachment_url: url })
    .eq('id', transactionId);
  return { error };
}
