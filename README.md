# RaisoSpot – Complete PWA Setup Guide

> A student-run campus platform for GH Raisoni College students.
> **Not officially managed, endorsed, or affiliated with GH Raisoni College.**

---

## File Structure

```
raisospot/
├── index.html          ← Main SPA entry point
├── manifest.json       ← PWA manifest
├── schema.sql          ← Full Supabase SQL schema + RLS
├── css/
│   └── style.css       ← All styles (light/dark mode, mobile-first)
└── js/
    ├── config.js       ← Supabase credentials
    ├── auth.js         ← Google OAuth + session management
    ├── feed.js         ← Feed, posts, likes, comments
    ├── academics.js    ← Academics section
    ├── opportunities.js ← Opportunities board
    ├── settings.js     ← Settings, Lost & Found, bug reports
    └── app.js          ← Navigation, routing, event wiring
```

---

## Setup Steps

### 1. Create Supabase Project
1. Go to https://supabase.com → New Project
2. Choose a strong password, pick a region near India (Singapore)

### 2. Run the SQL Schema
1. Supabase Dashboard → SQL Editor → New Query
2. Paste the entire contents of `schema.sql` and run it
3. Uncomment the seed data block at the bottom and run it too

### 3. Enable Google OAuth
1. Supabase Dashboard → Authentication → Providers → Google
2. Enable Google and fill in your OAuth credentials from Google Cloud Console
3. Add your site URL to "Redirect URLs" in Supabase Auth Settings

### 4. Create Storage Buckets
1. Supabase Dashboard → Storage → New Bucket
2. Create: `post-images` (public), `lost-found` (public), `avatars` (public)
3. For each bucket, add policies:
   - SELECT: `true` (public reads)
   - INSERT: `auth.uid() is not null` (logged-in users only)

### 5. Configure the App
Open `js/config.js` and replace:
```js
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
```
Find these in: Supabase Dashboard → Settings → API

### 6. Deploy
Upload all files to any static hosting:
- **Netlify** (drag & drop the folder) ← Recommended
- GitHub Pages
- Vercel
- Firebase Hosting

Make sure to add your deployed URL to Supabase Auth → URL Configuration → Redirect URLs.

---

## Make Yourself Admin

After deploying and signing in with Google once:
```sql
update profiles set is_admin = true where email = 'your@email.com';
```

Admins can post Announcements (the Announcement option appears in the create menu).

---

## Frontend ↔ Supabase Connection

| Feature | Supabase Usage |
|---|---|
| Auth | `supabase.auth.signInWithOAuth({ provider: 'google' })` |
| Read Feed | `supabase.from('posts_with_counts').select('*')` |
| Like Post | `supabase.from('likes').insert(...)` or `.delete()` |
| Comments | `supabase.from('comments_with_author').select(...)` |
| Upload Image | `supabase.storage.from('post-images').upload(...)` |
| Academics | `supabase.from('academic_resources').select(...)` |
| Opportunities | `supabase.from('opportunities').select(...)` |
| Lost & Found | `supabase.from('lost_found').select/insert(...)` |
| Bug Reports | `supabase.from('bug_reports').insert(...)` |

All reads are anonymous-accessible. All writes require auth.uid().
RLS is enforced at the database level — the frontend cannot bypass it.

---

## Key Design Decisions

- **No React** — Pure HTML/CSS/JS with modular file separation
- **SPA routing** — Single `index.html`, sections shown/hidden via JS
- **Optimistic UI** — Likes update instantly, synced in background
- **Client-side image resize** — Images scaled to max 1200px before upload, reducing bandwidth
- **Confessions are anonymous in UI** — The `user_id` is stored in DB for moderation but never exposed to frontend queries (confession posts render as "Anonymous 🎭")
- **4 posts/day limit** — Enforced by a PostgreSQL trigger (cannot be bypassed by the frontend)
- **RLS everywhere** — Every table has RLS policies; anon users are read-only
