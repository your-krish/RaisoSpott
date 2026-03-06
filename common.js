// js/common.js — shared across ALL pages

// ============================================================
// UTILITIES
// ============================================================
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function showToast(msg, duration = 3000) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add('hidden'), duration);
}

function showModal(id) {
  document.getElementById(id)?.classList.remove('hidden');
}

function closeAllModals() {
  document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
  document.getElementById('post-overlay')?.remove();
}

function requireAuth(callback) {
  if (currentUser) callback();
  else showModal('login-modal');
}

// ============================================================
// ACTIVE NAV — highlight current page in bottom nav
// ============================================================
function setActiveNav() {
  const path = window.location.pathname;
  const page = path.includes('academics') ? 'academics'
    : path.includes('opportunities') ? 'opportunities'
    : path.includes('more') ? 'more'
    : path.includes('profile') ? 'profile'
    : 'feed';

  document.querySelectorAll('.nav-link').forEach(a => {
    a.classList.remove('active');
    if (a.dataset.page === page) a.classList.add('active');
  });
}

// ============================================================
// DARK MODE & ANIMATIONS — persist across pages
// ============================================================
function initSettings() {
  if (localStorage.getItem('dark') === '1') document.body.classList.add('dark');
  if (localStorage.getItem('reduce-anim') === '1') document.body.classList.add('reduce-motion');

  const darkToggle = document.getElementById('dark-toggle');
  const animToggle = document.getElementById('anim-toggle');

  if (darkToggle) {
    darkToggle.checked = localStorage.getItem('dark') === '1';
    darkToggle.addEventListener('change', () => {
      document.body.classList.toggle('dark', darkToggle.checked);
      localStorage.setItem('dark', darkToggle.checked ? '1' : '0');
    });
  }
  if (animToggle) {
    animToggle.checked = localStorage.getItem('reduce-anim') === '1';
    animToggle.addEventListener('change', () => {
      document.body.classList.toggle('reduce-motion', animToggle.checked);
      localStorage.setItem('reduce-anim', animToggle.checked ? '1' : '0');
    });
  }
}

// ============================================================
// SHARED MODAL WIRING — login modal on every page
// ============================================================
function initCommonModals() {
  document.querySelectorAll('.modal-close').forEach(btn => btn.addEventListener('click', closeAllModals));
  document.querySelectorAll('.modal-backdrop').forEach(bd => bd.addEventListener('click', closeAllModals));

  ['modal-google-btn', 'settings-login-btn', 'ob-google-btn'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', signInWithGoogle);
  });
  document.getElementById('header-login-btn')?.addEventListener('click', () => showModal('login-modal'));
  document.getElementById('logout-btn')?.addEventListener('click', signOut);

  // Avatar → profile page
  document.getElementById('user-avatar')?.addEventListener('click', () => {
    if (currentUser) window.location.href = 'profile.html';
  });
}

// ============================================================
// ONBOARDING — only runs on feed (index.html)
// ============================================================
function initOnboarding() {
  if (localStorage.getItem('raisospot_onboarding')) return;
  const ob = document.getElementById('onboarding');
  if (!ob) return;
  ob.classList.remove('hidden');

  let slide = 0;
  const slides = document.querySelectorAll('.slide');
  const dots = document.querySelectorAll('.dot');
  const nextBtn = document.getElementById('ob-next');

  function goTo(n) {
    slides.forEach(s => s.classList.remove('active'));
    dots.forEach(d => d.classList.remove('active'));
    slides[n]?.classList.add('active');
    dots[n]?.classList.add('active');
    nextBtn.textContent = n === slides.length - 1 ? 'Get Started' : 'Next →';
  }

  nextBtn?.addEventListener('click', () => {
    if (slide < slides.length - 1) { slide++; goTo(slide); }
    else finishOnboarding();
  });
  document.getElementById('ob-skip-btn')?.addEventListener('click', finishOnboarding);
}

function finishOnboarding() {
  localStorage.setItem('raisospot_onboarding', '1');
  document.getElementById('onboarding')?.classList.add('hidden');
}

// ============================================================
// SHARED INIT — runs on every page
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  // Apply saved theme immediately (before auth loads) to prevent flash
  if (localStorage.getItem('dark') === '1') document.body.classList.add('dark');
  if (localStorage.getItem('reduce-anim') === '1') document.body.classList.add('reduce-motion');

  await initAuth();
  setActiveNav();
  initSettings();
  initCommonModals();
  initOnboarding();

  // Page-specific inits — each page defines its own window.pageInit()
  if (typeof window.pageInit === 'function') window.pageInit();
});
