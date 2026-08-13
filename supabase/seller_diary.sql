-- 셀러 다이어리 — 하루 한 장. 그날의 생각·숫자·막힌 것을 적어둔다.
-- 나중에 전자책 재료가 된다. 초보가 제일 궁금해하는 건
-- "얼마나 걸려요?" "돈은 얼마 들어요?" "뭐가 제일 어려웠어요?" — 겪은 사람만 답할 수 있다.
--
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 Run 하세요. 한 번만 하면 됩니다.

create table if not exists public.seller_diary (
  day        date primary key,              -- 하루 한 장

  -- 오늘의 숫자
  revenue    integer,                       -- 매출
  orders     integer,                       -- 주문 건수
  ad_cost    integer,                       -- 광고비
  spent      integer,                       -- 그 밖에 쓴 돈
  hours      numeric(4,1),                  -- 일한 시간

  -- 무엇을 했나
  uploaded   text,                          -- 오늘 올린 상품
  sold       text,                          -- 오늘 팔린 상품

  -- 전자책 재료가 되는 부분
  thoughts   text,                          -- 오늘의 생각
  struggle   text,                          -- 막혔던 것·실수  ← 제일 값지다
  learned    text,                          -- 배운 것·해결법
  feedback   text,                          -- 고객 반응 (문의·리뷰·클레임)
  tomorrow   text,                          -- 내일 할 일
  etc        text,                          -- 기타

  mood       text,                          -- 오늘 기분
  starred    boolean     not null default false,  -- 전자책에 꼭 넣을 날
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists seller_diary_star_idx on public.seller_diary (starred) where starred;

-- ── 잠금 ──────────────────────────────────────────────
-- 매출과 속사정이 담기므로 관리자만 읽고 쓴다.
alter table public.seller_diary enable row level security;

drop policy if exists "admin_only" on public.seller_diary;
create policy "admin_only" on public.seller_diary
  for all
  to authenticated
  using      ((auth.jwt() ->> 'email') = 'farmday.testuser02@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'farmday.testuser02@gmail.com');

create or replace function public.touch_seller_diary()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists seller_diary_touch on public.seller_diary;
create trigger seller_diary_touch
  before update on public.seller_diary
  for each row execute function public.touch_seller_diary();
