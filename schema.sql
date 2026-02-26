-- ============================================================
-- RaisoSpot – Complete Supabase SQL Schema
-- ============================================================
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

-- PROFILES
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  avatar_url text,
  is_admin boolean default false,
  created_at timestamptz default now()
);

-- POSTS (includes image posts, confessions, announcements, events)
create table if not exists posts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade,
  type text check (type in ('image', 'confession', 'announcement', 'event')) default 'image',
  caption text,
  images text[], -- array of public storage URLs
  confession_category text,
  is_pinned boolean default false,
  status text check (status in ('active', 'hidden', 'removed')) default 'active',
  created_at timestamptz default now()
);

-- LIKES
create table if not exists likes (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid references posts(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(post_id, user_id)
);

-- COMMENTS
create table if not exists comments (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid references posts(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  content text not null,
  status text check (status in ('active', 'hidden')) default 'active',
  created_at timestamptz default now()
);

-- EVENTS
create table if not exists events (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  type text check (type in ('seminar', 'webinar', 'hackathon', 'competition', 'other')),
  start_time timestamptz,
  end_time timestamptz,
  location text,
  status text check (status in ('active', 'expired')) default 'active',
  created_at timestamptz default now()
);

-- EVENT RSVP
create table if not exists event_rsvp (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid references events(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  status text check (status in ('interested', 'going')) default 'interested',
  created_at timestamptz default now(),
  unique(event_id, user_id)
);

-- LOST & FOUND
create table if not exists lost_found (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade,
  name text not null,
  description text,
  location text,
  contact text,
  image_url text,
  status text check (status in ('lost', 'found', 'resolved')) default 'lost',
  created_at timestamptz default now()
);

-- ACADEMIC RESOURCES
create table if not exists academic_resources (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade,
  year int check (year between 1 and 4),
  division text,
  subject text, -- subject abbreviation
  type text check (type in ('notes', 'question-bank', 'question-papers')),
  title text not null,
  url text,
  status text check (status in ('pending', 'approved', 'archived')) default 'pending',
  created_at timestamptz default now()
);

-- OPPORTUNITIES
create table if not exists opportunities (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  organization text,
  type text check (type in ('internship', 'placement', 'hackathon', 'competition')),
  description text,
  apply_url text,
  deadline timestamptz,
  eligible_years int[],
  eligible_branches text[],
  status text check (status in ('active', 'expired')) default 'active',
  created_at timestamptz default now()
);

-- REPORTS (content reports)
create table if not exists reports (
  id uuid primary key default uuid_generate_v4(),
  reporter_id uuid references profiles(id) on delete set null,
  post_id uuid references posts(id) on delete cascade,
  reason text,
  status text check (status in ('open', 'resolved')) default 'open',
  created_at timestamptz default now()
);

-- BUG REPORTS
create table if not exists bug_reports (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete set null,
  description text not null,
  status text check (status in ('open', 'resolved')) default 'open',
  created_at timestamptz default now()
);

-- ============================================================
-- VIEWS (for convenient joins)
-- ============================================================

-- Posts with like & comment counts + author info
create or replace view posts_with_counts as
select
  p.*,
  pr.name as author_name,
  pr.avatar_url as author_avatar,
  count(distinct l.id) as like_count,
  count(distinct c.id) as comment_count
from posts p
left join profiles pr on p.user_id = pr.id
left join likes l on l.post_id = p.id
left join comments c on c.post_id = p.id and c.status = 'active'
group by p.id, pr.name, pr.avatar_url;

-- Comments with author info
create or replace view comments_with_author as
select
  c.*,
  pr.name as author_name,
  pr.avatar_url as author_avatar
from comments c
left join profiles pr on c.user_id = pr.id;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table profiles enable row level security;
alter table posts enable row level security;
alter table likes enable row level security;
alter table comments enable row level security;
alter table events enable row level security;
alter table event_rsvp enable row level security;
alter table lost_found enable row level security;
alter table academic_resources enable row level security;
alter table opportunities enable row level security;
alter table reports enable row level security;
alter table bug_reports enable row level security;

-- PROFILES
create policy "profiles: anyone can read" on profiles for select using (true);
create policy "profiles: users insert own" on profiles for insert with check (auth.uid() = id);
create policy "profiles: users update own" on profiles for update using (auth.uid() = id);

-- POSTS
create policy "posts: anyone reads active" on posts for select using (status = 'active');
create policy "posts: auth users insert" on posts for insert with check (auth.uid() = user_id);
create policy "posts: owner or admin update" on posts for update
  using (auth.uid() = user_id or (select is_admin from profiles where id = auth.uid()));
create policy "posts: owner or admin delete" on posts for delete
  using (auth.uid() = user_id or (select is_admin from profiles where id = auth.uid()));

-- LIKES
create policy "likes: anyone reads" on likes for select using (true);
create policy "likes: auth users insert own" on likes for insert with check (auth.uid() = user_id);
create policy "likes: auth users delete own" on likes for delete using (auth.uid() = user_id);

-- COMMENTS
create policy "comments: anyone reads active" on comments for select using (status = 'active');
create policy "comments: auth users insert" on comments for insert with check (auth.uid() = user_id);
create policy "comments: owner or admin update" on comments for update
  using (auth.uid() = user_id or (select is_admin from profiles where id = auth.uid()));

-- EVENTS
create policy "events: anyone reads" on events for select using (true);
create policy "events: admin insert" on events for insert
  with check ((select is_admin from profiles where id = auth.uid()));
create policy "events: admin update" on events for update
  using ((select is_admin from profiles where id = auth.uid()));

-- EVENT RSVP
create policy "event_rsvp: anyone reads" on event_rsvp for select using (true);
create policy "event_rsvp: auth users insert" on event_rsvp for insert with check (auth.uid() = user_id);
create policy "event_rsvp: auth users update own" on event_rsvp for update using (auth.uid() = user_id);
create policy "event_rsvp: auth users delete own" on event_rsvp for delete using (auth.uid() = user_id);

-- LOST & FOUND
create policy "lost_found: anyone reads" on lost_found for select using (true);
create policy "lost_found: auth users insert" on lost_found for insert with check (auth.uid() = user_id);
create policy "lost_found: owner update" on lost_found for update using (auth.uid() = user_id);

-- ACADEMIC RESOURCES
create policy "academic_resources: anyone reads approved" on academic_resources
  for select using (status = 'approved');
create policy "academic_resources: auth users insert" on academic_resources
  for insert with check (auth.uid() = user_id);
create policy "academic_resources: admin update" on academic_resources
  for update using ((select is_admin from profiles where id = auth.uid()));

-- OPPORTUNITIES
create policy "opportunities: anyone reads active" on opportunities for select using (status = 'active');
create policy "opportunities: admin manages" on opportunities for all
  using ((select is_admin from profiles where id = auth.uid()));

-- REPORTS
create policy "reports: auth users insert" on reports for insert with check (auth.uid() = reporter_id);
create policy "reports: admin reads" on reports for select
  using ((select is_admin from profiles where id = auth.uid()));

-- BUG REPORTS
create policy "bug_reports: anyone insert" on bug_reports for insert with check (true);
create policy "bug_reports: admin reads" on bug_reports for select
  using ((select is_admin from profiles where id = auth.uid()));

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
-- Run in Supabase Storage or via API:

-- insert into storage.buckets (id, name, public) values ('post-images', 'post-images', true);
-- insert into storage.buckets (id, name, public) values ('lost-found', 'lost-found', true);
-- insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);

-- Storage RLS Policies (in Supabase Dashboard → Storage → Policies):
-- post-images: SELECT = public; INSERT = auth.uid() is not null; UPDATE/DELETE = auth.uid() is owner
-- lost-found: SELECT = public; INSERT = auth.uid() is not null
-- avatars: SELECT = public; INSERT/UPDATE = auth.uid() = owner

-- ============================================================
-- SEED DATA (dummy posts for non-empty feed)
-- ============================================================

-- Insert 3 dummy student profiles (they won't have real auth accounts, just for display)
-- In production, real users are created via Google OAuth.
-- These are demo records for the admin to manually insert post-setup:

/*
insert into profiles (id, name, email, avatar_url, is_admin) values
  ('00000000-0000-0000-0000-000000000001', 'Aryan Sharma', 'aryan@student.local', 'https://api.dicebear.com/8.x/avataaars/svg?seed=Aryan', false),
  ('00000000-0000-0000-0000-000000000002', 'Priya Desai', 'priya@student.local', 'https://api.dicebear.com/8.x/avataaars/svg?seed=Priya', false),
  ('00000000-0000-0000-0000-000000000003', 'Rohit Mehta', 'rohit@student.local', 'https://api.dicebear.com/8.x/avataaars/svg?seed=Rohit', false);

insert into posts (id, user_id, type, caption, images, status, is_pinned, created_at) values
  (uuid_generate_v4(), '00000000-0000-0000-0000-000000000001', 'announcement', '📢 Welcome to RaisoSpot! This is your student-run campus platform. Browse posts, notes, confessions & more!', '{}', 'active', true, now() - interval '1 hour'),
  (uuid_generate_v4(), '00000000-0000-0000-0000-000000000002', 'confession', 'I accidentally called my professor "sir" 47 times in one class 😭 I was so nervous I just couldn''t stop', '{}', 'active', false, now() - interval '2 hours'),
  (uuid_generate_v4(), '00000000-0000-0000-0000-000000000003', 'image', 'Campus vibes today 🌤️ Library is packed before internals, good luck everyone!', '{}', 'active', false, now() - interval '4 hours'),
  (uuid_generate_v4(), '00000000-0000-0000-0000-000000000001', 'confession', 'Submitted my assignment 3 seconds before deadline. The adrenaline was unreal 🫀', '{}', 'active', false, now() - interval '6 hours');

insert into opportunities (title, organization, type, description, apply_url, deadline, eligible_years, status) values
  ('Summer Internship 2025', 'TechCorp India Pvt. Ltd.', 'internship', 'Full-stack development internship for CS/IT students. Work on real products with a great team.', 'https://example.com/apply', now() + interval '30 days', '{1,2,3}', 'active'),
  ('Smart India Hackathon 2025', 'Ministry of Education', 'hackathon', 'National level hackathon with prizes worth ₹10 lakhs. Team size: 2-6 members.', 'https://sih.gov.in', now() + interval '14 days', '{1,2,3,4}', 'active'),
  ('Campus Placement Drive', 'Infosys', 'placement', 'Off-campus placement for 2025 batch. 6 LPA package. Registration mandatory.', 'https://careers.infosys.com', now() + interval '7 days', '{4}', 'active');
*/

-- ============================================================
-- FUNCTION: enforce 4 posts/day limit
-- ============================================================
create or replace function check_daily_post_limit()
returns trigger as $$
declare
  today_count int;
begin
  select count(*) into today_count
  from posts
  where user_id = NEW.user_id
    and type in ('image', 'confession')
    and created_at >= current_date::timestamptz
    and created_at < (current_date + interval '1 day')::timestamptz;

  if today_count >= 4 then
    raise exception 'Daily post limit of 4 reached';
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

create trigger enforce_post_limit
  before insert on posts
  for each row
  when (NEW.type in ('image', 'confession'))
  execute function check_daily_post_limit();
