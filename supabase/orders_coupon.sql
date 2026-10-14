-- 첫 구매 쿠폰 + 결제 승인 기록 (2026-10-12)
-- Supabase 대시보드 → SQL Editor → 이 파일 전체를 붙여 넣고 Run. 여러 번 실행해도 안전하다.

-- 1) 주문에 금액 내역·결제 기록 칸
alter table public.orders add column if not exists subtotal      integer;               -- 상품금액(DB 가격으로 서버가 다시 계산)
alter table public.orders add column if not exists shipping_fee  integer;               -- 배송비
alter table public.orders add column if not exists coupon_amount integer not null default 0; -- 첫 구매 할인
alter table public.orders add column if not exists payment_key   text;                  -- 토스 paymentKey (승인 중·승인됨)
alter table public.orders add column if not exists paid_at       timestamptz;           -- 결제 승인 시각 (있으면 「결제 완료」)

-- 2) 첫 구매 쿠폰은 사람당 한 번 — 동시에 두 주문이 써도 하나만 통과
create unique index if not exists orders_first_coupon_once
  on public.orders (user_id)
  where coupon_amount > 0 and payment_key is not null;

-- 3) 결제 기록은 서버(Edge Function)만 쓴다 — 브라우저에서 「결제완료」로 바꾸거나 쿠폰·결제 칸을 고치지 못하게
create or replace function public.orders_guard_payment()
returns trigger
language plpgsql
as $$
begin
  -- 서버(Edge Function)와 대시보드 SQL 편집기는 통과
  if coalesce(auth.role(), '') = 'service_role' or current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status = '결제완료' or new.paid_at is not null or new.payment_key is not null
       or coalesce(new.coupon_amount, 0) <> 0 then
      raise exception '결제 기록은 서버에서만 쓸 수 있어요';
    end if;
  else
    if (new.status = '결제완료' and old.status is distinct from '결제완료')
       or new.paid_at is distinct from old.paid_at
       or new.payment_key is distinct from old.payment_key
       or new.coupon_amount is distinct from old.coupon_amount
       or new.subtotal is distinct from old.subtotal
       or new.shipping_fee is distinct from old.shipping_fee then
      raise exception '결제 기록은 서버에서만 바꿀 수 있어요';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_guard_payment on public.orders;
create trigger orders_guard_payment
  before insert or update on public.orders
  for each row execute function public.orders_guard_payment();

-- 확인용: 아래 한 줄을 따로 실행하면 새 칸 5개가 보여야 한다
-- select column_name from information_schema.columns where table_name = 'orders' order by ordinal_position;
