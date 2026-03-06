// js/app.js

// ============================================================
// UTILITIES
// ============================================================
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

// ============================================================
// NAVIGATION
// ============================================================
let currentPage = 'feed';

function navigateTo(page) {
  if (page === 'profile' && !currentUser) {
    showModal('login-modal');
    return;
  }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn[data-page]').forEach(b => b.classList.remove('active'));

  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');

  const navBtn = document.querySelector(`.nav-btn[data-page="${page}"]`);
  if (navBtn) navBtn.classList.add('active');

  currentPage = page;

  // Always reload fresh data on tab switch
  if (page === 'feed') loadFeed(currentFilter);
  if (page === 'academics') loadAcademics(document.querySelector('.year-tab.active')?.dataset?.year || '1');
  if (page === 'opportunities') loadOpportunities();
  if (page === 'more') loadLostFound('lost');
  if (page === 'profile') { updateProfilePage(); loadProfilePosts(); }
}

// ============================================================
// ONBOARDING
// ============================================================
function initOnboarding() {
  if (localStorage.getItem('raisospot_onboarding')) return;
  document.getElementById('onboarding').classList.remove('hidden');

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

  nextBtn.addEventListener('click', () => {
    if (slide < slides.length - 1) { slide++; goTo(slide); }
    else finishOnboarding();
  });

  document.getElementById('ob-google-btn')?.addEventListener('click', signInWithGoogle);
  document.getElementById('ob-skip-btn')?.addEventListener('click', finishOnboarding);
}

function finishOnboarding() {
  localStorage.setItem('raisospot_onboarding', '1');
  document.getElementById('onboarding').classList.add('hidden');
}

// ============================================================
// MORE PAGE PANELS
// ============================================================
function toggleMorePanel(panelId) {
  const panels = ['more-map-panel', 'more-lf-panel', 'more-emergency-panel'];
  panels.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === panelId) el.classList.toggle('hidden');
    else el.classList.add('hidden');
  });
}

// ============================================================
// SEARCH — fixed: Enter triggers, results stay visible
// ============================================================
let searchTimeout;
let searchOpen = false;

function initSearch() {
  const searchBar = document.getElementById('search-bar');
  const input = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');
  const closeBtn = document.getElementById('search-close');

  // Open / close toggle
  searchBtn?.addEventListener('click', () => {
    searchOpen = !searchOpen;
    searchBar.classList.toggle('hidden', !searchOpen);
    if (searchOpen) {
      input.focus();
    } else {
      input.value = '';
    }
  });

  // Close button — explicit dismiss only
  closeBtn?.addEventListener('click', () => {
    searchOpen = false;
    searchBar.classList.add('hidden');
    input.value = '';
    // Restore feed
    loadFeed(currentFilter);
  });

  // Live search on typing
  input?.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    const q = input.value.trim();
    if (!q) return;
    searchTimeout = setTimeout(() => performSearch(q), 350);
  });

  // Enter key — trigger immediately, do NOT close bar
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(searchTimeout);
      const q = input.value.trim();
      if (q) performSearch(q);
    }
  });
}

async function performSearch(query) {
  if (!query) return;

  // Switch to feed page to show results, but keep search bar open
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn[data-page]').forEach(b => b.classList.remove('active'));
  document.getElementById('page-feed')?.classList.add('active');
  document.querySelector('.nav-btn[data-page="feed"]')?.classList.add('active');
  currentPage = 'feed';

  const container = document.getElementById('feed-container');
  container.innerHTML = '<div class="skeleton-loader"><div class="skeleton-card"></div><div class="skeleton-card"></div></div>';

  // Search by caption OR author name
  const { data } = await supabase
    .from('posts_with_counts')
    .select('*')
    .eq('status', 'active')
    .or(`caption.ilike.%${query}%,author_name.ilike.%${query}%`)
    .limit(20);

  container.innerHTML = '';

  if (!data || data.length === 0) {
    container.innerHTML = `
      <div class="no-results">
        <div style="font-size:40px;text-align:center;margin-bottom:8px">🔍</div>
        <p style="text-align:center;color:var(--text3)">No results for "<strong>${escapeHtml(query)}</strong>"</p>
      </div>`;
    return;
  }

  data.forEach(p => container.appendChild(renderPost(p)));
  if (currentUser) loadUserLikes(data.map(p => p.id));
}

