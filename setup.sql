-- BURIN : ตั้งค่าฐานข้อมูล Supabase
-- วางทั้งไฟล์นี้ใน SQL Editor ของโปรเจกต์ แล้วกด Run ครั้งเดียว รันซ้ำได้ไม่เสียหาย

-- 1) ตารางเก็บสมุด หน้า และหมึก (หนึ่งแถวต่อหนึ่งเอกสาร)
create table if not exists public.docs (
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  path text not null,
  parent text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (owner, path)
);
create index if not exists docs_owner_parent on public.docs (owner, parent);

-- 2) ให้แต่ละบัญชีเห็นและแก้ได้เฉพาะข้อมูลของตัวเอง
alter table public.docs enable row level security;
drop policy if exists "docs: own rows" on public.docs;
create policy "docs: own rows" on public.docs
  for all to authenticated
  using (owner = auth.uid())
  with check (owner = auth.uid());
grant select, insert, update, delete on public.docs to authenticated;
revoke all on public.docs from anon;

-- 3) ส่งการเปลี่ยนแปลงแบบทันทีไปยังทุกเครื่อง
alter table public.docs replica identity full;
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'docs') then
    alter publication supabase_realtime add table public.docs;
  end if;
end $$;

-- 4) ที่เก็บรูปและวิดีโอ (ไม่เปิดสาธารณะ ไฟล์ละไม่เกิน 25 MB)
insert into storage.buckets (id, name, public, file_size_limit)
values ('burin', 'burin', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = 26214400;

drop policy if exists "burin files: read own" on storage.objects;
drop policy if exists "burin files: add own" on storage.objects;
drop policy if exists "burin files: change own" on storage.objects;
drop policy if exists "burin files: delete own" on storage.objects;
create policy "burin files: read own" on storage.objects for select to authenticated
  using (bucket_id = 'burin' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "burin files: add own" on storage.objects for insert to authenticated
  with check (bucket_id = 'burin' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "burin files: change own" on storage.objects for update to authenticated
  using (bucket_id = 'burin' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "burin files: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'burin' and (storage.foldername(name))[1] = auth.uid()::text);

-- 5) แชร์เลคเชอร์ให้ผู้เรียน (ใครมีลิงก์อ่านได้ เฉพาะเจ้าของแก้ได้)
create table if not exists public.shares (
  id text primary key,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text,
  data jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.shares enable row level security;
drop policy if exists "shares: anyone with the link can read" on public.shares;
drop policy if exists "shares: owner writes" on public.shares;
create policy "shares: anyone with the link can read" on public.shares for select to anon, authenticated using (true);
create policy "shares: owner writes" on public.shares for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
grant select on public.shares to anon;
grant select, insert, update, delete on public.shares to authenticated;

-- 6) งานมอบหมายและการส่งงาน (ผู้เรียนส่งได้โดยไม่ต้องมีบัญชี เฉพาะงานที่เปิดรับ ครูเจ้าของงานเท่านั้นที่เห็นงานที่ส่ง)
create table if not exists public.assignments (
  id text primary key,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text,
  data jsonb not null,
  due timestamptz,
  open boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.assignments enable row level security;
drop policy if exists "assignments: read with the link" on public.assignments;
drop policy if exists "assignments: owner writes" on public.assignments;
create policy "assignments: read with the link" on public.assignments for select to anon, authenticated using (true);
create policy "assignments: owner writes" on public.assignments for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
grant select on public.assignments to anon;
grant select, insert, update, delete on public.assignments to authenticated;

create table if not exists public.submissions (
  id text primary key,
  assignment text not null references public.assignments (id) on delete cascade,
  name text not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.submissions enable row level security;
drop policy if exists "submissions: hand in to an open assignment" on public.submissions;
drop policy if exists "submissions: teacher reads" on public.submissions;
drop policy if exists "submissions: teacher marks" on public.submissions;
drop policy if exists "submissions: teacher deletes" on public.submissions;
create policy "submissions: hand in to an open assignment" on public.submissions for insert to anon, authenticated
  with check (exists (select 1 from public.assignments a where a.id = assignment and a.open));
create policy "submissions: teacher reads" on public.submissions for select to authenticated
  using (exists (select 1 from public.assignments a where a.id = assignment and a.owner = auth.uid()));
create policy "submissions: teacher marks" on public.submissions for update to authenticated
  using (exists (select 1 from public.assignments a where a.id = assignment and a.owner = auth.uid()));
create policy "submissions: teacher deletes" on public.submissions for delete to authenticated
  using (exists (select 1 from public.assignments a where a.id = assignment and a.owner = auth.uid()));
grant insert on public.submissions to anon;
grant select, insert, update, delete on public.submissions to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('burin-sub', 'burin-sub', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;
drop policy if exists "homework files: hand in" on storage.objects;
drop policy if exists "homework files: teacher reads" on storage.objects;
drop policy if exists "homework files: teacher deletes" on storage.objects;
create policy "homework files: hand in" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'burin-sub' and exists (select 1 from public.assignments a where a.id = (storage.foldername(name))[1] and a.open));
create policy "homework files: teacher reads" on storage.objects for select to authenticated
  using (bucket_id = 'burin-sub' and exists (select 1 from public.assignments a where a.id = (storage.foldername(name))[1] and a.owner = auth.uid()));
create policy "homework files: teacher deletes" on storage.objects for delete to authenticated
  using (bucket_id = 'burin-sub' and exists (select 1 from public.assignments a where a.id = (storage.foldername(name))[1] and a.owner = auth.uid()));
