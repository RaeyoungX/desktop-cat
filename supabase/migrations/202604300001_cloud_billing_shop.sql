create extension if not exists pgcrypto;

create table if not exists public.user_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  points integer not null default 0 check (points >= 0),
  total_sessions integer not null default 0 check (total_sessions >= 0),
  total_mins integer not null default 0 check (total_mins >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id text not null,
  name text not null,
  duration integer not null check (duration >= 0),
  start_time timestamptz not null,
  end_time timestamptz,
  distract_count integer not null default 0 check (distract_count >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, local_id)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('free','light','pro','power')),
  billing text not null check (billing in ('monthly','yearly')),
  status text not null check (status in ('active','expired','cancelled')),
  period_start date not null default current_date,
  period_end date,
  auto_renew boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null check (plan_id in ('light','pro','power')),
  billing text not null check (billing in ('monthly','yearly')),
  amount numeric(8,2) not null check (amount >= 0),
  currency text not null default 'CNY',
  payment_method text not null check (payment_method in ('alipay','wechat')),
  status text not null default 'pending' check (status in ('pending','paid','expired','failed','refunded')),
  trade_no text,
  pay_url text,
  qr_code_url text,
  paid_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.quota_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null,
  used_seconds integer not null default 0 check (used_seconds >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, month)
);

create table if not exists public.rate_limit_buckets (
  bucket_key text not null,
  window_start timestamptz not null,
  hit_count integer not null default 0 check (hit_count >= 0),
  primary key (bucket_key, window_start)
);

create table if not exists public.epay_webhook_dedupe (
  out_trade_no text primary key,
  processed_at timestamptz not null default now()
);

create table if not exists public.shop_items (
  id text primary key,
  name text not null,
  icon text not null,
  icon_color text not null,
  icon_bg text not null,
  cost integer not null check (cost >= 0),
  description text not null,
  available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null references public.shop_items(id),
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create table if not exists public.equipped_items (
  user_id uuid primary key references auth.users(id) on delete cascade,
  item_ids text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create index if not exists sessions_user_local_idx on public.sessions (user_id, local_id);
create index if not exists sessions_user_started_idx on public.sessions (user_id, start_time desc);
create index if not exists user_stats_points_idx on public.user_stats (points desc, total_mins desc);
create index if not exists orders_user_created_idx on public.orders (user_id, created_at desc);
create index if not exists quota_usage_user_month_idx on public.quota_usage (user_id, month);
create index if not exists rate_limit_buckets_key_recent on public.rate_limit_buckets (bucket_key, window_start desc);
create index if not exists subscriptions_user_active_idx on public.subscriptions (user_id, status, period_end desc);

alter table public.user_stats enable row level security;
alter table public.sessions enable row level security;
alter table public.subscriptions enable row level security;
alter table public.orders enable row level security;
alter table public.quota_usage enable row level security;
alter table public.shop_items enable row level security;
alter table public.inventory enable row level security;
alter table public.equipped_items enable row level security;

drop policy if exists "user_stats owner read" on public.user_stats;
create policy "user_stats owner read" on public.user_stats for select using (auth.uid() = user_id);
drop policy if exists "sessions owner read" on public.sessions;
create policy "sessions owner read" on public.sessions for select using (auth.uid() = user_id);
drop policy if exists "subscriptions owner read" on public.subscriptions;
create policy "subscriptions owner read" on public.subscriptions for select using (auth.uid() = user_id);
drop policy if exists "orders owner read" on public.orders;
create policy "orders owner read" on public.orders for select using (auth.uid() = user_id);
drop policy if exists "quota_usage owner read" on public.quota_usage;
create policy "quota_usage owner read" on public.quota_usage for select using (auth.uid() = user_id);
drop policy if exists "shop items public read" on public.shop_items;
create policy "shop items public read" on public.shop_items for select using (true);
drop policy if exists "inventory owner read" on public.inventory;
create policy "inventory owner read" on public.inventory for select using (auth.uid() = user_id);
drop policy if exists "equipped owner read" on public.equipped_items;
create policy "equipped owner read" on public.equipped_items for select using (auth.uid() = user_id);

insert into public.shop_items (id, name, icon, icon_color, icon_bg, cost, description, available, sort_order)
values
  ('bow', '蝴蝶结', 'gift', '#db2777', '#fce7f3', 25, '优雅满分', true, 10),
  ('hat', '礼帽', 'wand-2', '#374151', '#f3f4f6', 50, '绅士猫咪', true, 20),
  ('glasses', '墨镜', 'glasses', '#111827', '#e5e7eb', 60, '酷到发光', true, 30),
  ('crown', '王冠', 'crown', '#a16207', '#fef3c7', 80, '今日陛下', true, 40),
  ('stars', '星星气', 'sparkles', '#7c3aed', '#ede9fe', 40, '一路闪闪', true, 50)
on conflict (id) do update set
  name = excluded.name,
  icon = excluded.icon,
  icon_color = excluded.icon_color,
  icon_bg = excluded.icon_bg,
  cost = excluded.cost,
  description = excluded.description,
  available = excluded.available,
  sort_order = excluded.sort_order;

create or replace function public.activate_paid_order(
  p_order_id text,
  p_amount numeric,
  p_trade_no text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_period_start date := current_date;
  v_period_end date;
  v_dedupe_inserted int := 0;
begin
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_order.status = 'paid' then
    return jsonb_build_object('status', 'duplicate', 'order_status', v_order.status);
  end if;

  if v_order.status <> 'pending' then
    return jsonb_build_object('status', v_order.status, 'order_status', v_order.status);
  end if;

  if abs(v_order.amount - p_amount) > 0.01 then
    return jsonb_build_object(
      'status', 'amount_mismatch',
      'expected', v_order.amount,
      'actual', p_amount
    );
  end if;

  insert into public.epay_webhook_dedupe (out_trade_no)
  values (p_order_id)
  on conflict do nothing;
  get diagnostics v_dedupe_inserted = row_count;

  if v_dedupe_inserted = 0 then
    return jsonb_build_object('status', 'duplicate', 'order_status', v_order.status);
  end if;

  v_period_end := case
    when v_order.billing = 'yearly' then (v_period_start + interval '1 year')::date
    else (v_period_start + interval '1 month')::date
  end;

  update public.orders
  set status = 'paid',
      paid_at = now(),
      trade_no = coalesce(nullif(p_trade_no, ''), trade_no)
  where id = p_order_id;

  update public.subscriptions
  set status = 'expired'
  where user_id = v_order.user_id
    and status = 'active';

  insert into public.subscriptions (
    user_id,
    plan,
    billing,
    status,
    period_start,
    period_end,
    auto_renew
  )
  values (
    v_order.user_id,
    v_order.plan_id,
    v_order.billing,
    'active',
    v_period_start,
    v_period_end,
    true
  );

  return jsonb_build_object(
    'status', 'paid',
    'plan', v_order.plan_id,
    'billing', v_order.billing,
    'period_start', v_period_start,
    'period_end', v_period_end
  );
end;
$$;

grant execute on function public.activate_paid_order(text, numeric, text) to service_role;