// ============================================================
// MAIN INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  await initAuth();
  initOnboarding();
  initImageUpload();
  initSearch();
  loadFeed('all');

  // ── Navigation ──
  document.querySelectorAll('.nav-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });

  // Avatar → profile
  document.getElementById('user-avatar')?.addEventListener('click', () => {
    if (currentUser) navigateTo('profile');
  });

  // ── Create post ──
  document.getElementById('create-btn').addEventListener('click', () => {
    requireAuth(() => showModal('create-modal'));
  });

  document.querySelectorAll('.create-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      closeAllModals();
      if (opt.dataset.type === 'image') {
        _selectedImages = [];
        window._selectedImages = _selectedImages;
        document.getElementById('post-caption').value = '';
        document.getElementById('image-previews').innerHTML = '';
        showModal('image-post-modal');
      } else if (opt.dataset.type === 'confession') {
        document.getElementById('confession-text').value = '';
        document.getElementById('confession-category').value = '';
        showModal('confession-modal');
      }
    });
  });

  // ── Feed filters ──
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadFeed(btn.dataset.filter);
    });
  });

  // ── Year tabs ──
  document.querySelectorAll('.year-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.year-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      loadAcademics(tab.dataset.year);
    });
  });

  // ── Opp filters ──
  document.getElementById('opp-type-filter')?.addEventListener('change', () =>
    loadOpportunities(
      document.getElementById('opp-type-filter').value,
      document.getElementById('opp-year-filter').value
    )
  );
  document.getElementById('opp-year-filter')?.addEventListener('change', () =>
    loadOpportunities(
      document.getElementById('opp-type-filter').value,
      document.getElementById('opp-year-filter').value
    )
  );

  // ── Modals ──
  document.querySelectorAll('.modal-close').forEach(btn => btn.addEventListener('click', closeAllModals));
  document.querySelectorAll('.modal-backdrop').forEach(bd => bd.addEventListener('click', closeAllModals));

  // ── Auth buttons ──
  ['ob-google-btn', 'modal-google-btn', 'settings-login-btn'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', signInWithGoogle);
  });
  document.getElementById('header-login-btn')?.addEventListener('click', () => showModal('login-modal'));
  document.getElementById('logout-btn')?.addEventListener('click', signOut);

  // ── Post actions ──
  document.getElementById('submit-post')?.addEventListener('click', submitImagePost);
  document.getElementById('submit-confession')?.addEventListener('click', submitConfession);
  document.getElementById('submit-comment')?.addEventListener('click', () => requireAuth(submitComment));
  document.getElementById('comment-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') requireAuth(submitComment);
  });
  document.getElementById('save-caption-btn')?.addEventListener('click', saveEditedCaption);

  // ── Report modal ──
  document.querySelectorAll('.report-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.report-cat-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      const otherInput = document.getElementById('report-other-input');
      if (otherInput) {
        otherInput.classList.toggle('hidden', btn.dataset.cat !== 'other');
      }
    });
  });
  document.getElementById('submit-report-btn')?.addEventListener('click', submitReport);

  // ── More page ──
  document.getElementById('more-bug-btn')?.addEventListener('click', () => showModal('bug-modal'));
  document.getElementById('submit-bug')?.addEventListener('click', submitBugReport);
  document.getElementById('more-map-btn')?.addEventListener('click', () => toggleMorePanel('more-map-panel'));
  document.getElementById('more-lf-btn')?.addEventListener('click', () => toggleMorePanel('more-lf-panel'));
  document.getElementById('more-emergency-btn')?.addEventListener('click', () => toggleMorePanel('more-emergency-panel'));

  document.getElementById('more-settings-toggle')?.addEventListener('click', () => {
    const dropdown = document.getElementById('more-settings-dropdown');
    const arrow = document.getElementById('settings-arrow');
    dropdown?.classList.toggle('hidden');
    if (arrow) arrow.textContent = dropdown?.classList.contains('hidden') ? '▾' : '▴';
  });

  // ── Lost & Found ──
  document.querySelectorAll('.lf-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.lf-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      loadLostFound(tab.dataset.tab);
    });
  });
  document.getElementById('report-item-btn')?.addEventListener('click', () =>
    requireAuth(() => showModal('lost-item-modal'))
  );
  document.getElementById('submit-item')?.addEventListener('click', submitLostItem);

  // ── Profile ──
  document.getElementById('save-profile-name')?.addEventListener('click', saveProfileName);
  document.getElementById('profile-avatar-edit-btn')?.addEventListener('click', () => {
    document.getElementById('profile-avatar-input')?.click();
  });
  document.getElementById('profile-avatar-input')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (file) await handleAvatarUpload(file);
    e.target.value = ''; // reset
  });

  // ── Settings toggles ──
  const darkToggle = document.getElementById('dark-toggle');
  const animToggle = document.getElementById('anim-toggle');

  if (localStorage.getItem('dark') === '1') {
    document.body.classList.add('dark');
    if (darkToggle) darkToggle.checked = true;
  }
  if (localStorage.getItem('reduce-anim') === '1') {
    document.body.classList.add('reduce-motion');
    if (animToggle) animToggle.checked = true;
  }

  darkToggle?.addEventListener('change', () => {
    document.body.classList.toggle('dark', darkToggle.checked);
    localStorage.setItem('dark', darkToggle.checked ? '1' : '0');
  });
  animToggle?.addEventListener('change', () => {
    document.body.classList.toggle('reduce-motion', animToggle.checked);
    localStorage.setItem('reduce-anim', animToggle.checked ? '1' : '0');
  });

  // ── Global: protect images ──
  document.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.card-images, .profile-grid-item')) e.preventDefault();
  });
  document.addEventListener('selectstart', (e) => {
    if (e.target.closest('.card-images, .profile-grid-item')) e.preventDefault();
  });
});
