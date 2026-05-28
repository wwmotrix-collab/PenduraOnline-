// ══════════════════════════════════════════════════
// PENDURA v2.1 — PROFILE.JS
// Perfil do comércio — localStorage + Supabase
// ══════════════════════════════════════════════════

const MerchantProfile = (() => {
  const KEY = 'pendura_merchant_profile';

  // ── CRUD ─────────────────────────────────────────
  function load(merchantId) {
    try {
      const raw = localStorage.getItem(KEY + '_' + merchantId);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  async function save(profile) {
    profile.updated_at = new Date().toISOString();
    try {
      localStorage.setItem(KEY + '_' + profile.id, JSON.stringify(profile));
    } catch (e) { console.warn('localStorage:', e); }

    if (typeof supabaseClient !== 'undefined' && supabaseClient &&
        typeof DEMO_MODE !== 'undefined' && !DEMO_MODE) {
      await supabaseClient
        .from('merchant_profiles')
        .upsert(profile, { onConflict: 'id' });
    }
    return profile;
  }

  function createFromMerchant(merchant) {
    return {
      id:            merchant.id,
      business_name: merchant.name  || '',
      owner_name:    '',
      phone:         merchant.phone || '',
      whatsapp:      merchant.phone || '',
      address:       '',
      business_type: '',
      created_at:    merchant.created_at || new Date().toISOString(),
      updated_at:    new Date().toISOString()
    };
  }

  // ── GETTERS CONVENIENTES ─────────────────────────
  function displayName(profile) {
    return (profile?.business_name || profile?.owner_name || 'Meu Comércio').trim();
  }

  function waPhone(profile) {
    return (profile?.whatsapp || profile?.phone || '').replace(/\D/g, '');
  }

  function initials(profile) {
    const name = displayName(profile);
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }

  function isComplete(profile) {
    if (!profile) return false;
    const name = (profile.business_name || '').trim();
    const wa   = (profile.whatsapp || profile.phone || '').replace(/\D/g, '');
    return name.length > 0 && wa.length >= 10;
  }

  // ── MODAL UI ─────────────────────────────────────
  function openModal(profile, isFirstTime = false) {
    const fmt = (p) => p ? _fmt(p) : '';

    _setVal('profile-business-name', profile.business_name || '');
    _setVal('profile-owner-name',    profile.owner_name    || '');
    _setVal('profile-whatsapp',      fmt(profile.whatsapp || profile.phone));
    _setVal('profile-phone',         fmt(profile.phone));
    _setVal('profile-address',       profile.address       || '');
    _setVal('profile-business-type', profile.business_type || '');

    const title   = document.getElementById('profile-modal-title');
    const skipBtn = document.getElementById('profile-skip-btn');

    if (title)   title.textContent = isFirstTime ? '🏪 Configure seu comércio' : '🏪 Meu Comércio';
    if (skipBtn) skipBtn.classList.toggle('hidden', !isFirstTime);

    _updatePreview();
    _bindPreviewListeners();
  }

  function readForm() {
    return {
      business_name: _getVal('profile-business-name').trim(),
      owner_name:    _getVal('profile-owner-name').trim(),
      whatsapp:      _getVal('profile-whatsapp').replace(/\D/g, ''),
      phone:         _getVal('profile-phone').replace(/\D/g, ''),
      address:       _getVal('profile-address').trim(),
      business_type: _getVal('profile-business-type').trim(),
    };
  }

  function validate(data) {
    if (!data.business_name) return 'Nome do comércio é obrigatório';
    const wa = data.whatsapp || data.phone;
    if (!wa || wa.length < 10) return 'WhatsApp inválido';
    return null;
  }

  // ── PREVIEW LIVE ─────────────────────────────────
  function _bindPreviewListeners() {
    const bn = document.getElementById('profile-business-name');
    const wa = document.getElementById('profile-whatsapp');
    if (bn) bn.oninput = _updatePreview;
    if (wa) wa.oninput = _updatePreview;
  }

  function _updatePreview() {
    const name = _getVal('profile-business-name').trim();
    const wa   = _getVal('profile-whatsapp').trim();
    _previewEl('preview-business-name', name || 'Nome do Comércio', !!name);
    _previewEl('preview-whatsapp',      wa   || '(XX) XXXXX-XXXX',  !!wa);
  }

  function _previewEl(id, text, filled) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.className   = filled ? 'preview-filled' : 'preview-ph';
  }

  // ── HELPERS ──────────────────────────────────────
  function _fmt(phone) {
    const d = (phone || '').replace(/\D/g, '');
    if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
    return phone || '';
  }

  function _setVal(id, v) { const el = document.getElementById(id); if (el) el.value = v; }
  function _getVal(id)    { return document.getElementById(id)?.value || ''; }

  return { load, save, createFromMerchant, displayName, waPhone, initials, isComplete, openModal, readForm, validate };
})();
