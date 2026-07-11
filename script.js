/* ==========================================================================
   ASTERCORE TECHNOLOGIES — Coming Soon
   script.js
   Vanilla ES6+, no dependencies. Organized as small independent modules,
   each initialized from the bottom of the file once the DOM is ready.
   ========================================================================== */

'use strict';

/* -------------------------------------------------------------------------
   0. Shared helpers
   ---------------------------------------------------------------------- */
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const lerp  = (a, b, t) => a + (b - a) * t;
const pad2  = (n) => String(n).padStart(2, '0');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Lightweight throttle for high-frequency events (mousemove, resize). */
function throttleRAF(fn) {
  let ticking = false;
  return (...args) => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      fn(...args);
      ticking = false;
    });
  };
}


/* ==========================================================================
   1. LOADING EXPERIENCE
   Boot-sequence style loader: simulated progress readout, animated sweep
   bar (CSS-driven), Astercore mark spin, then a smooth fade + handoff to
   the hero entrance sequence.
   ========================================================================== */
function initLoader() {
  const loader   = $('#loader');
  const percent  = $('#loaderPercent');
  if (!loader) return;

  let progress = 0;
  const target = 100;
  const duration = 1500; // ms, simulated boot time
  const start = performance.now();

  function step(now) {
    const t = clamp((now - start) / duration, 0, 1);
    // ease-out so it feels like it's "settling" rather than linear
    const eased = 1 - Math.pow(1 - t, 3);
    progress = Math.round(eased * target);
    if (percent) percent.textContent = `${progress}%`;

    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      finishLoading();
    }
  }

  function finishLoading() {
    // Small hold at 100% so the number registers before the fade.
    setTimeout(() => {
      loader.classList.add('hidden');
      document.body.classList.add('booted');
      loader.addEventListener('transitionend', () => loader.remove(), { once: true });
    }, 350);
  }

  requestAnimationFrame(step);

  // Safety net: never let the loader block the page for more than 4s,
  // even if something upstream (fonts, etc.) stalls.
  setTimeout(finishLoading, 4000);
}


/* ==========================================================================
   2. DYNAMIC COUNTDOWN TIMER
   Live countdown to launch. Each unit ticks independently and only the
   digit(s) that changed receive the "tick" pulse animation. When the
   countdown reaches zero, the timer is replaced with the arrival message.
   ========================================================================== */
function initCountdown() {
  const LAUNCH_DATE = new Date('2035-01-01T00:00:00Z').getTime();

  const els = {
    years:  $('#cd-years'),
    days:   $('#cd-days'),
    hours:  $('#cd-hours'),
    mins:   $('#cd-mins'),
    secs:   $('#cd-secs'),
  };
  const countdownEl   = $('#countdown');
  const futureArrived = $('#futureArrived');
  if (!countdownEl) return;

  const previous = { years: null, days: null, hours: null, mins: null, secs: null };
  let arrived = false;

  function setUnit(key, value) {
    const str = pad2(value);
    const el = els[key];
    if (!el) return;
    if (previous[key] !== str) {
      el.textContent = str;
      if (previous[key] !== null && !prefersReducedMotion) {
        el.classList.remove('tick');
        // force reflow so the animation can restart every second
        void el.offsetWidth;
        el.classList.add('tick');
      }
      previous[key] = str;
    }
  }

  function onArrival() {
    if (arrived) return;
    arrived = true;
    countdownEl.classList.add('arrived');
    if (futureArrived) futureArrived.classList.add('show');
    triggerArrivalEffect();
  }

  function tick() {
    if (arrived) return;
    const diff = Math.max(0, LAUNCH_DATE - Date.now());
    const totalSeconds = Math.floor(diff / 1000);

    const years = Math.floor(totalSeconds / (365 * 24 * 3600));
    const days  = Math.floor((totalSeconds % (365 * 24 * 3600)) / (24 * 3600));
    const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600);
    const mins  = Math.floor((totalSeconds % 3600) / 60);
    const secs  = totalSeconds % 60;

    setUnit('years', years);
    setUnit('days', days);
    setUnit('hours', hours);
    setUnit('mins', mins);
    setUnit('secs', secs);

    if (diff <= 0) onArrival();
  }

  tick();
  setInterval(tick, 1000);
}

