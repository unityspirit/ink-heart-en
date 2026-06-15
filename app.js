/* ================================================================
   INK HEART â€” Ð¢Ð°Ñ‚Ñƒ-ÑÑ‚ÑƒÐ´Ð¸Ñ | app.js
   Cinematic Scroll Engine
   TOTAL_FRAMES: placeholder (update after ffmpeg)
================================================================ */

// === CONSTANTS ===
const TOTAL_FRAMES = 428;     // ink-heart-ru frames
const PAGE_COUNT   = 6;
const LERP         = 0.02;  // Cinematic slowness
const CONCURRENCY  = 48;    // Parallel frame loading

// === DEVICE DETECTION ===
const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent) || innerWidth < 768;
const FRAME_DIR = isMobile ? 'frames-mobile' : 'frames-webp';

// === CANVAS SETUP ===
const canvas = document.getElementById('gl-canvas');
const ctx    = canvas.getContext('2d');
let canvasDpr = 1; // module-level â€” CRITICAL: must match resize() and drawFrame()

function resize() {
  canvasDpr = Math.min(devicePixelRatio || 1, isMobile ? 1.5 : 2);
  canvas.width  = innerWidth  * canvasDpr;
  canvas.height = innerHeight * canvasDpr;
  canvas.style.width  = innerWidth  + 'px';
  canvas.style.height = innerHeight + 'px';
  ctx.setTransform(canvasDpr, 0, 0, canvasDpr, 0, 0);
}

window.addEventListener('resize', resize, { passive: true });
resize();

// === FRAME LOADER ===
const frames = new Array(TOTAL_FRAMES);
let loadedCount = 0;
let isReady     = false;

function frameName(i) {
  return `${FRAME_DIR}/frame_${String(i + 1).padStart(6, '0')}.webp`;
}

async function loadAll() {
  const queue = Array.from({ length: TOTAL_FRAMES }, (_, i) => i);

  async function worker() {
    while (queue.length) {
      const i = queue.shift();
      await new Promise(resolve => {
        const img = new Image();
        img.onload = img.onerror = () => {
          frames[i] = img;
          loadedCount++;

          // Update progress bar
          const pct = Math.round(loadedCount / TOTAL_FRAMES * 100);
          const bar = document.getElementById('progress-bar');
          if (bar) bar.style.width = pct + '%';

          // First frame ready â€” start animation
          if (loadedCount === 1) {
            isReady = true;
            startAnim();
          }

          // All loaded â€” hide loader
          if (loadedCount === TOTAL_FRAMES) {
            const loader = document.getElementById('loader');
            if (loader) {
              loader.style.transition = 'opacity 0.8s';
              loader.style.opacity    = '0';
              setTimeout(() => { loader.style.display = 'none'; }, 800);
            }
          }

          resolve();
        };
        img.src = frameName(i);
      });
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

// === ANIMATION LOOP ===
let currentFrame = 0;
let targetFrame  = 0;

window.addEventListener('scroll', () => {
  if (!isReady) return;
  const maxScroll = document.documentElement.scrollHeight - innerHeight;
  const progress  = maxScroll > 0 ? scrollY / maxScroll : 0;
  targetFrame = progress * (TOTAL_FRAMES - 1);
}, { passive: true });

// === DRAW FRAME (with vignette + bottom gradient) ===
function drawFrame(idx) {
  const img = frames[Math.max(0, Math.min(Math.round(idx), TOTAL_FRAMES - 1))];
  if (!img || !img.complete || !img.naturalWidth) return;

  // Use innerWidth/innerHeight â€” ctx.setTransform already scales for DPR
  // Do NOT divide canvas.width by devicePixelRatio (isMobile dpr != devicePixelRatio!)
  const W = innerWidth;
  const H = innerHeight;

  // Cover-fit (background-size: cover equivalent)
  const r  = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const iw = img.naturalWidth  * r;
  const ih = img.naturalHeight * r;
  const x  = (W - iw) / 2;
  const y  = (H - ih) / 2;

  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(img, x, y, iw, ih);

  // Radial vignette (dark edges â€” deep red tint for ink aesthetic)
  const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.15, W / 2, H / 2, H * 0.85);
  vig.addColorStop(0, 'rgba(5,2,2,0)');
  vig.addColorStop(0.7, 'rgba(5,2,2,0.35)');
  vig.addColorStop(1, 'rgba(5,2,2,0.82)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  // Bottom gradient (dark fade)
  const bot = ctx.createLinearGradient(0, H * 0.55, 0, H);
  bot.addColorStop(0, 'rgba(5,2,2,0)');
  bot.addColorStop(1, 'rgba(5,2,2,0.90)');
  ctx.fillStyle = bot;
  ctx.fillRect(0, H * 0.55, W, H * 0.45);

  // Top gradient (navbar area darkening)
  const top = ctx.createLinearGradient(0, 0, 0, H * 0.2);
  top.addColorStop(0, 'rgba(5,2,2,0.70)');
  top.addColorStop(1, 'rgba(5,2,2,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, H * 0.2);
}

function startAnim() {
  function loop() {
    requestAnimationFrame(loop);
    currentFrame += (targetFrame - currentFrame) * LERP;
    if (isReady) drawFrame(currentFrame);
  }
  loop();
}

// === INTERSECTION OBSERVER â€” Section activation ===
const pages    = Array.from(document.querySelectorAll('.page'));
const navLinks = Array.from(document.querySelectorAll('.nav-link'));

// Ensure first section is active
if (pages[0]) {
  pages[0].classList.add('is-active');
}

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const idx = pages.indexOf(entry.target);
      // Activate current page
      pages.forEach((p, i) => p.classList.toggle('is-active', i === idx));
      // Update nav links (sections 1â€“5 map to nav links 0â€“4)
      navLinks.forEach((l, i) => l.classList.toggle('active', i === idx - 1));
    }
  });
}, {
  rootMargin: '-40% 0px -40% 0px'
});

pages.forEach(p => observer.observe(p));

// === SMOOTH SCROLL for anchor links ===
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
      // Close mobile drawer if open
      closeDrawer();
    }
  });
});

// === MOBILE BURGER MENU ===
const burgerBtn      = document.getElementById('burger-btn');
const navDrawer      = document.getElementById('nav-drawer');
const drawerClose    = document.getElementById('drawer-close');
const drawerBackdrop = document.getElementById('drawer-backdrop');

function openDrawer() {
  navDrawer.classList.add('open');
  drawerBackdrop.classList.add('open');
  burgerBtn.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeDrawer() {
  navDrawer.classList.remove('open');
  drawerBackdrop.classList.remove('open');
  burgerBtn.classList.remove('open');
  document.body.style.overflow = '';
}

if (burgerBtn) {
  burgerBtn.addEventListener('click', () => {
    if (navDrawer.classList.contains('open')) {
      closeDrawer();
    } else {
      openDrawer();
    }
  });
}

if (drawerClose)    drawerClose.addEventListener('click', closeDrawer);
if (drawerBackdrop) drawerBackdrop.addEventListener('click', closeDrawer);

// Close drawer on escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeDrawer();
});

// === KICKOFF ===
loadAll();

