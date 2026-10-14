-- 배송지 + 공급처 발주 (2026-10-14)
-- Supabase 대시보드 → SQL Editor → 이 파일 전체를 붙여 넣고 Run. 여러 번 실행해도 안전하다.
-- 먼저 실행할 것: orders_coupon.sql (이미 실행됨)

-- 1) 주문에 배송지 칸
alter table public.orders add column if not exists buyer_name      text; -- 주문자
alter table public.orders add column if not exists buyer_phone     text;
alter table public.orders add column if not exists recipient_name  text; -- 받는 분
alter table public.orders add column if not exists recipient_phone text;
alter table public.orders add column if not exists zipcode         text;
alter table public.orders add column if not exists address1        text; -- 도로명 주소
alter table public.orders add column if not exists address2        text; -- 상세 주소
alter table public.orders add column if not exists delivery_memo   text;
alter table public.orders add column if not exists supply_consent  boolean not null default false; -- 공급처 배송정보 제공 동의

-- 2) 공급처 발주 기록 — 어느 줄을 언제 엑셀로 냈는지 (줄 번호 목록)
alter table public.orders add column if not exists supply_lines      jsonb not null default '[]'::jsonb;
alter table public.orders add column if not exists supply_status     text  not null default '미발주'; -- 미발주 / 일부 발주 / 발주완료
alter table public.orders add column if not exists supply_ordered_at timestamptz;

-- 3) 관리자는 모든 주문을 보고, 발주 칸을 고칠 수 있다 (결제 칸은 orders_guard_payment 트리거가 계속 막는다)
drop policy if exists "orders_admin_read" on public.orders;
create policy "orders_admin_read" on public.orders for select
  using ((auth.jwt() ->> 'email') = 'farmday.testuser02@gmail.com');
drop policy if exists "orders_admin_update" on public.orders;
create policy "orders_admin_update" on public.orders for update
  using      ((auth.jwt() ->> 'email') = 'farmday.testuser02@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'farmday.testuser02@gmail.com');

-- 4) 발주 이름표 — 사이트 상품·옵션 → 공급처와 그 공급처 주문서에 적는 상품명. 한 번 적으면 다음 주문부터 자동
create table if not exists public.supplier_map (
  product_id  text not null,
  option_name text not null default '',
  supplier    text not null,          -- 파밍 / 최고집
  supply_name text not null,          -- 예: (홍) 햇알밤 (특품),1kg 1박스
  updated_at  timestamptz not null default now(),
  primary key (product_id, option_name)
);
alter table public.supplier_map enable row level security;
drop policy if exists "supplier_map_admin" on public.supplier_map;
create policy "supplier_map_admin" on public.supplier_map for all
  using      ((auth.jwt() ->> 'email') = 'farmday.testuser02@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'farmday.testuser02@gmail.com');

-- 확인용: 아래 한 줄을 따로 실행하면 supplier_map 이 보여야 한다
-- select count(*) from public.supplier_map;
