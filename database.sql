-- KHO VIDEO 28 NGAY TAN DO GUITAR
-- Chay TOAN BO file nay tai Supabase > SQL Editor > New query > Run.
-- Su dung khoa cong khai (anon/publishable) trong website. KHONG dung service_role.

create extension if not exists pgcrypto;

create table if not exists public.video_items (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  url text not null default '' check (url = '' or url ~* '^https?://'),
  position integer not null default 0,
  is_filmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Cho phép nâng cấp database cũ mà không làm mất video / link hiện có.
alter table public.video_items
  add column if not exists is_filmed boolean not null default false;

create table if not exists public.video_reviewers (
  email text primary key check (email = lower(email))
);

create table if not exists public.video_admins (
  email text primary key check (email = lower(email))
);

create index if not exists video_items_position_idx on public.video_items(position, created_at);

alter table public.video_items enable row level security;
alter table public.video_admins enable row level security;
alter table public.video_reviewers enable row level security;

-- Thu hồi quyền mặc định trước khi cấp những quyền tối thiểu cần thiết.
revoke all on public.video_items from public, anon, authenticated;
revoke all on public.video_admins from public, anon, authenticated;
revoke all on public.video_reviewers from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.video_items to anon, authenticated;
grant insert, update, delete on public.video_items to authenticated;
grant select on public.video_admins to authenticated;
grant select on public.video_reviewers to authenticated;

-- Bat ky ai co link website deu co the XEM video.
drop policy if exists "all_can_read_videos" on public.video_items;
create policy "all_can_read_videos"
  on public.video_items for select to anon, authenticated using (true);

-- Nguoi dang nhap chi nhin thay email cua chinh minh trong bang quyen.
drop policy if exists "admin_can_check_own_email" on public.video_admins;
create policy "admin_can_check_own_email"
  on public.video_admins for select to authenticated
  using (email = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Sếp chỉ được kiểm tra quyền của chính email mình.
drop policy if exists "reviewer_can_check_own_email" on public.video_reviewers;
create policy "reviewer_can_check_own_email"
  on public.video_reviewers for select to authenticated
  using (email = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Chi nguoi co email trong video_admins moi duoc them, sua, xoa.
drop policy if exists "admin_can_insert_video" on public.video_items;
create policy "admin_can_insert_video"
  on public.video_items for insert to authenticated
  with check (exists (
    select 1 from public.video_admins
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  ));

drop policy if exists "admin_can_update_video" on public.video_items;
create policy "admin_can_update_video"
  on public.video_items for update to authenticated
  using (exists (
    select 1 from public.video_admins
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  ))
  with check (exists (
    select 1 from public.video_admins
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  ));

drop policy if exists "admin_can_delete_video" on public.video_items;
create policy "admin_can_delete_video"
  on public.video_items for delete to authenticated
  using (exists (
    select 1 from public.video_admins
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  ));

-- Function an toan: sếp dùng RPC để thay đổi DUY NHẤT is_filmed.
-- Không cấp UPDATE trực tiếp cho reviewer; RLS của video_items vẫn chỉ cho admin sửa.
-- SECURITY DEFINER chạy ở DB; kiểm tra quyền email trước khi thay đổi.
create or replace function public.set_video_filming_status(
  p_item_id uuid, p_is_filmed boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  affected_rows integer;
begin
  if auth.uid() is null or caller_email = '' or p_item_id is null or p_is_filmed is null then
    raise exception 'Yeu cau khong hop le';
  end if;
  if not exists (select 1 from public.video_admins where email = caller_email)
     and not exists (select 1 from public.video_reviewers where email = caller_email) then
    raise exception 'Khong co quyen danh dau trang thai quay';
  end if;
  update public.video_items
     set is_filmed = p_is_filmed, updated_at = now()
   where id = p_item_id;
  get diagnostics affected_rows = row_count;
  return affected_rows = 1;
end;
$$;
revoke all on function public.set_video_filming_status(uuid, boolean) from public, anon;
grant execute on function public.set_video_filming_status(uuid, boolean) to authenticated;

-- Cho phep thay doi realtime. Neu bang da duoc them thi bo qua.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'video_items'
  ) then
    alter publication supabase_realtime add table public.video_items;
  end if;
end $$;

-- SAU KHI TAO TAI KHOAN EMAIL/MAT KHAU TRONG SUPABASE AUTHENTICATION:
-- Thay email sau thanh email cua ban, sau do chay cau lenh nay RIENG:
-- insert into public.video_admins (email) values ('email-cua-ban@gmail.com') on conflict (email) do nothing;

-- TAO TAI KHOAN SEP: Supabase Authentication > Users > Add user.
-- Sau do thay email that cua sep va chay dong sau RIENG:
-- insert into public.video_reviewers (email) values ('sep@example.com') on conflict (email) do nothing;
-- Sếp có quyền tích/bỏ tích Đã quay, không thể thêm/sửa/xóa nội dung.
