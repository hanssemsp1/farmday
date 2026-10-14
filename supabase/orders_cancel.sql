-- 주문 취소 (2026-10-14)
-- Supabase 대시보드 → SQL Editor → 이 파일 전체를 붙여 넣고 Run. 여러 번 실행해도 안전하다.
-- 먼저 실행할 것: orders_coupon.sql, orders_shipping.sql (둘 다 실행됨)
--
-- 규칙(대표님 확정):
--  · 발주 전(미발주) → 손님이 직접 취소, 토스 결제 자동 전액 취소
--  · 발주 후 → 손님은 「취소 요청」, 대표님이 공급처 확인 뒤 승인(자동 환불) 또는 거절
--  · 첫 주문을 취소해도 첫 구매 쿠폰은 되살리지 않는다(결제됐던 주문으로 센다)

alter table public.orders add column if not exists cancel_status       text;        -- null / 요청 / 완료 / 거절
alter table public.orders add column if not exists cancel_reason       text;        -- 손님이 고른 사유
alter table public.orders add column if not exists cancel_requested_at timestamptz;
alter table public.orders add column if not exists canceled_at         timestamptz; -- 토스 취소가 끝난 시각
alter table public.orders add column if not exists cancel_note         text;        -- 거절 사유 등 손님에게 보여 줄 말

-- 취소 칸도 서버(order-cancel 함수)만 쓴다 — 결제 칸 지킴이를 넓힌다
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
    if new.status in ('결제완료', '취소완료') or new.paid_at is not null or new.payment_key is not null
       or coalesce(new.coupon_amount, 0) <> 0
       or new.cancel_status is not null or new.canceled_at is not null then
      raise exception '결제·취소 기록은 서버에서만 쓸 수 있어요';
    end if;
  else
    if (new.status in ('결제완료', '취소완료') and old.status is distinct from new.status)
       or new.paid_at is distinct from old.paid_at
       or new.payment_key is distinct from old.payment_key
       or new.coupon_amount is distinct from old.coupon_amount
       or new.subtotal is distinct from old.subtotal
       or new.shipping_fee is distinct from old.shipping_fee
       or new.cancel_status is distinct from old.cancel_status
       or new.cancel_reason is distinct from old.cancel_reason
       or new.cancel_requested_at is distinct from old.cancel_requested_at
       or new.canceled_at is distinct from old.canceled_at
       or new.cancel_note is distinct from old.cancel_note then
      raise exception '결제·취소 기록은 서버에서만 바꿀 수 있어요';
    end if;
  end if;
  return new;
end;
$$;

-- 확인용
-- select column_name from information_schema.columns where table_name = 'orders' and column_name like 'cancel%';
