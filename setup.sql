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
