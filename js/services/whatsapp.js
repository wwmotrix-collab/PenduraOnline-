// ══════════════════════════════════════════════════
// PENDURA v2.1 — WHATSAPP.JS (Service)
// Integração máxima WhatsApp — mensagens humanizadas
// ══════════════════════════════════════════════════

const WA = (() => {

  // ── UTILITÁRIOS ──────────────────────────────────
  function _fmt(v) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
  }

  function _phone(p) {
    const d = (p || '').replace(/\D/g, '');
    return d.startsWith('55') ? d : '55' + d;
  }

  function _encode(text) { return encodeURIComponent(text); }

  function open(phone, message) {
    const number = _phone(phone);
    const url    = `https://wa.me/${number}?text=${_encode(message)}`;
    window.open(url, '_blank');
    App.toast('💬 Abrindo WhatsApp...', 'wa');
  }

  function _baseLink() {
    return window.location.origin + window.location.pathname.replace(/\/$/, '');
  }

  // Link de acesso do cliente — novo formato com phone + merchant
  // Suporta ambos os formatos (legado com ID e novo com phone)
  function customerLink(customerId, ledgerId, customerPhone, merchantId) {
    const base = _baseLink();
    if (customerPhone && merchantId) {
      const phone = customerPhone.replace(/\D/g, '');
      return `${base}?access=customer&phone=${phone}&merchant=${merchantId}`;
    }
    // Fallback legado
    return `${base}?customer=${customerId}&ledger=${ledgerId}`;
  }

  function confirmLink(txId, customerId, customerPhone, merchantId) {
    const base = _baseLink();
    if (customerPhone && merchantId) {
      const phone = customerPhone.replace(/\D/g, '');
      return `${base}?confirm=${txId}&access=customer&phone=${phone}&merchant=${merchantId}`;
    }
    return `${base}?confirm=${txId}&customer=${customerId}`;
  }

  // ── MENSAGENS ────────────────────────────────────

  function purchase(customerPhone, merchantName, amount, description, txId, customerId, merchantId) {
    const link   = confirmLink(txId, customerId, customerPhone, merchantId);
    const desc   = description ? `\n📝 _${description}_` : '';
    const msg = [
      `📒 *Pendura Online*`,
      `━━━━━━━━━━━━━━`,
      `🛒 *Compra registrada!*`,
      ``,
      `🏪 *${merchantName}*`,
      `💵 *${_fmt(amount)}*${desc}`,
      ``,
      `Confirme esta compra pelo link:`,
      link,
      ``,
      `_Ou responda *SIM* para confirmar_`,
      `_ou *NÃO* para contestar._`,
      `━━━━━━━━━━━━━━`,
      `_Pendura Online — confiança digital_ 📒`
    ].join('\n');
    open(customerPhone, msg);
  }

  function paymentReceipt(customerPhone, merchantName, amount, remaining) {
    const remainMsg = remaining > 0
      ? `📊 Saldo restante: *${_fmt(remaining)}*`
      : `🎉 *Saldo zerado! Obrigado pela confiança!*`;
    const msg = [
      `📒 *Pendura Online*`,
      `━━━━━━━━━━━━━━`,
      `✅ *Pagamento confirmado!*`,
      ``,
      `🏪 *${merchantName}*`,
      `💵 Recebido: *${_fmt(amount)}*`,
      remainMsg,
      ``,
      `_Obrigado pela confiança!_ 🙏`,
      `━━━━━━━━━━━━━━`,
      `_Pendura Online_ 📒`
    ].join('\n');
    open(customerPhone, msg);
  }

  function welcome(customerPhone, merchantName, merchantPhone, customerId, ledgerId, merchantId) {
    const link = customerLink(customerId, ledgerId, customerPhone, merchantId);
    const msg = [
      `📒 *Pendura Online*`,
      `━━━━━━━━━━━━━━`,
      `Olá! Você foi cadastrado na caderneta digital de *${merchantName}*.`,
      ``,
      `🔐 *Seu link de acesso:*`,
      link,
      ``,
      `Com ele você pode:`,
      `✅ Ver seu saldo`,
      `📋 Ver seu histórico`,
      `🔔 Confirmar compras`,
      `❌ Contestar lançamentos`,
      ``,
      `Dúvidas? Fale comigo:`,
      `wa.me/${_phone(merchantPhone)}`,
      `━━━━━━━━━━━━━━`,
      `_Pendura Online — confiança digital_ 📒`
    ].join('\n');
    open(customerPhone, msg);
  }

  function accessLink(customerPhone, merchantName, customerId, ledgerId, merchantId) {
    const link = customerLink(customerId, ledgerId, customerPhone, merchantId);
    const msg  = [
      `📒 *Pendura Online*`,
      ``,
      `Olá! Aqui está seu link de acesso à caderneta de *${merchantName}*:`,
      ``,
      link,
      ``,
      `_Pendura Online_ 📒`
    ].join('\n');
    open(customerPhone, msg);
  }

  function balance(customerPhone, merchantName, customerName, bal, pendingCount) {
    const balMsg = bal < 0
      ? `🎁 Você tem *${_fmt(Math.abs(bal))}* de crédito!`
      : bal === 0
        ? `🎉 *Zerado!* Você não deve nada.`
        : `💰 *${_fmt(bal)}* a pagar`;

    const pendMsg = pendingCount > 0
      ? `\n⚠️ *${pendingCount} lançamento(s)* aguardando confirmação`
      : '\n✅ Tudo confirmado!';

    const msg = [
      `📒 *Pendura Online*`,
      `━━━━━━━━━━━━━━`,
      `Olá, *${customerName}*!`,
      ``,
      `📊 Seu saldo em *${merchantName}*:`,
      ``,
      balMsg,
      pendMsg,
      `━━━━━━━━━━━━━━`,
      `_Pendura Online_ 📒`
    ].join('\n');
    open(customerPhone, msg);
  }

  function reminder(customerPhone, merchantName, customerName, bal, dueDate) {
    // Lembrete amigável — nunca agressivo
    const greeting = _timeGreeting();
    const dueStr   = dueDate
      ? new Date(dueDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })
      : null;

    const msg = [
      `${greeting}, *${customerName}* 😊`,
      ``,
      `Passando pra dar um alô pela *${merchantName}*.`,
      dueStr
        ? `O combinado era para *${dueStr}* — quando puder, é só me avisar! 🙏`
        : `Temos um pendura aberto de *${_fmt(bal)}* — sem pressa, mas vou combinando aqui!`,
      ``,
      `Se precisar conversar, pode chamar. Até logo! 👋`,
      ``,
      `_Pendura Online_ 📒`
    ].filter(Boolean).join('\n');
    open(customerPhone, msg);
  }

  function confirmationRequest(customerPhone, merchantName, txId, customerId, type, amount, description, merchantId) {
    const link = confirmLink(txId, customerId, customerPhone, merchantId);
    const typeLabel = type === 'purchase' ? 'compra' : 'pagamento';
    const desc = description ? ` (_${description}_)` : '';
    const msg = [
      `📒 *Pendura Online*`,
      ``,
      `Oi! 👋 Tem uma *${typeLabel}* de *${_fmt(amount)}*${desc} na ${merchantName} aguardando sua confirmação.`,
      ``,
      `Confirme pelo link:`,
      link,
      ``,
      `_Responda SIM para confirmar ou NÃO para contestar._`,
      ``,
      `_Pendura Online_ 📒`
    ].join('\n');
    open(customerPhone, msg);
  }

  function customerToMerchant(merchantPhone, customerName, balance) {
    const msg = [
      `Olá! Sou *${customerName}*.`,
      `Estou entrando em contato pelo *Pendura Online*.`,
      balance > 0
        ? `\nMeu saldo atual é *${_fmt(balance)}*.`
        : balance < 0
          ? `\nTenho *${_fmt(Math.abs(balance))}* de crédito.`
          : `\nMeu saldo está zerado. ✅`,
      ``,
      `📒 _Pendura Online_`
    ].filter(Boolean).join('\n');
    open(merchantPhone, msg);
  }

  function contest(merchantPhone, customerName, merchantName, txId, reason) {
    const msg = [
      `📒 *Pendura Online*`,
      `━━━━━━━━━━━━━━`,
      `⚠️ *CONTESTAÇÃO*`,
      ``,
      `👤 *${customerName}* está contestando um lançamento em *${merchantName}*.`,
      `🔢 Referência: #${String(txId).slice(-8)}`,
      ``,
      `💬 Motivo:`,
      `_"${reason}"_`,
      ``,
      `Por favor, verifique e entre em contato.`,
      `━━━━━━━━━━━━━━`,
      `_Pendura Online_ 📒`
    ].join('\n');
    open(merchantPhone, msg);
  }

  function merchantConfirmed(merchantPhone, customerName, type, amount, newBalance, description) {
    const typeLabel = type === 'purchase' ? '🛒 Compra' : '💰 Pagamento';
    const msg = [
      `📒 *Pendura Online*`,
      ``,
      `✅ *${customerName}* confirmou:`,
      `${typeLabel} de *${_fmt(amount)}*`,
      description ? `_${description}_` : '',
      ``,
      `Saldo atual: *${_fmt(newBalance)}*`,
      ``,
      `_Pendura Online_ 📒`
    ].filter(Boolean).join('\n');
    open(merchantPhone, msg);
  }

  // ── PREVIEW TEXT (para modais) ───────────────────
  function previewPurchase(merchantName, customerName, amount, description) {
    const desc = description ? ` — _${description}_` : '';
    return [
      `📒 <b>Pendura Online</b>`,
      `Olá, <b>${customerName || 'cliente'}</b>!`,
      `🛒 Compra de <b>${_fmt(amount)}</b>${desc}`,
      `🏪 <i>${merchantName || 'Comércio'}</i>`,
      `<i>Confirme pelo link 👇</i>`
    ].join('<br>');
  }

  function previewPayment(merchantName, customerName, amount) {
    return [
      `📒 <b>Pendura Online</b>`,
      `✅ Pagamento de <b>${_fmt(amount)}</b> confirmado!`,
      `🏪 <i>${merchantName || 'Comércio'}</i>`,
      `Obrigado! 🙏`
    ].join('<br>');
  }

  // ── HELPER PRIVADO ───────────────────────────────
  function _timeGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  }

  return {
    open, customerLink, confirmLink,
    purchase, paymentReceipt, welcome, accessLink,
    balance, reminder, confirmationRequest,
    customerToMerchant, contest, merchantConfirmed,
    previewPurchase, previewPayment
  };
})();
