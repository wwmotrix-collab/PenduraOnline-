// ══════════════════════════════════════════════════
// PENDURA v2.1 — CONFIDENCE.JS
// Sistema de Confiança Comercial
// NÃO é score bancário — é relacionamento humano
// ══════════════════════════════════════════════════

const Confidence = (() => {

  // ── RÓTULOS HUMANOS (não bancários) ─────────────
  const BADGES = [
    { min: 90, label: 'Parceiro de Confiança', icon: '🏆', color: '#e8c56a' },
    { min: 80, label: 'Pagador Pontual',        icon: '⭐', color: '#e8c56a' },
    { min: 70, label: 'Cliente Frequente',       icon: '🤝', color: '#3dbb6c' },
    { min: 55, label: 'Confiança Crescente',     icon: '📈', color: '#3dbb6c' },
    { min: 40, label: 'Relacionamento Jovem',    icon: '🌱', color: '#a09888' },
    { min:  0, label: 'Início de Jornada',       icon: '👋', color: '#a09888' },
  ];

  const CUSTOMER_BADGES = [
    { min: 90, id: 'raiz',      label: 'Cliente Raiz',          icon: '🌳' },
    { min: 80, id: 'parceiro',  label: 'Parceiro do Bairro',     icon: '🤝' },
    { min: 70, id: 'pontual',   label: 'Pagador Pontual',        icon: '⭐' },
    { min: 55, id: 'frequente', label: 'Cliente Frequente',      icon: '🔄' },
    { min:  0, id: 'novo',      label: 'Cliente Novo',           icon: '👋' },
  ];

  const MERCHANT_BADGES = [
    { id: 'organizado',    label: 'Organizado',           icon: '📋', condition: (stats) => stats.totalTx >= 10 },
    { id: 'transparente',  label: 'Transparente',          icon: '💎', condition: (stats) => stats.confirmedRate >= 0.9 },
    { id: 'parceiro',      label: 'Parceiro Confiável',    icon: '🏪', condition: (stats) => stats.relationshipDays >= 30 },
  ];

  // ── CÁLCULO PRINCIPAL ────────────────────────────
  /**
   * Calcula confiança comercial a partir das transações de um ledger.
   * Retorna objeto com score (0-100) e métricas detalhadas.
   *
   * @param {Array}  transactions  - Lista de transações do ledger
   * @param {Object} ledger        - Objeto do ledger (balance, etc.)
   * @param {Object} customer      - Objeto do cliente (created_at)
   * @returns {Object} resultado completo
   */
  function calculate(transactions, ledger, customer) {
    if (!transactions || transactions.length === 0) {
      return _emptyResult(customer);
    }

    const confirmed = transactions.filter(t => t.status === 'confirmed');
    const purchases = confirmed.filter(t => t.type === 'purchase');
    const payments  = confirmed.filter(t => t.type === 'payment');

    if (purchases.length === 0) return _emptyResult(customer);

    const now = Date.now();

    // 1. Taxa de confirmação (0-20 pts)
    const totalTx       = transactions.filter(t => t.type === 'purchase').length;
    const confirmedCount = purchases.length;
    const confirmedRate  = totalTx > 0 ? confirmedCount / totalTx : 0;
    const confirmScore   = confirmedRate * 20;

    // 2. Tempo médio de pagamento (0-25 pts)
    //    Pares purchase → primeiro payment subsequente
    let payTimeDays = [];
    purchases.forEach(p => {
      const purchaseDate = new Date(p.created_at).getTime();
      // pagamento mais próximo após a compra
      const pay = payments
        .filter(pm => new Date(pm.created_at).getTime() >= purchaseDate)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0];
      if (pay) {
        const days = (new Date(pay.created_at) - purchaseDate) / 86400000;
        payTimeDays.push(days);
      }
    });
    const avgPayDays = payTimeDays.length
      ? payTimeDays.reduce((s, d) => s + d, 0) / payTimeDays.length
      : null;
    let payTimeScore = 0;
    if (avgPayDays !== null) {
      if      (avgPayDays <= 1)  payTimeScore = 25;
      else if (avgPayDays <= 3)  payTimeScore = 22;
      else if (avgPayDays <= 7)  payTimeScore = 18;
      else if (avgPayDays <= 14) payTimeScore = 12;
      else if (avgPayDays <= 30) payTimeScore = 6;
      else                       payTimeScore = 2;
    }

    // 3. Frequência de compras (0-20 pts)
    const relationshipDays = customer?.created_at
      ? Math.max(1, (now - new Date(customer.created_at).getTime()) / 86400000)
      : 30;
    const purchasesPerMonth = (purchases.length / relationshipDays) * 30;
    let freqScore = 0;
    if      (purchasesPerMonth >= 8)  freqScore = 20;
    else if (purchasesPerMonth >= 4)  freqScore = 16;
    else if (purchasesPerMonth >= 2)  freqScore = 12;
    else if (purchasesPerMonth >= 1)  freqScore = 8;
    else                              freqScore = 4;

    // 4. Recorrência de pagamentos (0-20 pts)
    const paymentRate  = purchases.length > 0
      ? Math.min(payments.length / purchases.length, 1)
      : 0;
    const recurrScore  = paymentRate * 20;

    // 5. Estabilidade do relacionamento (0-15 pts)
    let stabilityScore = 0;
    if      (relationshipDays >= 180) stabilityScore = 15;
    else if (relationshipDays >= 90)  stabilityScore = 12;
    else if (relationshipDays >= 30)  stabilityScore = 8;
    else if (relationshipDays >= 7)   stabilityScore = 4;
    else                              stabilityScore = 1;

    const raw   = confirmScore + payTimeScore + freqScore + recurrScore + stabilityScore;
    const score = Math.min(100, Math.round(raw));

    // Histórico de 30/60 dias para evolução
    const score30 = _scoreAt(transactions, customer, 30);
    const score60 = _scoreAt(transactions, customer, 60);
    const delta30 = score - score30;
    const delta60 = score - score60;

    // Streaks
    const streaks = _calcStreaks(transactions, payments, purchases, relationshipDays);

    // Badges
    const badge      = _getBadge(score);
    const custBadges = _getCustomerBadges(score, purchases.length, relationshipDays);

    return {
      score,
      badge,
      custBadges,
      delta30,
      delta60,
      avgPayDays: avgPayDays !== null ? Math.round(avgPayDays * 10) / 10 : null,
      purchasesPerMonth: Math.round(purchasesPerMonth * 10) / 10,
      confirmedRate: Math.round(confirmedRate * 100),
      totalPurchases: purchases.length,
      totalPayments: payments.length,
      relationshipDays: Math.round(relationshipDays),
      streaks,
      // Para badges de comerciante
      stats: { totalTx, confirmedRate, relationshipDays }
    };
  }

  // ── SCORE RETROATIVO (simula score N dias atrás) ─
  function _scoreAt(transactions, customer, daysAgo) {
    const cutoff = Date.now() - daysAgo * 86400000;
    const oldTx  = transactions.filter(t => new Date(t.created_at).getTime() < cutoff);
    if (oldTx.length === 0) return 0;
    const result = calculate(oldTx, null, customer);
    return result.score;
  }

  // ── STREAKS ──────────────────────────────────────
  function _calcStreaks(transactions, payments, purchases, relationshipDays) {
    const streaks = [];

    // 🔥 Pagamentos em dia (últimos N confirmados seguidos)
    const lastFivePay = payments.slice(-5);
    if (lastFivePay.length >= 5) {
      streaks.push({ icon: '🔥', text: '5 pagamentos confirmados seguidos' });
    } else if (lastFivePay.length >= 3) {
      streaks.push({ icon: '✅', text: `${lastFivePay.length} pagamentos seguidos` });
    }

    // 🤝 Cliente antigo
    if (relationshipDays >= 240) {
      const months = Math.floor(relationshipDays / 30);
      streaks.push({ icon: '🤝', text: `Cliente parceiro há ${months} meses` });
    } else if (relationshipDays >= 90) {
      const months = Math.floor(relationshipDays / 30);
      streaks.push({ icon: '🤝', text: `${months} meses de relacionamento` });
    }

    // ⭐ Muitas compras quitadas
    if (purchases.length >= 20) {
      streaks.push({ icon: '⭐', text: `${purchases.length} compras registradas` });
    } else if (purchases.length >= 10) {
      streaks.push({ icon: '⭐', text: `${purchases.length} compras na caderneta` });
    }

    return streaks;
  }

  // ── BADGE POR SCORE ──────────────────────────────
  function _getBadge(score) {
    return BADGES.find(b => score >= b.min) || BADGES[BADGES.length - 1];
  }

  function _getCustomerBadges(score, totalPurchases, days) {
    const badges = [];
    const primary = CUSTOMER_BADGES.find(b => score >= b.min) || CUSTOMER_BADGES[CUSTOMER_BADGES.length - 1];
    badges.push(primary);
    if (totalPurchases >= 30) badges.push({ id: 'raiz', label: 'Cliente Raiz', icon: '🌳' });
    else if (totalPurchases >= 15) badges.push({ id: 'frequente', label: 'Cliente Frequente', icon: '🔄' });
    if (days >= 180) badges.push({ id: 'antigo', label: 'Parceiro do Bairro', icon: '🏘️' });
    // Remove duplicatas
    return badges.filter((b, i, arr) => arr.findIndex(x => x.id === b.id) === i);
  }

  // ── RESULTADO VAZIO ──────────────────────────────
  function _emptyResult(customer) {
    const days = customer?.created_at
      ? Math.max(1, (Date.now() - new Date(customer.created_at).getTime()) / 86400000)
      : 0;
    return {
      score: 0, badge: BADGES[BADGES.length - 1],
      custBadges: [CUSTOMER_BADGES[CUSTOMER_BADGES.length - 1]],
      delta30: 0, delta60: 0,
      avgPayDays: null, purchasesPerMonth: 0,
      confirmedRate: 0, totalPurchases: 0, totalPayments: 0,
      relationshipDays: Math.round(days),
      streaks: [],
      stats: { totalTx: 0, confirmedRate: 0, relationshipDays: days }
    };
  }

  // ── RENDERIZADORES ───────────────────────────────

  /** Atualiza a confidence pill no topo do ledger */
  function renderPill(result) {
    const pill  = document.getElementById('confidence-pill');
    const val   = document.getElementById('confidence-value');
    const label = document.getElementById('confidence-label');
    if (!pill || !result) return;

    if (result.score === 0) {
      if (val)   val.textContent   = '—';
      if (label) label.textContent = 'calculando';
      return;
    }

    if (val)   val.textContent   = result.score + '%';
    if (label) label.textContent = result.badge.label;
    pill.style.borderColor = result.badge.color + '55';
    FX.animateBar(document.getElementById('cc-bar-fill'), result.score);
  }

  /** Renderiza aba de Relacionamento completa */
  function renderInsightTab(result, customer, transactions) {
    if (!result) return;

    // --- Insight grid (métricas) ---
    const grid = document.getElementById('insight-grid');
    if (grid) {
      const since = customer?.created_at
        ? _formatSince(customer.created_at)
        : '—';
      const avgPay = result.avgPayDays !== null
        ? result.avgPayDays + (result.avgPayDays === 1 ? ' dia' : ' dias')
        : '—';
      const ticket = _calcAvgTicket(transactions);

      grid.innerHTML = [
        _iCard('📅', 'Cliente desde', since, ''),
        _iCard('🛒', 'Total compras', result.totalPurchases, 'registradas'),
        _iCard('💵', 'Ticket médio', ticket, ''),
        _iCard('⚡', 'Tempo médio pag.', avgPay, ''),
        _iCard('✅', 'Taxa confirmação', result.confirmedRate + '%', ''),
        _iCard('📆', 'Dias de relac.', result.relationshipDays, 'dias'),
      ].join('');
      // Anima cards com delay
      grid.querySelectorAll('.insight-card').forEach((el, i) => FX.slideIn(el, i * 60));
    }

    // --- Confidence card ---
    const pctEl  = document.getElementById('cc-percent');
    const badgeEl = document.getElementById('cc-badge');
    const barEl   = document.getElementById('cc-bar-fill');
    const evoEl   = document.getElementById('cc-evolution');

    if (pctEl) {
      FX.animateCount(pctEl, 0, result.score, 800, v => Math.round(v) + '%');
    }
    if (badgeEl) {
      badgeEl.textContent = result.badge.icon + ' ' + result.badge.label;
      badgeEl.style.background = result.badge.color + '22';
      badgeEl.style.color      = result.badge.color;
    }
    if (barEl) {
      setTimeout(() => FX.animateBar(barEl, result.score), 300);
    }
    if (evoEl) {
      const lines = [];
      if (result.delta30 !== 0) {
        const sign = result.delta30 > 0 ? '+' : '';
        lines.push(`<span>${sign}${result.delta30}%</span> nos últimos 30 dias`);
      }
      if (result.delta60 !== 0) {
        const sign = result.delta60 > 0 ? '+' : '';
        lines.push(`<span>${sign}${result.delta60}%</span> nos últimos 60 dias`);
      }
      evoEl.innerHTML = lines.length ? lines.join(' · ') : 'Relacionamento iniciando';
    }

    // --- Streaks ---
    const streaksSec = document.getElementById('streaks-section');
    if (streaksSec) {
      streaksSec.innerHTML = result.streaks.length
        ? result.streaks.map(s => `
            <div class="streak-item">
              <span class="streak-icon">${s.icon}</span>
              <span class="streak-text">${s.text}</span>
            </div>`).join('')
        : '';
    }

    // --- Badges ---
    const badgesSec = document.getElementById('badges-section');
    if (badgesSec) {
      badgesSec.innerHTML = result.custBadges.map(b => `
        <div class="badge-chip">${b.icon} ${b.label}</div>`).join('');
    }
  }

  /** Renderiza confiança no dashboard cliente */
  function renderCustomerConfidence(result) {
    const wrap = document.getElementById('ch-confidence');
    const span = document.getElementById('ch-conf-badge');
    if (!wrap || !result || result.score === 0) { if (wrap) wrap.style.display = 'none'; return; }

    const badge = result.custBadges[0];
    if (span) span.textContent = badge.icon + ' ' + badge.label;
    wrap.style.display = 'block';
    FX.slideIn(wrap, 200);
  }

  /** Renderiza modal de detalhe de confiança */
  function renderModal(result, customerName) {
    const body = document.getElementById('confidence-modal-body');
    if (!body || !result) return;

    const badge = result.badge;
    body.innerHTML = `
      <div style="text-align:center;padding:0.5rem 0 1rem">
        <div style="font-size:2.5rem;margin-bottom:0.4rem">${badge.icon}</div>
        <div style="font-family:var(--font-display);font-size:1.8rem;font-weight:700;color:var(--text-1)">${result.score}%</div>
        <div style="display:inline-block;background:${badge.color}22;color:${badge.color};font-size:0.8rem;font-weight:700;padding:0.25rem 0.9rem;border-radius:99px;margin-top:0.4rem">${badge.label}</div>
        <div style="margin-top:0.75rem">
          <div style="height:8px;background:var(--surface-2);border-radius:99px;overflow:hidden">
            <div id="modal-conf-bar" style="height:100%;background:linear-gradient(90deg,var(--green),var(--gold-bright));border-radius:99px;width:0%;transition:width 0.9s ease"></div>
          </div>
        </div>
      </div>

      <div style="background:var(--surface);border:1px solid var(--glass-border);border-radius:var(--r);padding:1rem;margin-bottom:0.75rem">
        <p style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-2);font-weight:700;margin-bottom:0.75rem">Como é calculado</p>
        ${_factorRow('✅', 'Taxa de confirmação', result.confirmedRate + '%')}
        ${_factorRow('⚡', 'Tempo médio de pagamento', result.avgPayDays !== null ? result.avgPayDays + ' dias' : '—')}
        ${_factorRow('🔄', 'Frequência de compras', result.purchasesPerMonth + '/mês')}
        ${_factorRow('📅', 'Tempo de relacionamento', result.relationshipDays + ' dias')}
      </div>

      ${result.streaks.length ? `
      <div style="margin-bottom:0.75rem">
        <p style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-2);font-weight:700;margin-bottom:0.5rem">Conquistas</p>
        ${result.streaks.map(s => `<div class="streak-item">${s.icon} <span class="streak-text">${s.text}</span></div>`).join('')}
      </div>` : ''}

      ${result.delta30 !== 0 || result.delta60 !== 0 ? `
      <div style="background:var(--green-dim);border-radius:var(--r-sm);padding:0.75rem;font-size:0.82rem;color:var(--green-bright)">
        📈 Evolução: ${result.delta30 > 0 ? '+' : ''}${result.delta30}% em 30 dias
        ${result.delta60 !== 0 ? ` · ${result.delta60 > 0 ? '+' : ''}${result.delta60}% em 60 dias` : ''}
      </div>` : ''}
    `;

    setTimeout(() => {
      const bar = document.getElementById('modal-conf-bar');
      if (bar) bar.style.width = result.score + '%';
    }, 100);
  }

  // ── HELPERS PRIVADOS ─────────────────────────────
  function _iCard(icon, label, value, sub) {
    return `<div class="insight-card">
      <p class="ic-label">${icon} ${label}</p>
      <div class="ic-value">${value}</div>
      ${sub ? `<p class="ic-sub">${sub}</p>` : ''}
    </div>`;
  }

  function _factorRow(icon, label, value) {
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:0.4rem 0;border-bottom:1px solid var(--surface-2)">
      <span style="font-size:0.82rem;color:var(--text-2)">${icon} ${label}</span>
      <span style="font-size:0.82rem;font-weight:600;color:var(--text-1)">${value}</span>
    </div>`;
  }

  function _formatSince(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
  }

  function _calcAvgTicket(transactions) {
    if (!transactions) return '—';
    const purchases = transactions.filter(t => t.type === 'purchase' && t.status === 'confirmed');
    if (!purchases.length) return '—';
    const avg = purchases.reduce((s, t) => s + t.amount, 0) / purchases.length;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(avg);
  }

  return { calculate, renderPill, renderInsightTab, renderCustomerConfidence, renderModal };
})();
