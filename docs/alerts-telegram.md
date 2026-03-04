# Price Alerts + Telegram

## Axin

1. `price_alerts` cədvəlində user hədəf qiymət qurur.
2. `v_active_price_alert_candidates` ən ucuz aktiv offer-i tapır.
3. `POST /api/internal/alerts/run` pending notification queue yaradır.
4. Eyni endpoint Telegram-a göndərib statusu `sent/failed` edir.

## Lazim env

- `INTERNAL_API_KEY`
- `TELEGRAM_BOT_TOKEN`
- `ALERT_BATCH_SIZE`
- `NEXT_PUBLIC_SITE_URL`

## User + Telegram chat mapping

`users.telegram_chat_id` doldurulmalıdır.

Nümunə SQL:

```sql
insert into public.users (id, email, telegram_chat_id, locale, is_active)
values (
  '11111111-1111-1111-1111-111111111111',
  'demo@example.com',
  '123456789',
  'az',
  true
)
on conflict (id) do update
set telegram_chat_id = excluded.telegram_chat_id;
```

## Alert yaratmaq nümunəsi

```sql
insert into public.price_alerts (user_id, product_id, target_price_azn, is_active)
values ('11111111-1111-1111-1111-111111111111', 42, 1499.00, true);
```
