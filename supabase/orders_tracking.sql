-- 송장·배송 상태 + 발주 칸 지키기 (2026-10-14)
-- Supabase 대시보드 → SQL Editor → 이 파일 전체를 붙여 넣고 Run. 여러 번 실행해도 안전하다.
-- 먼저 실행할 것: orders_coupon.sql, orders_shipping.sql, orders_cancel.sql (모두 실행됨)

-- 1) 송장 — 공급처가 보내 준 택배사·운송장번호. 한 주문에 줄마다 송장이 다를 수 있어 목록으로
alter table public.orders add column if not exists shipments       jsonb not null default '[]'::jsonb; -- [{lines:[0], courier, number, at}]
alter table public.orders add column if not exists delivery_status text;        -- null / 배송중 / 배송완료
alter table public.orders add column if not exists shipped_at      timestamptz;
alter table public.orders add column if not exists delivered_at    timestamptz;

-- 2) 지킴이 넓히기 — 결제·취소 칸은 서버만, 발주·송장 칸은 서버와 관리자만 바꾼다
--    (그동안 손님이 자기 주문의 발주 상태를 「미발주」로 되돌려 바로 환불받을 수 있는 틈이 있었다)
create or replace function public.orders_guard_payment()
returns trigger
language plpgsql
as $$
declare
  is_admin boolean := coalesce(auth.jwt() ->> 'email', '') = 'farmday.testuser02@gmail.com';
begin
  if coalesce(auth.role(), '') = 'service_role' or current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status in ('결제완료', '취소완료') or new.paid_at is not null or new.payment_key is not null
       or coalesce(new.coupon_amount, 0) <> 0
       or new.cancel_status is not null or new.canceled_at is not null
       or coalesce(new.supply_status, '미발주') <> '미발주' or new.supply_lines <> '[]'::jsonb
       or new.shipments <> '[]'::jsonb or new.delivery_status is not null then
      raise exception '결제·발주·배송 기록은 서버에서만 쓸 수 있어요';
    end if;
    return new;
  end if;

  -- 결제·취소 칸: 서버만
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

  -- 발주·송장 칸: 관리자만
  if not is_admin and (
       new.supply_status is distinct from old.supply_status
       or new.supply_lines is distinct from old.supply_lines
       or new.supply_ordered_at is distinct from old.supply_ordered_at
       or new.shipments is distinct from old.shipments
       or new.delivery_status is distinct from old.delivery_status
       or new.shipped_at is distinct from old.shipped_at
       or new.delivered_at is distinct from old.delivered_at) then
    raise exception '발주·배송 기록은 관리자만 바꿀 수 있어요';
  end if;
  return new;
end;
$$;

-- 확인용
-- select column_name from information_schema.columns where table_name = 'orders' and column_name in ('shipments','delivery_status');
