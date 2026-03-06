// js/feed.js
let currentFilter = 'all';
let currentCommentPostId = null;
let editingPostId = null;
let reportingPostId = null;

// ============================================================
// FEED LOADING
// ============================================================
async function loadFeed(filter = 'all') {
  currentFilter = filter;
  const container = document.getElementById('feed-container');
  const hint = document.getElementById('refresh-hint');
  container.innerHTML = `
    <div class="skeleton-loader">
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    </div>`;
  if (hint) hint.style.display = 'none';

  try {
    let query = supabase
      .from('posts_with_counts')
      .select('*')
      .eq('status', 'active')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(30);

    if (filter !== 'all') query = query.eq('type', filter);

    const { data: posts, error } = await query;
    if (error) throw error;

    container.innerHTML = '';

    if (!posts || posts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <h3>No posts yet</h3>
          <p>Be the first to post something!</p>
        </div>`;
      if (hint) hint.style.display = 'block';
      return;
    }

    posts.forEach(post => container.appendChild(renderPost(post)));
    if (currentUser) loadUserLikes(posts.map(p => p.id));
  } catch (err) {
    container.innerHTML = '<div class="no-results">Failed to load feed.</div>';
    if (hint) hint.style.display = 'block';
    console.error('Feed error:', err);
  }
}

// ============================================================
// RENDER POST CARD — used in feed AND profile
// ============================================================
function renderPost(post, options = {}) {
  const { fromProfile = false } = options;

  const card = document.createElement('div');
  card.className = 'post-card' + (post.type === 'confession' ? ' confession-card' : '');
  card.dataset.postId = post.id;

  const isConfession = post.type === 'confession';
  const isAnnouncement = post.type === 'announcement';
  const isEvent = post.type === 'event';
  // owner OR admin can manage
  const isOwner = currentUser && (post.user_id === currentUser.id || isAdmin());

  const authorName = isConfession ? 'Anonymous 🎭' : (post.author_name || 'Student');
  const authorAvatar = isConfession ? '' : (post.author_avatar || '');

  const badgeHtml = isAnnouncement
    ? '<span class="card-badge badge-announcement">📌 Pinned</span>'
    : isEvent
      ? '<span class="card-badge badge-event">📅 Event</span>'
      : isConfession
        ? '<span class="card-badge badge-confession">🎭 Confession</span>'
        : '';

  const pinnedHtml = post.is_pinned
    ? '<div class="pinned-indicator">📌 Pinned announcement</div>'
    : '';

  const imagesHtml = (() => {
    if (!post.images || post.images.length === 0) return '';
    const cls = post.images.length === 1 ? 'one-img' : 'two-img';
    const imgs = post.images.map(url =>
      `<img src="${url}" alt="" loading="lazy" draggable="false" oncontextmenu="return false" />`
    ).join('');
    return `<div class="card-images ${cls}">${imgs}</div>`;
  })();

  const categoryHtml = (isConfession && post.confession_category)
    ? `<div class="card-category">${getCategoryLabel(post.confession_category)}</div>`
    : '';

  card.innerHTML = `
    ${pinnedHtml}
    <div class="card-header">
      <div class="card-avatar">
        ${authorAvatar ? `<img src="${authorAvatar}" alt="" />` : '🎭'}
      </div>
      <div class="card-meta">
        <div class="card-name">${escapeHtml(authorName)}</div>
        <div class="card-time">${timeAgo(post.created_at)}</div>
      </div>
      ${badgeHtml}
      <button class="post-menu-btn" data-post-id="${post.id}" aria-label="Post options">⋯</button>
    </div>
    ${imagesHtml}
    ${post.caption ? `<div class="card-caption">${escapeHtml(post.caption)}</div>` : ''}
    ${categoryHtml}
    <div class="card-actions">
      <button class="action-btn like-btn" data-id="${post.id}">
        ❤️ <span class="like-count">${post.like_count || 0}</span>
      </button>
      <button class="action-btn comment-btn" data-id="${post.id}">
        💬 <span class="comment-count">${post.comment_count || 0}</span>
      </button>
    </div>
  `;

  // ── 3-dot menu ──
  card.querySelector('.post-menu-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.post-menu-dropdown').forEach(d => d.remove());

    const dropdown = document.createElement('div');
    dropdown.className = 'post-menu-dropdown';

    if (isOwner) {
      dropdown.innerHTML = `
        <button class="menu-edit-btn">✏️ Edit Caption</button>
        <button class="menu-delete-btn danger-opt">🗑️ Delete Post</button>
      `;
      dropdown.querySelector('.menu-edit-btn').addEventListener('click', () => {
        dropdown.remove();
        openEditCaption(post.id, post.caption);
      });
      dropdown.querySelector('.menu-delete-btn').addEventListener('click', () => {
        dropdown.remove();
        deletePost(post.id, post.images || [], card);
      });
    } else {
      dropdown.innerHTML = `
        <button class="menu-report-btn">🚩 Report Post</button>
        <button class="menu-hide-btn">🙈 Hide Post</button>
      `;
      dropdown.querySelector('.menu-report-btn').addEventListener('click', () => {
        dropdown.remove();
        requireAuth(() => openReportModal(post.id));
      });
      dropdown.querySelector('.menu-hide-btn').addEventListener('click', () => {
        dropdown.remove();
        card.style.display = 'none';
        showToast('Post hidden');
      });
    }

    card.appendChild(dropdown);
    // Close on next outside click
    setTimeout(() => {
      document.addEventListener('click', function handler() {
        dropdown.remove();
        document.removeEventListener('click', handler);
      });
    }, 0);
  });

  // ── Like ──
  card.querySelector('.like-btn').addEventListener('click', () => {
    requireAuth(() => toggleLike(post.id));
  });

  // ── Comments ──
  card.querySelector('.comment-btn').addEventListener('click', () => {
    openComments(post.id);
  });

  return card;
}

// ============================================================
// EDIT CAPTION
// ============================================================
function openEditCaption(postId, currentCaption) {
  editingPostId = postId;
  document.getElementById('edit-caption-text').value = currentCaption || '';
  showModal('edit-caption-modal');
}

async function saveEditedCaption() {
  if (!editingPostId || !currentUser) return;
  const text = document.getElementById('edit-caption-text').value.trim();

  // Admin can edit any post; owner can only edit own
  let query = supabase.from('posts').update({ caption: text }).eq('id', editingPostId);
  if (!isAdmin()) query = query.eq('user_id', currentUser.id);

  const { error } = await query;
  if (!error) {
    closeAllModals();
    showToast('Caption updated ✅');
    loadFeed(currentFilter);
    if (currentPage === 'profile') loadProfilePosts();
  } else {
    showToast('Failed: ' + error.message);
  }
}

// ============================================================
// DELETE POST — fix: actually deletes row + storage
// ============================================================
async function deletePost(postId, images, cardEl) {
  if (!currentUser) return;
  if (!confirm('Delete this post? This cannot be undone.')) return;

  // Build query: admin can delete any post; owner only their own
  let query = supabase.from('posts').delete().eq('id', postId);
  if (!isAdmin()) query = query.eq('user_id', currentUser.id);

  const { error } = await query;

  if (error) {
    showToast('Delete failed: ' + error.message);
    return;
  }

  // Delete images from storage
  if (images && images.length > 0) {
    const paths = images.map(url => {
      try {
        const u = new URL(url);
        // path after /object/public/post-images/
        const parts = u.pathname.split('/post-images/');
        return parts[1] || null;
      } catch { return null; }
    }).filter(Boolean);

    if (paths.length > 0) {
      await supabase.storage.from('post-images').remove(paths);
    }
  }

  // Animate removal
  if (cardEl) {
    cardEl.style.transition = 'opacity 0.3s, transform 0.3s';
    cardEl.style.opacity = '0';
    cardEl.style.transform = 'scale(0.95)';
    setTimeout(() => cardEl.remove(), 300);
  }

  showToast('Post deleted 🗑️');
  if (currentPage === 'profile') loadProfilePosts();
}

// ============================================================
// REPORT MODAL — with categories
// ============================================================
function openReportModal(postId) {
  reportingPostId = postId;
  // reset
  document.querySelectorAll('.report-cat-btn').forEach(b => b.classList.remove('selected'));
  const otherInput = document.getElementById('report-other-input');
  if (otherInput) { otherInput.value = ''; otherInput.classList.add('hidden'); }
  showModal('report-modal');
}

async function submitReport() {
  if (!currentUser || !reportingPostId) return;

  const selected = document.querySelector('.report-cat-btn.selected');
  if (!selected) { showToast('Select a reason'); return; }

  const category = selected.dataset.cat;
  const otherText = document.getElementById('report-other-input')?.value.trim() || '';
  const reason = category === 'other' && otherText ? otherText : selected.textContent.trim();

  const btn = document.getElementById('submit-report-btn');
  btn.textContent = 'Submitting...';
  btn.disabled = true;

  try {
    // Check for duplicate
    const { data: existing } = await supabase
      .from('reports')
      .select('id')
      .eq('post_id', reportingPostId)
      .eq('reporter_id', currentUser.id)
      .single();

    if (existing) {
      showToast('You already reported this post');
      closeAllModals();
      return;
    }

    // Build insert — category column may not exist on older schemas
    const insertData = {
      post_id: reportingPostId,
      reporter_id: currentUser.id,
      reason: reason,
    };
    // Only include category if it's defined (safe for both old and new schema)
    if (category) insertData.category = category;

    const { error } = await supabase.from('reports').insert(insertData);

    if (error) throw error;

    closeAllModals();
    showToast('Post reported. Thank you 🚩');
    reportingPostId = null;
  } catch (err) {
    showToast('Failed: ' + err.message);
  } finally {
    btn.textContent = 'Submit Report';
    btn.disabled = false;
  }
}

// ============================================================
// LIKES
// ============================================================
async function loadUserLikes(postIds) {
  if (!currentUser || postIds.length === 0) return;
  const { data } = await supabase
    .from('likes')
    .select('post_id')
    .eq('user_id', currentUser.id)
    .in('post_id', postIds);

  if (data) {
    data.forEach(like => {
      document.querySelectorAll(`.like-btn[data-id="${like.post_id}"]`).forEach(btn => {
        btn.classList.add('liked');
      });
    });
  }
}

async function toggleLike(postId) {
  const btns = document.querySelectorAll(`.like-btn[data-id="${postId}"]`);
  const isLiked = btns[0]?.classList.contains('liked');

  btns.forEach(btn => {
    btn.classList.toggle('liked', !isLiked);
    const countEl = btn.querySelector('.like-count');
    if (countEl) {
      const n = parseInt(countEl.textContent || '0');
      countEl.textContent = isLiked ? n - 1 : n + 1;
    }
  });

  if (isLiked) {
    await supabase.from('likes').delete()
      .eq('post_id', postId).eq('user_id', currentUser.id);
  } else {
    const { error } = await supabase.from('likes').insert({
      post_id: postId, user_id: currentUser.id
    });
    if (error && error.code === '23505') {
      // Already liked — revert
      btns.forEach(btn => {
        btn.classList.add('liked');
        const countEl = btn.querySelector('.like-count');
        if (countEl) countEl.textContent = parseInt(countEl.textContent) - 1 + 1;
      });
    }
  }
}

// ============================================================
// COMMENTS
// ============================================================
async function openComments(postId) {
  currentCommentPostId = postId;
  showModal('comment-modal');
  const list = document.getElementById('comments-list');
  list.innerHTML = '<p style="text-align:center;color:var(--text3);padding:20px">Loading...</p>';

  const { data: comments } = await supabase
    .from('comments_with_author')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  list.innerHTML = '';

  if (!comments || comments.length === 0) {
    list.innerHTML = '<p style="text-align:center;color:var(--text3);padding:20px">No comments yet. Be first!</p>';
    return;
  }

  comments.forEach(c => {
    const el = document.createElement('div');
    el.className = 'comment-item';
    el.innerHTML = `
      <div class="comment-avatar">
        ${c.author_avatar ? `<img src="${c.author_avatar}" alt="" />` : '👤'}
      </div>
      <div class="comment-bubble">
        <div class="comment-author">${escapeHtml(c.author_name || 'Student')}</div>
        <div class="comment-text">${escapeHtml(c.content)}</div>
        <div class="comment-time">${timeAgo(c.created_at)}</div>
      </div>`;
    list.appendChild(el);
  });

  // Scroll to bottom
  list.scrollTop = list.scrollHeight;
}

async function submitComment() {
  if (!currentUser) return;
  const input = document.getElementById('comment-input');
  const content = input.value.trim();
  if (!content) return;
  input.value = '';

  const { error } = await supabase.from('comments').insert({
    post_id: currentCommentPostId,
    user_id: currentUser.id,
    content,
  });

  if (!error) {
    openComments(currentCommentPostId);
    // Update comment count on all matching cards
    document.querySelectorAll(`.comment-btn[data-id="${currentCommentPostId}"] .comment-count`).forEach(el => {
      el.textContent = parseInt(el.textContent || '0') + 1;
    });
  }
}

// ============================================================
// IMAGE UPLOAD — definitive mobile fix
// ============================================================
let _selectedImages = [];
window._selectedImages = _selectedImages;

function initImageUpload() {
  const dropZone = document.getElementById('image-drop-zone');
  const input = document.getElementById('image-input');
  if (!dropZone || !input) return;

  // Make the whole drop zone tappable on mobile by overlaying the input
  Object.assign(input.style, {
    position: 'absolute',
    top: '0', left: '0',
    width: '100%', height: '100%',
    opacity: '0',
    cursor: 'pointer',
    zIndex: '2',
    fontSize: '0', // stops iOS zoom
  });
  dropZone.style.position = 'relative';
  dropZone.style.overflow = 'hidden';

  // Use 'change' — most reliable across all mobile browsers
  input.addEventListener('change', function () {
    if (!this.files || this.files.length === 0) return;
    const files = Array.from(this.files);
    handleImageFiles(files);
    // Reset so the same file can be re-selected
    try { this.value = ''; } catch (_) {}
  });

  // Drag & drop (desktop)
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    handleImageFiles(Array.from(e.dataTransfer.files));
  });
}

function handleImageFiles(files) {
  const allowed = files.filter(f => f.type.startsWith('image/'));
  const slots = 2 - _selectedImages.length;
  if (slots <= 0) { showToast('Max 2 images allowed'); return; }
  const toAdd = allowed.slice(0, slots);
  toAdd.forEach(f => _selectedImages.push(f));
  window._selectedImages = _selectedImages;
  renderPreviews();
}

function renderPreviews() {
  const container = document.getElementById('image-previews');
  if (!container) return;
  container.innerHTML = '';

  _selectedImages.forEach((file, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'preview-wrap';

    const img = document.createElement('img');
    // Use createObjectURL — faster and more reliable on mobile than FileReader
    img.src = URL.createObjectURL(file);
    img.onload = () => URL.revokeObjectURL(img.src); // free memory after load
    img.style.cssText = 'width:100%;height:120px;object-fit:cover;border-radius:8px;display:block;';

    const removeBtn = document.createElement('button');
    removeBtn.className = 'preview-remove';
    removeBtn.textContent = '✕';
    removeBtn.type = 'button'; // prevent form submit on mobile
    removeBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      _selectedImages.splice(i, 1);
      window._selectedImages = _selectedImages;
      renderPreviews();
    });

    wrap.appendChild(img);
    wrap.appendChild(removeBtn);
    container.appendChild(wrap);
  });
}

async function submitImagePost() {
  if (!currentUser) return;
  const captionEl = document.getElementById('post-caption');
  const caption = captionEl.value.trim();
  const files = [...(_selectedImages || [])];

  if (!caption && files.length === 0) {
    showToast('Add a caption or image');
    return;
  }

  // Daily limit check
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', currentUser.id)
    .gte('created_at', today.toISOString());
  if (count >= 4) { showToast('Max 4 posts per day reached'); return; }

  const btn = document.getElementById('submit-post');
  btn.textContent = 'Posting...';
  btn.disabled = true;

  try {
    const imageUrls = [];

    for (const file of files) {
      const resized = await resizeImage(file);
      if (!resized) continue;
      const ext = 'jpg';
      const path = `${currentUser.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('post-images')
        .upload(path, resized, { contentType: 'image/jpeg', upsert: false });

      if (upErr) {
        console.error('Upload error:', upErr);
        showToast('Image upload failed, posting without it');
        continue;
      }

      const { data: { publicUrl } } = supabase.storage.from('post-images').getPublicUrl(path);
      imageUrls.push(publicUrl);
    }

    const { error } = await supabase.from('posts').insert({
      user_id: currentUser.id,
      type: imageUrls.length > 0 ? 'image' : 'text',
      caption,
      images: imageUrls,
      status: 'active',
    });

    if (error) throw error;

    _selectedImages = [];
    window._selectedImages = _selectedImages;
    captionEl.value = '';
    closeAllModals();
    showToast('Post shared! 🚀');
    loadFeed(currentFilter);
    loadProfilePosts();
  } catch (err) {
    showToast('Failed: ' + err.message);
    console.error('Post error:', err);
  } finally {
    btn.textContent = 'Post 🚀';
    btn.disabled = false;
  }
}

async function submitConfession() {
  if (!currentUser) return;
  const text = document.getElementById('confession-text').value.trim();
  const category = document.getElementById('confession-category').value;
  if (!text) { showToast('Write your confession first'); return; }
  if (!category) { showToast('Select a category'); return; }

  const btn = document.getElementById('submit-confession');
  btn.textContent = 'Submitting...';
  btn.disabled = true;

  try {
    const { error } = await supabase.from('posts').insert({
      user_id: currentUser.id,
      type: 'confession',
      caption: text,
      confession_category: category,
      status: 'active',
    });
    if (error) throw error;
    closeAllModals();
    showToast('Confession submitted anonymously 🎭');
    loadFeed(currentFilter);
  } catch (err) {
    showToast('Failed: ' + err.message);
  } finally {
    btn.textContent = 'Confess Anonymously 🎭';
    btn.disabled = false;
  }
}

// ============================================================
// IMAGE RESIZE
// ============================================================
function resizeImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve(null);
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => resolve(null);
      img.onload = () => {
        const maxW = 1200;
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(blob => resolve(blob || null), 'image/jpeg', 0.85);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ============================================================
// PROFILE GRID — with tap-to-open and 3-dot menu
// ============================================================
async function loadProfilePosts() {
  if (!currentUser) return;
  const grid = document.getElementById('profile-grid');
  const emptyState = document.getElementById('profile-empty');
  if (!grid) return;
  grid.innerHTML = '';

  const { data: posts } = await supabase
    .from('posts_with_counts')
    .select('*')
    .eq('user_id', currentUser.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  const postCount = document.getElementById('profile-post-count');
  const likeCount = document.getElementById('profile-like-count');
  if (postCount) postCount.textContent = posts?.length || 0;
  const totalLikes = posts?.reduce((sum, p) => sum + (p.like_count || 0), 0) || 0;
  if (likeCount) likeCount.textContent = totalLikes;

  if (!posts || posts.length === 0) {
    emptyState?.classList.remove('hidden');
    return;
  }
  emptyState?.classList.add('hidden');

  posts.forEach(post => {
    const item = document.createElement('div');
    item.className = 'profile-grid-item';
    item.style.cursor = 'pointer';

    if (post.images && post.images.length > 0) {
      const img = document.createElement('img');
      img.src = post.images[0];
      img.alt = '';
      img.loading = 'lazy';
      img.draggable = false;
      img.style.pointerEvents = 'none';
      img.addEventListener('contextmenu', e => e.preventDefault());
      item.appendChild(img);
    } else {
      const text = document.createElement('div');
      text.className = 'profile-grid-text';
      text.textContent = post.type === 'confession'
        ? '🎭 Confession'
        : (post.caption?.slice(0, 40) || '');
      item.appendChild(text);
    }

    // Tap → open post in full-view overlay
    item.addEventListener('click', () => openPostOverlay(post));

    grid.appendChild(item);
  });
}

// Full-screen post overlay for profile grid tap
function openPostOverlay(post) {
  // Remove existing overlay
  document.getElementById('post-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'post-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:300;background:rgba(0,0,0,0.7);
    display:flex;align-items:flex-end;justify-content:center;
    animation:fadeIn 0.2s ease;
  `;

  const inner = document.createElement('div');
  inner.style.cssText = `
    background:var(--surface);border-radius:24px 24px 0 0;
    width:100%;max-width:600px;max-height:90vh;overflow-y:auto;
    padding-bottom:16px;animation:slideUp 0.3s ease;
  `;

  // Build a full post card inside
  const postCard = renderPost(post, { fromProfile: true });
  postCard.style.margin = '0';
  postCard.style.borderRadius = '0';
  postCard.style.boxShadow = 'none';

  const closeBar = document.createElement('div');
  closeBar.style.cssText = `
    display:flex;justify-content:flex-end;padding:12px 16px 4px;
  `;
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = `
    background:var(--surface2);border:none;border-radius:50%;
    width:30px;height:30px;font-size:16px;cursor:pointer;
    display:flex;align-items:center;justify-content:center;
  `;
  closeBtn.addEventListener('click', () => overlay.remove());
  closeBar.appendChild(closeBtn);

  inner.appendChild(closeBar);
  inner.appendChild(postCard);
  overlay.appendChild(inner);

  // Close on backdrop tap
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  document.body.appendChild(overlay);
}

// ============================================================
// HELPERS
// ============================================================
function getCategoryLabel(cat) {
  const map = {
    crush: '💕 Crush / Love',
    rant: '😤 College Rant',
    funny: '😂 Funny / Embarrassing',
    academic: '📚 Academic Stress',
    social: '👥 Friends / Social Life',
    secret: '🤫 Secret / Guilt',
    motivation: '💪 Motivation / Positivity',
    other: '💬 Other',
  };
  return map[cat] || cat;
}
