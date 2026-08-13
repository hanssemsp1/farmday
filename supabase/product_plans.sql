-- FARMDAY 상품 기획 테이블
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 Run 하세요. 한 번만 하면 됩니다.
--
-- ⚠️ 이 테이블에는 업체 공급가와 마진이 들어갑니다.
--    아래 잠금(RLS)이 걸려 있어야 관리자 외에는 아무도 못 봅니다.
--    화면에서 숨기는 것만으로는 막히지 않습니다.

create table if not exists public.product_plans (
  id          text primary key,                    -- 상품 이름 (성주참외, 돈마호크 …)
  category    text,                                -- 야채 / 과일 / 수산 / 축산 / 식품
  season      text[]      default '{}',            -- 제철 (6월, 7월 …)
  status      text        default '기획',           -- 기획 / 제작중 / 등록완료 / 판매중 / 종료
  vendor      jsonb       default '{}'::jsonb,     -- 업체명·메모
  coupang     jsonb       default '{}'::jsonb,     -- 상품명·카테고리·태그·옵션ID·쿠폰
  options     jsonb       default '[]'::jsonb,     -- 공급가·판매가·할인율·택배비
  competitors jsonb       default '{"weights":[],"rows":[]}'::jsonb,  -- 경쟁사 1~6위
  content     jsonb       default '{}'::jsonb,     -- 썸네일 5장·상세 11장 문구
  reviews     jsonb       default '[]'::jsonb,     -- 고객 리뷰
  assets      jsonb       default '{}'::jsonb,     -- 사진 폴더 경로
  updated_at  timestamptz default now()
);

-- 카테고리로 자주 찾으므로 색인을 둔다
create index if not exists product_plans_category_idx on public.product_plans (category);

-- ── 잠금 ──────────────────────────────────────────────
alter table public.product_plans enable row level security;

-- 관리자 한 사람만 읽고 쓸 수 있다.
-- 관리자 이메일이 바뀌면 아래 두 곳의 주소를 함께 바꿔야 한다.
drop policy if exists "admin_only" on public.product_plans;
create policy "admin_only" on public.product_plans
  for all
  to authenticated
  using      ((auth.jwt() ->> 'email') = 'farmday.testuser02@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'farmday.testuser02@gmail.com');

-- 저장할 때마다 수정 시각을 자동으로 남긴다
create or replace function public.touch_product_plans()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists product_plans_touch on public.product_plans;
create trigger product_plans_touch
  before update on public.product_plans
  for each row execute function public.touch_product_plans();
