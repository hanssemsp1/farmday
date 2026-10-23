-- 1:1 문의 (교환 · 반품 · 배송 · 상품) — 2026-10-23
-- 카카오채널 대신 사이트 「1:1 문의」로 교환 · 반품을 받는다(대표님 10/23 밤).
-- 쓴 사람과 관리자만 본다:
--   · 쓰기는 Edge Function `inquiry`(service role)만 — 회원은 로그인, 비회원은 주문번호 + 휴대폰 + 조회 비밀번호로 확인한 뒤
--   · 회원은 자기 문의만 읽을 수 있다(RLS), 비회원은 함수로만
--   · 관리자(farmday.testuser02@gmail.com)는 모두 읽고 답한다
-- Supabase 대시보드 → SQL Editor 에 붙여 넣고 Run. 여러 번 실행해도 안전하다(「올려」 때 실행).

create table if not exists public.inquiries (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete set null, -- 회원이면
  order_id     uuid,                       -- 확인된 주문(비회원은 반드시, 회원은 고른 경우)
  order_no     text,                       -- FD-xxxxxxxx (손님이 적은 값 또는 확인된 값)
  kind         text not null default '교환·반품' check (kind in ('교환·반품', '배송', '상품', '기타')),
  buyer_name   text not null,
  phone        text not null,
  product_name text,
  body         text not null check (char_length(body) between 5 and 3000),
  photos       text[] not null default '{}', -- 비공개 저장소 inquiry-photos 안의 경로
  status       text not null default '새 문의' check (status in ('새 문의', '답변함', '끝')),
  answer       text,
  answered_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists inquiries_user_idx on public.inquiries (user_id, created_at desc);
create index if not exists inquiries_order_idx on public.inquiries (order_id, created_at desc);
create index if not exists inquiries_created_idx on public.inquiries (created_at desc);
alter table public.inquiries enable row level security;

drop policy if exists "inquiries_member_read" on public.inquiries;
create policy "inquiries_member_read" on public.inquiries for select
  using (user_id is not null and user_id = auth.uid());

drop policy if exists "inquiries_admin_all" on public.inquiries;
create policy "inquiries_admin_all" on public.inquiries for all
  using      ((auth.jwt() ->> 'email') = 'farmday.testuser02@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'farmday.testuser02@gmail.com');

-- 하자 사진 — 비공개 저장소. 올리기는 함수(service role)만, 보기는 관리자만(잠깐 쓰는 서명 주소로)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inquiry-photos', 'inquiry-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

drop policy if exists "inquiry_photos_admin_read" on storage.objects;
create policy "inquiry_photos_admin_read" on storage.objects for select
  using (bucket_id = 'inquiry-photos' and (auth.jwt() ->> 'email') = 'farmday.testuser02@gmail.com');

-- 보관 기간 지키기(처리방침 3절, 법대리 확인 10/23) — 매일 한국 04:20(UTC 19:20)
--   · 교환 · 반품 · 배송(불만 · 분쟁 처리 기록): 받은 날부터 3년
--   · 그 밖의 상품 문의(상품 · 기타): 답변을 마친 날부터 1년(답변 전이면 받은 날부터)
--   ⚠️ 사진 파일은 SQL로 지울 수 없다(저장소 규칙) → 관리자 화면 「기간 지난 사진 지우기」를 따로 만든다(올린 뒤 할 일)
create extension if not exists pg_cron with schema extensions;
do $$
begin
  if exists (select 1 from cron.job where jobname = 'inquiries_retention') then
    perform cron.unschedule('inquiries_retention');
  end if;
end $$;
select cron.schedule(
  'inquiries_retention',
  '20 19 * * *',
  $$delete from public.inquiries
      where (kind in ('교환·반품', '배송') and created_at < now() - interval '3 years')
         or (kind in ('상품', '기타') and coalesce(answered_at, created_at) < now() - interval '1 year')$$
);

-- 확인: select count(*) from public.inquiries;
--       select jobname, schedule, active from cron.job where jobname = 'inquiries_retention';
