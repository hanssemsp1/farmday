-- 메인 배너 — 관리자 화면에서 바꿀 수 있게 서버에 둔다
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 Run 하세요. 한 번만 하면 됩니다.
--
-- 손님은 보기만, 고치는 건 관리자만.

create table if not exists public.site_banners (
  id         text primary key,                 -- 'b1' 'b2' …
  sort       int  default 0,                   -- 보여줄 차례
  active     boolean default true,             -- 잠시 내리고 싶을 때 끄기
  eyebrow    text default '',                  -- 작은 윗글씨
  title      text default '',                  -- 큰 제목
  descr      text default '',                  -- 설명
  cta        text default '',                  -- 버튼 글씨
  link       text default '',                  -- 눌렀을 때 갈 곳
  image      text default '',                  -- 배경 사진 주소 (비우면 아래 색을 쓴다)
  gradient   text default '',                  -- 사진이 없을 때 쓸 색
  updated_at timestamptz default now()
);

alter table public.site_banners enable row level security;

-- 보기: 누구나 (손님에게 보여야 하니까)
drop policy if exists "banners_read" on public.site_banners;
create policy "banners_read" on public.site_banners
  for select using (true);

-- 고치기: 관리자만
drop policy if exists "banners_write" on public.site_banners;
create policy "banners_write" on public.site_banners
  for all to authenticated
  using      ((auth.jwt() ->> 'email') = 'farmday.testuser02@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'farmday.testuser02@gmail.com');

-- 지금 쓰고 있는 배너 3장을 그대로 넣어둔다 (사진만 갈아끼우면 된다)
insert into public.site_banners (id, sort, eyebrow, title, descr, cta, link, gradient) values
  ('b1', 1, 'NEW MEMBER', '첫 구매 15% 할인 쿠폰', '지금 가입하고 웰컴 쿠폰을 받아보세요', '쿠폰 받기', '/login', 'linear-gradient(120deg,#4A154B,#1264A3 75%)'),
  ('b2', 2, '2026 SUMMER BEST', E'지금 가장 많이 찾는\n팜데이 베스트 상품', '최대 30% 할인 · 무료배송 · 오늘 발송', '베스트 보러가기', '/best', 'linear-gradient(120deg,#1264A3,#2EB67D 75%)'),
  ('b3', 3, 'WEEKLY PICK', E'이번 주, 팜데이가 고른\n제철 과일·채소 모음', '산지에서 오늘 막 도착한 신선함 그대로', '제철 상품 보기', '/best', 'linear-gradient(120deg,#ECB22E,#4A154B 75%)')
on conflict (id) do nothing;
