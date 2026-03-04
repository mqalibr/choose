-- Alerts and Telegram-ready queue

alter table public.users
  alter column email drop not null;
alter table public.users
  drop constraint if exists users_email_key;

drop index if exists users_email_uidx;
create unique index if not exists users_email_uidx
  on public.users (email)
  where email is not null;

create index if not exists users_telegram_chat_idx
  on public.users (telegram_chat_id)
  where telegram_chat_id is not null;

create table if not exists public.price_alert_notifications (
  id bigserial primary key,
  alert_id bigint not null references public.price_alerts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  store_product_id bigint not null references public.store_products(id) on delete cascade,
  channel text not null,
  recipient text not null,
  message text not null,
  message_hash text not null,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  error_message text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint price_alert_notifications_channel_chk check (channel in ('telegram', 'email')),
  constraint price_alert_notifications_status_chk check (status in ('pending', 'sent', 'failed')),
  unique (alert_id, store_product_id, channel, recipient, message_hash)
);

create index if not exists price_alert_notifications_status_idx
  on public.price_alert_notifications (status, created_at);
create index if not exists price_alert_notifications_user_idx
  on public.price_alert_notifications (user_id, created_at desc);

create or replace view public.v_active_price_alert_candidates as
select
  pa.id as alert_id,
  pa.user_id,
  pa.product_id,
  pa.target_price_azn,
  p.canonical_name,
  p.slug as product_slug,
  bo.store_product_id,
  bo.store_id,
  bo.store_name,
  bo.current_price_azn,
  bo.product_url,
  u.telegram_chat_id
from public.price_alerts pa
join public.users u on u.id = pa.user_id and u.is_active = true
join public.products p on p.id = pa.product_id and p.is_active = true
join lateral (
  select
    sp.id as store_product_id,
    sp.store_id,
    s.name as store_name,
    sp.current_price_azn,
    sp.product_url
  from public.store_products sp
  join public.stores s on s.id = sp.store_id and s.is_active = true
  where sp.product_id = pa.product_id
    and sp.is_active = true
    and sp.in_stock = true
    and sp.current_price_azn is not null
  order by sp.current_price_azn asc, sp.price_updated_at desc nulls last
  limit 1
) bo on true
where pa.is_active = true
  and bo.current_price_azn <= pa.target_price_azn;
