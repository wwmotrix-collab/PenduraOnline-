// ══════════════════════════════════════════════════
// PENDURA v2.1 — FX.JS
// Microinterações, partículas e animações
// ══════════════════════════════════════════════════

const FX = (() => {
  const canvas = document.getElementById('fx-canvas');
  const ctx    = canvas ? canvas.getContext('2d') : null;
  let particles = [];
  let raf = null;

  function resize() {
    if (!canvas) return;
    const box = canvas.parentElement || document.body;
    const maxW = 430;
    canvas.width  = Math.min(window.innerWidth, maxW);
    canvas.height = window.innerHeight;
  }

  window.addEventListener('resize', resize);
  resize();

  // ── PARTICLE CLASS ──────────────────────────────
  class Particle {
    constructor(x, y, opts = {}) {
      this.x  = x; this.y  = y;
      this.vx = (Math.random() - 0.5) * (opts.spread || 4);
      this.vy = -(Math.random() * (opts.lift || 5) + 1);
      this.alpha  = 1;
      this.radius = Math.random() * (opts.maxR || 5) + (opts.minR || 2);
      this.color  = opts.color || '#3dbb6c';
      this.gravity = opts.gravity ?? 0.12;
      this.decay   = opts.decay  ?? 0.025;
      this.shape   = opts.shape  || 'circle';  // 'circle' | 'coin' | 'star' | 'check'
      this.rotation = Math.random() * Math.PI * 2;
      this.rotSpeed = (Math.random() - 0.5) * 0.15;
    }

    update() {
      this.x  += this.vx;
      this.vy += this.gravity;
      this.y  += this.vy;
      this.alpha  -= this.decay;
      this.rotation += this.rotSpeed;
    }

    draw(ctx) {
      if (this.alpha <= 0) return;
      ctx.save();
      ctx.globalAlpha = Math.max(0, this.alpha);
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);

      if (this.shape === 'coin') {
        // Moeda dourada
        ctx.beginPath();
        ctx.ellipse(0, 0, this.radius, this.radius * 0.6, 0, 0, Math.PI * 2);
        const grd = ctx.createRadialGradient(-this.radius * 0.3, -this.radius * 0.2, 0, 0, 0, this.radius);
        grd.addColorStop(0, '#f0d890');
        grd.addColorStop(1, '#c9a84c');
        ctx.fillStyle = grd;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,220,100,0.6)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

      } else if (this.shape === 'star') {
        drawStar(ctx, 0, 0, 4, this.radius, this.radius * 0.45, this.color);

      } else if (this.shape === 'check') {
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.radius * 0.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-this.radius * 0.5, 0);
        ctx.lineTo(-this.radius * 0.1, this.radius * 0.45);
        ctx.lineTo( this.radius * 0.5, -this.radius * 0.45);
        ctx.stroke();

      } else if (this.shape === 'spark') {
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.radius * 0.3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, -this.radius);
        ctx.lineTo(0,  this.radius);
        ctx.stroke();

      } else {
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
      }

      ctx.restore();
    }

    get dead() { return this.alpha <= 0; }
  }

  function drawStar(ctx, cx, cy, spikes, outerR, innerR, color) {
    let rot = (Math.PI / 2) * 3;
    const step = Math.PI / spikes;
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerR);
    for (let i = 0; i < spikes; i++) {
      ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
      rot += step;
      ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerR);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  // ── LOOP ────────────────────────────────────────
  function loop() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = particles.filter(p => !p.dead);
    particles.forEach(p => { p.update(); p.draw(ctx); });
    if (particles.length > 0) {
      raf = requestAnimationFrame(loop);
    } else {
      raf = null;
    }
  }

  function startLoop() {
    if (!raf) raf = requestAnimationFrame(loop);
  }

  function spawnBurst(x, y, preset) {
    const presets = {
      // Moedas douradas caindo (pagamento recebido)
      coins: {
        count: 18, shape: 'coin', spread: 6, lift: 8,
        gravity: 0.18, decay: 0.018, maxR: 7, minR: 3
      },
      // Check verde (confirmação)
      check: {
        count: 12, shape: 'check', color: '#3dbb6c',
        spread: 5, lift: 6, gravity: 0.14, decay: 0.028, maxR: 8, minR: 4
      },
      // Estrelas douradas (badge / streak)
      stars: {
        count: 16, shape: 'star', color: '#e8c56a',
        spread: 7, lift: 7, gravity: 0.12, decay: 0.02, maxR: 7, minR: 3
      },
      // Confetti verde leve (quitação total)
      confetti: {
        count: 24, shape: 'circle',
        spread: 8, lift: 9, gravity: 0.1, decay: 0.016, maxR: 5, minR: 2
      },
      // Sparks (lançamento de compra)
      sparks: {
        count: 10, shape: 'spark', color: '#c9a84c',
        spread: 4, lift: 5, gravity: 0.2, decay: 0.04, maxR: 6, minR: 2
      }
    };

    const cfg = presets[preset] || presets.check;
    const colors = preset === 'confetti'
      ? ['#3dbb6c', '#c9a84c', '#5ddb8a', '#e8c56a', '#a8f0c0']
      : null;

    for (let i = 0; i < cfg.count; i++) {
      const opts = { ...cfg };
      if (colors) opts.color = colors[i % colors.length];
      particles.push(new Particle(
        x + (Math.random() - 0.5) * 20,
        y + (Math.random() - 0.5) * 10,
        opts
      ));
    }
    startLoop();
  }

  // ── API PÚBLICA ──────────────────────────────────

  // Moedas + check — pagamento recebido ou quitação
  function celebrate(type = 'payment') {
    const cx = (canvas?.width  || 375) / 2;
    const cy = (canvas?.height || 700) * 0.35;
    if (type === 'full') {
      spawnBurst(cx, cy, 'confetti');
      setTimeout(() => spawnBurst(cx - 60, cy + 20, 'coins'), 120);
      setTimeout(() => spawnBurst(cx + 60, cy + 20, 'coins'), 240);
      setTimeout(() => spawnBurst(cx, cy - 40, 'stars'), 360);
    } else if (type === 'payment') {
      spawnBurst(cx, cy, 'coins');
      setTimeout(() => spawnBurst(cx, cy + 30, 'check'), 200);
    } else if (type === 'purchase') {
      spawnBurst(cx, cy, 'sparks');
    } else if (type === 'badge') {
      spawnBurst(cx, cy, 'stars');
    } else if (type === 'confirm') {
      spawnBurst(cx, cy, 'check');
    }
  }

  // Glow pulsante em um elemento
  function pulseElement(el, color = '#3dbb6c') {
    if (!el) return;
    const prev = el.style.transition;
    el.style.transition = 'box-shadow 0.15s ease, transform 0.15s ease';
    el.style.boxShadow = `0 0 0 6px ${color}44, 0 0 20px ${color}66`;
    el.style.transform = 'scale(1.02)';
    setTimeout(() => {
      el.style.boxShadow = '';
      el.style.transform = '';
      setTimeout(() => { el.style.transition = prev; }, 300);
    }, 300);
  }

  // Check animado inline (substitui emoji temporariamente)
  function flashCheck(el) {
    if (!el) return;
    const orig = el.innerHTML;
    el.innerHTML = '<span style="color:#3dbb6c;font-size:1.2em;animation:checkPop 0.4s ease">✓</span>';
    if (!document.getElementById('check-pop-style')) {
      const s = document.createElement('style');
      s.id = 'check-pop-style';
      s.textContent = '@keyframes checkPop{0%{transform:scale(0) rotate(-20deg);opacity:0}60%{transform:scale(1.3) rotate(5deg);opacity:1}100%{transform:scale(1) rotate(0);opacity:1}}';
      document.head.appendChild(s);
    }
    setTimeout(() => { el.innerHTML = orig; }, 1400);
  }

  // Vibração curta (mobile)
  function vibrate(pattern = [40]) {
    if (navigator.vibrate) navigator.vibrate(pattern);
  }

  // Brilho suave em card de saldo
  function glowBalance(positive = true) {
    const el = document.getElementById('ledger-balance') ||
               document.getElementById('customer-balance');
    if (!el) return;
    const color = positive ? '#3dbb6c' : '#c9a84c';
    pulseElement(el, color);
  }

  // Anima barra de progresso de 0 até target%
  function animateBar(el, targetPct, duration = 800) {
    if (!el) return;
    el.style.width = '0%';
    requestAnimationFrame(() => {
      el.style.transition = `width ${duration}ms cubic-bezier(0.25,0.46,0.45,0.94)`;
      el.style.width = targetPct + '%';
    });
  }

  // Contador animado de número
  function animateCount(el, from, to, duration = 600, formatter = v => v) {
    if (!el) return;
    const start = performance.now();
    function step(now) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = formatter(from + (to - from) * eased);
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // Slide-in de elemento
  function slideIn(el, delay = 0) {
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'translateY(12px)';
    setTimeout(() => {
      el.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }, delay);
  }

  return { celebrate, pulseElement, flashCheck, vibrate, glowBalance, animateBar, animateCount, slideIn };
})();