/* Special visual effect fired once, the moment the countdown hits zero. */
function triggerArrivalEffect() {
  const flash = document.createElement('div');
  flash.style.cssText = `
    position:fixed; inset:0; z-index:150; pointer-events:none;
    background: radial-gradient(circle at 50% 40%, rgba(0,229,255,0.35), transparent 60%);
    opacity:0; transition: opacity 1.2s ease-out;
  `;
  document.body.appendChild(flash);
  requestAnimationFrame(() => {
    flash.style.opacity = '1';
    setTimeout(() => { flash.style.opacity = '0'; }, 500);
    setTimeout(() => flash.remove(), 2000);
  });
}


/* ==========================================================================
   3. SCROLL REVEAL SYSTEM
   IntersectionObserver-driven fade + slide-up + subtle scale for any
   element flagged with .reveal. Vision statement gets an additional
   word-by-word reveal layered on top.
   ========================================================================== */
function initScrollReveal() {
  const revealEls = $$('.reveal, .reveal-3d');
  if (!revealEls.length) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in');

      if (entry.target.id === 'visionStatement') {
        const words = $$('.word', entry.target);
        words.forEach((w, i) => setTimeout(() => { w.style.opacity = 1; }, i * 45));
      }

      io.unobserve(entry.target); // reveal once, keep it lightweight
    });
  }, { threshold: 0.25, rootMargin: '0px 0px -8% 0px' });

  revealEls.forEach((el) => io.observe(el));
}


/* ==========================================================================
   4. FLOATING PARTICLE SYSTEM  (+ background grid canvas)
   Ambient particle network with soft connective lines. Particles drift
   independently and the whole field parallaxes gently with the cursor.
   ========================================================================== */
function initParticleNetwork() {
  const canvas = $('#network');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W, H, particles = [];
  let parallaxX = 0, parallaxY = 0;
  let targetParallaxX = 0, targetParallaxY = 0;

  const isSmall = () => window.innerWidth < 760;
  const particleCount = () => (isSmall() ? 42 : 90);
  const maxLinkDistance = () => (isSmall() ? 100 : 150);

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function spawnParticles() {
    const count = particleCount();
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r: Math.random() * 1.4 + 0.4,
    }));
  }

  function updateParticles() {
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < -20) p.x = W + 20;
      if (p.x > W + 20) p.x = -20;
      if (p.y < -20) p.y = H + 20;
      if (p.y > H + 20) p.y = -20;
    }
  }

  function drawLinks() {
    const maxDist = maxLinkDistance();
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i], b = particles[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < maxDist) {
          const alpha = (1 - dist / maxDist) * 0.16;
          ctx.strokeStyle = `rgba(0,229,255,${alpha})`;
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(148,163,184,0.55)';
      ctx.fill();
    }
  }

  function frame() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();

    // ease the parallax offset toward the cursor-driven target
    parallaxX = lerp(parallaxX, targetParallaxX, 0.06);
    parallaxY = lerp(parallaxY, targetParallaxY, 0.06);
    ctx.translate(parallaxX, parallaxY);

    updateParticles();
    drawLinks();
    drawParticles();

    ctx.restore();
    requestAnimationFrame(frame);
  }

  const onMouseMove = throttleRAF((e) => {
    targetParallaxX = (e.clientX / window.innerWidth - 0.5) * 18;
    targetParallaxY = (e.clientY / window.innerHeight - 0.5) * 18;
  });

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('resize', throttleRAF(() => { resize(); spawnParticles(); }));

  resize();
  spawnParticles();
  requestAnimationFrame(frame);
}


/* ==========================================================================
   5. MOUSE LIGHTING SYSTEM
   Soft ambient radial glow that trails the cursor, plus a sharp point
   light used for the card-hover glow (handled per-card in module 8).
   ========================================================================== */
