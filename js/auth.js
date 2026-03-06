// js/auth.js
let currentUser = null;
let currentProfile = null;

async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) await handleSession(session);

  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session) {
      await handleSession(session);
      navigateTo('profile');
    } else {
      currentUser = null;
      currentProfile = null;
      updateAuthUI(false);
    }
  });
}

// ============================================================
// SESSION HANDLER — persists DP from profiles table, not metadata
// ============================================================
async function handleSession(session) {
  currentUser = session.user;

  // First try to fetch existing profile (to preserve custom DP / name)
  const { data: existing } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', currentUser.id)
    .single();

  if (existing) {
    // Profile exists — use saved data (preserves custom avatar + name)
    currentProfile = existing;

    // If no avatar saved yet, sync from Google
    if (!existing.avatar_url && currentUser.user_metadata?.avatar_url) {
      const { data: updated } = await supabase
        .from('profiles')
        .update({ avatar_url: currentUser.user_metadata.avatar_url })
        .eq('id', currentUser.id)
        .select()
        .single();
      if (updated) currentProfile = updated;
    }
  } else {
    // New user — create profile
    const { data: created } = await supabase
      .from('profiles')
      .insert({
        id: currentUser.id,
        name: currentUser.user_metadata?.full_name || 'Student',
        avatar_url: currentUser.user_metadata?.avatar_url || '',
        email: currentUser.email,
      })
      .select()
      .single();
    currentProfile = created;
  }

  updateAuthUI(true);
}

function updateAuthUI(loggedIn) {
  const avatarWrap = document.getElementById('user-avatar-wrap');
  const headerLoginBtn = document.getElementById('header-login-btn');
  const settingsProfile = document.getElementById('settings-profile-inline');
  const settingsGuest = document.getElementById('settings-guest-inline');

  if (loggedIn && currentUser) {
    avatarWrap?.classList.remove('hidden');
    headerLoginBtn?.classList.add('hidden');

    // Use profile avatar (custom DP persists across refreshes)
    const avatarUrl = currentProfile?.avatar_url || currentUser.user_metadata?.avatar_url || '';
    const headerAvatar = document.getElementById('user-avatar');
    if (headerAvatar) headerAvatar.src = avatarUrl;

    settingsProfile?.classList.remove('hidden');
    settingsGuest?.classList.add('hidden');

    const sName = document.getElementById('settings-name');
    const sEmail = document.getElementById('settings-email');
    const sAvatar = document.getElementById('settings-avatar');
    if (sName) sName.textContent = currentProfile?.name || currentUser.user_metadata?.full_name || 'Student';
    if (sEmail) sEmail.textContent = currentUser.email;
    if (sAvatar) sAvatar.src = avatarUrl;

    updateProfilePage();
  } else {
    avatarWrap?.classList.add('hidden');
    headerLoginBtn?.classList.remove('hidden');
    settingsProfile?.classList.add('hidden');
    settingsGuest?.classList.remove('hidden');
  }
}

// ============================================================
// PROFILE PAGE DATA
// ============================================================
function updateProfilePage() {
  if (!currentUser || !currentProfile) return;

  const avatarImg = document.getElementById('profile-avatar-img');
  const usernameDisplay = document.getElementById('profile-username-display');
  const emailDisplay = document.getElementById('profile-email-display');
  const nameInput = document.getElementById('profile-name-input');

  // Always use profiles table data — this is the source of truth
  const avatarUrl = currentProfile.avatar_url || currentUser.user_metadata?.avatar_url || '';
  const displayName = currentProfile.name || currentUser.user_metadata?.full_name || 'Student';

  if (avatarImg) avatarImg.src = avatarUrl;
  if (usernameDisplay) usernameDisplay.textContent = displayName;
  if (emailDisplay) emailDisplay.textContent = currentUser.email;
  if (nameInput) nameInput.value = currentProfile.name || '';
}

async function saveProfileName() {
  if (!currentUser) return;
  const input = document.getElementById('profile-name-input');
  const name = input?.value.trim();
  if (!name) { showToast('Name cannot be empty'); return; }

  const { error } = await supabase
    .from('profiles')
    .update({ name })
    .eq('id', currentUser.id);

  if (!error) {
    if (currentProfile) currentProfile.name = name;
    const usernameDisplay = document.getElementById('profile-username-display');
    const settingsName = document.getElementById('settings-name');
    if (usernameDisplay) usernameDisplay.textContent = name;
    if (settingsName) settingsName.textContent = name;
    showToast('Name saved ✅');
  } else {
    showToast('Failed: ' + error.message);
  }
}

// ============================================================
// AVATAR UPLOAD — persists correctly to profiles table
// ============================================================
async function handleAvatarUpload(file) {
  if (!file || !currentUser) return;

  showToast('Uploading...');

  try {
    const resized = await resizeImage(file);
    if (!resized) { showToast('Image processing failed'); return; }

    // Always use same path so it overwrites (upsert)
    const path = `${currentUser.id}/avatar.jpg`;
    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(path, resized, {
        upsert: true,
        contentType: 'image/jpeg',
      });

    if (upErr) throw upErr;

    // Get public URL (add cache-buster so browser doesn't show old image)
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
    const finalUrl = publicUrl + '?t=' + Date.now();

    // Save to profiles table — THIS is what persists across refreshes
    const { error: dbErr } = await supabase
      .from('profiles')
      .update({ avatar_url: finalUrl })
      .eq('id', currentUser.id);

    if (dbErr) throw dbErr;

    // Update in-memory profile
    if (currentProfile) currentProfile.avatar_url = finalUrl;

    // Update all avatar images on page
    document.getElementById('profile-avatar-img').src = finalUrl;
    document.getElementById('user-avatar').src = finalUrl;
    const settingsAvatar = document.getElementById('settings-avatar');
    if (settingsAvatar) settingsAvatar.src = finalUrl;

    showToast('Profile photo updated ✅');
  } catch (err) {
    showToast('Upload failed: ' + err.message);
    console.error('Avatar upload error:', err);
  }
}

async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: 'https://your-krish.github.io/RaisoSpot/index.html' }
  });
  if (error) showToast('Login failed: ' + error.message);
}

async function signOut() {
  await supabase.auth.signOut();
  showToast('Logged out');
  navigateTo('feed');
}

function requireAuth(callback) {
  if (currentUser) callback();
  else showModal('login-modal');
}

function isAdmin() {
  return currentProfile?.is_admin === true;
}
