// ══════════════════════════════════════════════════
// PENDURA v2.1 — PWA.JS
// Instalação e service worker
// ══════════════════════════════════════════════════

let _deferredPrompt = null;

// Registra SW
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(r  => console.log('SW:', r.scope))
      .catch(e => console.warn('SW erro:', e));
  });
}

// Banner de instalação
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _deferredPrompt = e;
  if (!localStorage.getItem('pwa_dismissed')) {
    setTimeout(_showInstallBanner, 4000);
  }
});

function _showInstallBanner() {
  if (document.getElementById('pwa-banner')) return;
  const b = document.createElement('div');
  b.id = 'pwa-banner';
  b.style.cssText = `
    position:fixed;bottom:1rem;left:.75rem;right:.75rem;max-width:400px;margin:0 auto;
    background:var(--surface);border:1px solid var(--glass-border);
    color:var(--text-1);padding:.85rem 1rem;border-radius:var(--r-lg);
    display:flex;align-items:center;gap:.75rem;z-index:9997;
    box-shadow:var(--shadow-lg);animation:toastIn .35s var(--easing);
    font-family:var(--font-body);
  `;
  b.innerHTML = `
    <span style="font-size:1.5rem">📒</span>
    <div style="flex:1">
      <div style="font-weight:700;font-size:.88rem;color:var(--text-1)">Instalar Pendura</div>
      <div style="font-size:.72rem;color:var(--text-2)">Acesso rápido na tela inicial</div>
    </div>
    <button onclick="_installPwa()" style="
      background:var(--green);color:white;border:none;border-radius:var(--r-sm);
      padding:.4rem .85rem;font-weight:700;font-size:.78rem;cursor:pointer;
      font-family:var(--font-body);
    ">Instalar</button>
    <button onclick="_dismissPwa()" style="
      background:none;border:none;color:var(--text-3);cursor:pointer;font-size:1.1rem;padding:.2rem
    ">✕</button>`;
  document.body.appendChild(b);
}

function _installPwa() {
  if (!_deferredPrompt) return;
  _deferredPrompt.prompt();
  _deferredPrompt.userChoice.then(r => {
    if (r.outcome === 'accepted' && typeof App !== 'undefined') App.toast('🎉 Pendura instalado!', 'success');
    _deferredPrompt = null;
    document.getElementById('pwa-banner')?.remove();
  });
}

function _dismissPwa() {
  localStorage.setItem('pwa_dismissed', '1');
  document.getElementById('pwa-banner')?.remove();
}

window.addEventListener('appinstalled', () => {
  if (typeof App !== 'undefined') App.toast('📒 App instalado!', 'success');
  _deferredPrompt = null;
});