function initCursorLighting() {
  const glow = $('#cursorGlow');
  const dot  = $('#cursorDot');
  if (!glow || !dot) return;

  let mx = window.innerWidth / 2, my = window.innerHeight / 2;
  let gx = mx, gy = my;

  window.addEventListener('mousemove', (e) => {
    mx = e.clientX;
    my = e.clientY;
    dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%,-50%)`;
  });

  function animate() {
    gx = lerp(gx, mx, 0.08);
    gy = lerp(gy, my, 0.08);
    glow.style.transform = `translate(${gx}px, ${gy}px) translate(-50%,-50%)`;
    requestAnimationFrame(animate);
  }
  animate();
}


/* ==========================================================================
   6. HERO TEXT ANIMATIONS
   The staggered entrance (logo → name → tagline → badge → countdown) is
   driven by CSS keyframe delays defined in style.css, so this module only
   needs to add the "booted" trigger class once the loader clears, keeping
   the timing declarative and easy to tune from the stylesheet.
   ========================================================================== */
function initHeroSequence() {
  // The stylesheet's fadeUp animations already run on page load with
  // staggered delays. This hook exists so the sequence can be restarted
  // or extended later (e.g. replaying it after the loader) without
  // touching the CSS.
  const hero = $('.hero');
  if (!hero) return;
  document.addEventListener('DOMContentLoaded', () => {
    hero.classList.add('sequenced');
  });
}


/* ==========================================================================
   7. TECHNOLOGY SHOWCASE PANELS
   Simulated dashboard behavior: cycling status lines and animated
   progress bars for each confidential panel.
   ========================================================================== */
function initShowcasePanels() {
  const panels = $$('.panel-status');
  if (!panels.length) return;

  const statusSequences = {
    ai:         ['Initializing…', 'Training Models…', 'AI Systems Online'],
    platforms:  ['Initializing…', 'Provisioning Nodes…', 'Infrastructure Initializing'],
    computing:  ['Initializing…', 'Calibrating Cores…', 'Platform Development Active'],
    ecosystems: ['Initializing…', 'Syncing Services…', 'Security Protocols Operational'],
  };

  const fillTargets = {
    ai: 78, platforms: 46, computing: 63, ecosystems: 55,
  };

  panels.forEach((panelStatus) => {
    const key = panelStatus.dataset.panel;
    const textEl = $('.status-text', panelStatus);
    const fillEl = document.querySelector(`.panel-progress-fill[data-fill="${key}"]`);
    const sequence = statusSequences[key] || ['Initializing…'];
    let step = 0;

    // Reveal progress once the panel scrolls into view.
    const panelEl = panelStatus.closest('.panel');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && fillEl) {
          fillEl.style.width = `${fillTargets[key] || 50}%`;
          io.disconnect();
        }
      });
    }, { threshold: 0.4 });
    if (panelEl) io.observe(panelEl);

    // Cycle through simulated status messages.
    if (textEl) {
      setInterval(() => {
        step = (step + 1) % sequence.length;
        textEl.style.opacity = 0;
        setTimeout(() => {
          textEl.textContent = sequence[step];
          textEl.style.transition = 'opacity .4s ease';
          textEl.style.opacity = 1;
        }, 250);
      }, 3400 + Math.random() * 900); // slightly desynced across panels
    }
  });
}


/* ==========================================================================
   8. PREMIUM HOVER INTERACTIONS
   Cards tilt subtly toward the cursor and lift, with a glow that tracks
   pointer position (glow itself is painted via the .card::before radial
   gradient in CSS, positioned here through --mx/--my custom properties).
   ========================================================================== */
function initCardTilt() {
  const cards = $$('.card');
  if (!cards.length || prefersReducedMotion) return;

  const MAX_TILT = 6; // degrees — kept subtle for a premium, not gimmicky, feel

  cards.forEach((card) => {
    card.style.transformStyle = 'preserve-3d';

    const onMove = (e) => {
      const rect = card.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;   // 0..1
      const py = (e.clientY - rect.top) / rect.height;    // 0..1

      const rotY = (px - 0.5) * (MAX_TILT * 2);
      const rotX = (0.5 - py) * (MAX_TILT * 2);

      card.style.transform =
        `perspective(1000px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-8px) translateZ(0)`;

      card.style.setProperty('--mx', `${e.clientX - rect.left}px`);
      card.style.setProperty('--my', `${e.clientY - rect.top}px`);
    };

    const onLeave = () => {
      card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateY(0)';
    };

    card.addEventListener('mousemove', throttleRAF(onMove));
    card.addEventListener('mouseleave', onLeave);
  });
}


/* ==========================================================================
   9. TYPING ANIMATION
   Rotating status-line messages beneath the hero, typed and deleted in a
   continuous loop.
   ========================================================================== */
function initTypingMessages() {
  const target = $('#typingMessage');
  if (!target) return;

  const messages = [
    "Building Tomorrow's Intelligence",
    'Engineering Future Technologies',
    'Reimagining Digital Infrastructure',
    'Advancing Human Potential',
  ];

  if (prefersReducedMotion) {
    target.textContent = messages[0];
    return;
  }

  const TYPE_SPEED   = 42;
  const DELETE_SPEED = 26;
  const HOLD_TIME    = 1600;
  const GAP_TIME     = 400;

  let msgIndex = 0;
  let charIndex = 0;

  function typeStep() {
    const current = messages[msgIndex];
    charIndex++;
    target.textContent = current.slice(0, charIndex);

    if (charIndex < current.length) {
      setTimeout(typeStep, TYPE_SPEED);
    } else {
      setTimeout(deleteStep, HOLD_TIME);
    }
  }

  function deleteStep() {
    const current = messages[msgIndex];
    charIndex--;
    target.textContent = current.slice(0, charIndex);

    if (charIndex > 0) {
      setTimeout(deleteStep, DELETE_SPEED);
    } else {
      msgIndex = (msgIndex + 1) % messages.length;
      setTimeout(typeStep, GAP_TIME);
    }
  }

  setTimeout(typeStep, 2400); // start after the hero entrance has settled
}


/* ==========================================================================
   10b. HERO SCROLL-TILT (3D)
   As the visitor scrolls past the hero, the hero-content block tilts back
   in 3D space and recedes slightly, reinforcing depth before the next
   section arrives. Clamped to a small range so it stays elegant rather
   than gimmicky, and locks once the hero is out of view.
   ========================================================================== */
function initHeroTilt() {
  if (prefersReducedMotion) return;
  const heroContent = $('#heroContent');
  const heroSection  = $('#section-hero');
  if (!heroContent || !heroSection) return;

  const MAX_ROTATE = 14;         // degrees
  const MAX_TRANSLATE_Z = -180;  // px of recession

  const onScroll = throttleRAF(() => {
    const heroHeight = heroSection.offsetHeight || window.innerHeight;
    const progress = clamp(window.scrollY / heroHeight, 0, 1);

    const rotate = progress * MAX_ROTATE;
    const depth  = progress * MAX_TRANSLATE_Z;
    const fade   = 1 - progress * 0.6;

    heroContent.style.transform =
      `perspective(1400px) rotateX(${rotate}deg) translateZ(${depth}px)`;
    heroContent.style.opacity = fade;
  });

  window.addEventListener('scroll', onScroll, { passive: true });
}


/* ==========================================================================
   10. PARALLAX SYSTEM
   Subtle, lightweight parallax on the background grid and vignette layers
   as the page scrolls, plus the cursor-driven canvas parallax handled in
   module 4.
   ========================================================================== */
function initScrollParallax() {
  if (prefersReducedMotion) return;
  const grid = $('.grid-overlay');
  if (!grid) return;

  const onScroll = throttleRAF(() => {
    const y = window.scrollY;
    grid.style.transform = `translateY(${y * 0.04}px)`;
  });

  window.addEventListener('scroll', onScroll, { passive: true });
}


/* ==========================================================================
   11. ANIMATED BACKGROUND GRID
   The grid itself is a CSS background (style.css), kept static/elegant per
   the brief ("keep it understated"). This module only nudges its opacity
   slightly on scroll so it reads as alive without becoming a distraction.
   ========================================================================== */
function initGridPulse() {
  if (prefersReducedMotion) return;
  const grid = $('.grid-overlay');
  if (!grid) return;

  let dir = 1, opacity = 1;
  function pulse() {
    opacity += dir * 0.0015;
    if (opacity > 1) { opacity = 1; dir = -1; }
    if (opacity < 0.75) { opacity = 0.75; dir = 1; }
    grid.style.opacity = opacity;
    requestAnimationFrame(pulse);
  }
  pulse();
}


/* ==========================================================================
   12. NAVIGATION ENHANCEMENTS
   Smooth-scrolling for any in-page anchors, plus an active-section marker
   (exposed as a data attribute on <body>) so future navigation UI can
   style itself off real scroll position without additional wiring.
   ========================================================================== */
function initNavigation() {
  // Smooth scroll for in-page links (delegated, future-proof for any nav added later).
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const targetEl = document.querySelector(link.getAttribute('href'));
    if (!targetEl) return;
    e.preventDefault();
    targetEl.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
  });

  // Active-section tracking.
  const sections = $$('section[id]');
  if (!sections.length) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        document.body.setAttribute('data-active-section', entry.target.id);
      }
    });
  }, { threshold: 0.5 });

  sections.forEach((s) => io.observe(s));
}


/* ==========================================================================
   14. EASTER EGG
   Typing "ASTERCORE" anywhere on the page triggers a hidden, sophisticated
   reveal sequence. Buffer-based key listener, no visible prompt.
   ========================================================================== */
function initEasterEgg() {
  const CODE = 'ASTERCORE';
  let buffer = '';

  window.addEventListener('keydown', (e) => {
    if (e.key.length !== 1) return; // ignore modifier/navigation keys
    buffer = (buffer + e.key.toUpperCase()).slice(-CODE.length);
    if (buffer === CODE) {
      triggerEasterEgg();
      buffer = '';
    }
  });

  function triggerEasterEgg() {
    // Enhanced lighting sweep across the whole viewport.
    const sweep = document.createElement('div');
    sweep.style.cssText = `
      position:fixed; inset:0; z-index:250; pointer-events:none;
      background: radial-gradient(circle at 50% 50%, rgba(0,229,255,0.4), transparent 65%);
      opacity:0; transition: opacity 1.4s ease-out;
    `;
    document.body.appendChild(sweep);

    // Secret message, styled consistently with the rest of the brand.
    const message = document.createElement('div');
    message.textContent = 'Welcome to the Future.';
    message.style.cssText = `
      position:fixed; left:50%; top:50%; z-index:251;
      transform: translate(-50%,-50%) scale(0.92);
      font-family:'Space Grotesk', sans-serif; font-weight:500;
      font-size: clamp(1.4rem, 4vw, 2.4rem);
      letter-spacing:-0.01em; text-align:center; white-space:nowrap;
      background: linear-gradient(90deg, #00E5FF, #3B82F6);
      -webkit-background-clip:text; background-clip:text; color:transparent;
      text-shadow: 0 0 60px rgba(0,229,255,0.4);
      opacity:0; transition: opacity 1s ease, transform 1s cubic-bezier(.22,1,.36,1);
      pointer-events:none;
    `;
    document.body.appendChild(message);

    requestAnimationFrame(() => {
      sweep.style.opacity = '1';
      message.style.opacity = '1';
      message.style.transform = 'translate(-50%,-50%) scale(1)';
    });

    setTimeout(() => {
      sweep.style.opacity = '0';
      message.style.opacity = '0';
      message.style.transform = 'translate(-50%,-50%) scale(0.96)';
    }, 2600);

    setTimeout(() => {
      sweep.remove();
      message.remove();
    }, 3800);
  }
}


/* ==========================================================================
   13. VISION STATEMENT COPY
   Injects the vision statement as individually-tracked words so the
   scroll-reveal module (3) can animate them in sequence. Kept as its own
   small module since it manipulates content, not just behavior.
   ========================================================================== */
function initVisionStatement() {
  const visionText = $('#visionText');
  if (!visionText) return;
  const phrase = 'We envision a future where technology empowers every individual, ' +
                 'accelerates innovation, and creates opportunities for generations to come.';
  visionText.innerHTML = phrase.split(' ')
    .map((w) => `<span class="word">${w}</span>`)
    .join(' ');
}


/* ==========================================================================
   BOOTSTRAP
   Performance-conscious init order: visual/paint-critical modules first,
   then interaction layers, then decorative/ambient systems.
   ========================================================================== */
(function bootstrap() {
  initLoader();
  initVisionStatement();
  initScrollReveal();
  initCountdown();
  initParticleNetwork();
  initCursorLighting();
  initHeroSequence();
  initShowcasePanels();
  initCardTilt();
  initTypingMessages();
  initScrollParallax();
  initHeroTilt();
  initGridPulse();
  initNavigation();
  initEasterEgg();
})();
