-- NANG CAP TRANG THAI QUAY tu phien ban website cu.
-- Chay trong Supabase > SQL Editor. Khong xoa video cu.

alter table public.video_items
  add column if not exists is_filmed boolean not null default false;

create table if not exists public.video_reviewers (
  email text primary key check (email = lower(email))
);
alter table public.video_reviewers enable row level security;
revoke all on public.video_reviewers from public, anon, authenticated;
grant select on public.video_reviewers to authenticated;

drop policy if exists "reviewer_can_check_own_email" on public.video_reviewers;
create policy "reviewer_can_check_own_email"
  on public.video_reviewers for select to authenticated
  using (email = lower(coalesce(auth.jwt() ->> 'email', '')));

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

-- Tao user sep trong Supabase Authentication > Users > Add user.
-- Sau do chay dong sau RIENG, voi email that cua sep (chu thuong):
-- insert into public.video_reviewers (email) values ('sep@example.com') on conflict (email) do nothing;
