-- ============================================================
-- RaisoSpot – FIX SCRIPT (run this if you get "already exists" errors)
-- This drops existing policies and recreates them cleanly
-- ============================================================

-- Drop all existing policies first
do $$ 
declare
  r record;
begin
  for r in (
    select schemaname, tablename, policyname 
    from pg_policies 
    where schemaname = 'public'
  ) loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- Drop and recreate trigger
drop trigger if exists enforce_post_limit on posts;
drop function if exists check_daily_post_limit();

-- ============================================================
-- RECREATE ALL RLS POLICIES
-- ============================================================

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
-- RECREATE TRIGGER (4 posts/day limit)
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

-- ============================================================
-- RECREATE VIEWS (safe to run multiple times)
-- ============================================================
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

create or replace view comments_with_author as
select
  c.*,
  pr.name as author_name,
  pr.avatar_url as author_avatar
from comments c
left join profiles pr on c.user_id = pr.id;

select 'All policies and triggers recreated successfully ✅' as status;
