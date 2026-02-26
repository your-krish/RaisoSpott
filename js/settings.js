// js/settings.js
let currentLFTab = 'lost';

async function loadLostFound(tab = 'lost') {
  currentLFTab = tab;
  const container = document.getElementById('lost-found-container');
  if (!container) return;
  container.innerHTML = '<p style="text-align:center;padding:20px;color:var(--text3)">Loading...</p>';

  const { data } = await supabase.from('lost_found').select('*').eq('status', tab)
    .order('created_at', { ascending: false }).limit(10);

  container.innerHTML = '';
  if (!data || data.length === 0) {
    container.innerHTML = `<p style="text-align:center;padding:20px;color:var(--text3);font-size:13px">No ${tab} items found.</p>`;
    return;
  }
  data.forEach(item => {
    const el = document.createElement('div');
    el.className = 'lf-item';
    el.innerHTML = `
      <div class="lf-item-header">
        <span class="lf-item-name">${escapeHtml(item.name)}</span>
        <span class="lf-status status-${item.status}">${item.status}</span>
      </div>
      <div class="lf-location">📍 ${escapeHtml(item.location || 'Unknown')} · ${timeAgo(item.created_at)}</div>
      ${item.contact ? `<div style="font-size:12px;color:var(--text2);margin-top:4px">📞 ${escapeHtml(item.contact)}</div>` : ''}`;
    container.appendChild(el);
  });
}

async function submitLostItem() {
  if (!currentUser) { showModal('login-modal'); return; }
  const type = document.getElementById('item-type').value;
  const name = document.getElementById('item-name').value.trim();
  const location = document.getElementById('item-location').value.trim();
  const contact = document.getElementById('item-contact').value.trim();
  if (!name) { showToast('Enter item description'); return; }

  const { error } = await supabase.from('lost_found').insert({ user_id: currentUser.id, name, location, contact, status: type });
  if (!error) {
    closeAllModals();
    showToast('Item reported!');
    loadLostFound(type);
  } else {
    showToast('Failed: ' + error.message);
  }
}

async function submitBugReport() {
  const text = document.getElementById('bug-text').value.trim();
  if (!text) { showToast('Describe the bug first'); return; }
  const { error } = await supabase.from('bug_reports').insert({ user_id: currentUser?.id || null, description: text });
  if (!error) {
    closeAllModals();
    showToast('Bug reported! Thank you 🙏');
    document.getElementById('bug-text').value = '';
  }
}
