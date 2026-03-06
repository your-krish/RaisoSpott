// js/auth.js — works across all pages
let currentUser = null;
let currentProfile = null;

async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) await handleSession(session);

  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session) {
      await handleSession(session);
      if (!window.location.pathname.includes('profile')) {
        window.location.href = 'profile.html';
      }
    } else {
      currentUser = null;
      currentProfile = null;
      updateAuthUI(false);
    }
  });
}

async function handleSession(session) {
  currentUser = session.user;
  const { data: existing } = await supabase
    .from('profiles').select('*').eq('id', currentUser.id).single();

  if (existing) {
    currentProfile = existing;
    if (!existing.avatar_url && currentUser.user_metadata?.avatar_url) {
      const { data: updated } = await supabase.from('profiles')
        .update({ avatar_url: currentUser.user_metadata.avatar_url })
        .eq('id', currentUser.id).select().single();
      if (updated) currentProfile = updated;
    }
  } else {
    const { data: created } = await supabase.from('profiles').insert({
      id: currentUser.id,
      name: currentUser.user_metadata?.full_name || 'Student',
      avatar_url: currentUser.user_metadata?.avatar_url || '',
      email: currentUser.email,
    }).select().single();
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
    if (typeof updateProfilePage === 'function') updateProfilePage();
  } else {
    avatarWrap?.classList.add('hidden');
    headerLoginBtn?.classList.remove('hidden');
    settingsProfile?.classList.add('hidden');
    settingsGuest?.classList.remove('hidden');
  }
}

function updateProfilePage() {
  if (!currentUser || !currentProfile) return;
  const avatarUrl = currentProfile.avatar_url || currentUser.user_metadata?.avatar_url || '';
  const displayName = currentProfile.name || currentUser.user_metadata?.full_name || 'Student';
  const avatarImg = document.getElementById('profile-avatar-img');
  const usernameDisplay = document.getElementById('profile-username-display');
  const emailDisplay = document.getElementById('profile-email-display');
  const nameInput = document.getElementById('profile-name-input');
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
  const { error } = await supabase.from('profiles').update({ name }).eq('id', currentUser.id);
  if (!error) {
    if (currentProfile) currentProfile.name = name;
    document.getElementById('profile-username-display').textContent = name;
    const sName = document.getElementById('settings-name');
    if (sName) sName.textContent = name;
    showToast('Name saved ✅');
  } else { showToast('Failed: ' + error.message); }
}

async function handleAvatarUpload(file) {
  if (!file || !currentUser) return;
  showToast('Uploading...');
  try {
    const resized = await resizeImage(file);
    if (!resized) { showToast('Image processing failed'); return; }
    const path = `${currentUser.id}/avatar.jpg`;
    const { error: upErr } = await supabase.storage.from('avatars')
      .upload(path, resized, { upsert: true, contentType: 'image/jpeg' });
    if (upErr) throw upErr;
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
    const finalUrl = publicUrl + '?t=' + Date.now();
    const { error: dbErr } = await supabase.from('profiles')
      .update({ avatar_url: finalUrl }).eq('id', currentUser.id);
    if (dbErr) throw dbErr;
    if (currentProfile) currentProfile.avatar_url = finalUrl;
    document.getElementById('profile-avatar-img').src = finalUrl;
    document.getElementById('user-avatar').src = finalUrl;
    const sa = document.getElementById('settings-avatar');
    if (sa) sa.src = finalUrl;
    showToast('Profile photo updated ✅');
  } catch (err) { showToast('Upload failed: ' + err.message); }
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
  window.location.href = 'index.html';
}

function isAdmin() { return currentProfile?.is_admin === true; }
