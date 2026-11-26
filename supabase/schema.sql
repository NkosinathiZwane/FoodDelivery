-- HazyEats Production Database Schema (Supabase Postgres)
-- Runnable in one go inside the Supabase SQL Editor.

create extension if not exists pgcrypto;

-- =========================================================
-- 1. TABLES
-- =========================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'buyer' check (role in ('buyer', 'driver', 'store', 'admin')),
  name text not null check (char_length(trim(name)) >= 1),
  phone text not null default '',
  vehicle text not null default '',
  is_online boolean not null default false,
  is_active boolean not null default true,
  needs_onboarding boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  owner_id uuid references public.profiles(id) on delete set null,
  name text not null unique check (char_length(trim(name)) >= 2),
  category text not null check (char_length(trim(category)) >= 2),
  delivery_time text not null default '30–45 min',
  is_community boolean not null default false,
  logo_url text not null default '',
  is_open boolean not null default true,
  is_approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null check (char_length(trim(name)) >= 2),
  price numeric(10, 2) not null check (price >= 0),
  item_group text not null default 'main' check (item_group in ('main', 'side', 'extra', 'drink')),
  image_url text not null default '',
  is_available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  buyer_phone text not null default '',
  address text not null check (char_length(trim(address)) >= 5),
  notes text not null default '',
  subtotal numeric(10, 2) not null default 0 check (subtotal >= 0),
  delivery_fee numeric(10, 2) not null default 20.00 check (delivery_fee >= 0),
  total numeric(10, 2) not null default 0 check (total >= 0),
  status text not null default 'placed' check (
    status in ('placed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'cancelled')
  ),
  driver_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  picked_up_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete restrict,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  name text not null,
  price numeric(10, 2) not null check (price >= 0),
  item_group text not null default 'main',
  qty integer not null check (qty > 0)
);

create table if not exists public.order_store_parts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'ready')),
  reason text not null default '',
  accepted_at timestamptz,
  rejected_at timestamptz,
  ready_at timestamptz,
  created_at timestamptz not null default now(),
  unique (order_id, store_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  text text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_stores_approved on public.stores (is_approved, name);
create index if not exists idx_stores_owner on public.stores (owner_id);
create index if not exists idx_menu_items_store on public.menu_items (store_id, sort_order);
create index if not exists idx_orders_buyer on public.orders (buyer_id, created_at desc);
create index if not exists idx_orders_status on public.orders (status, created_at desc);
create index if not exists idx_orders_driver on public.orders (driver_id, status);
create index if not exists idx_order_items_order on public.order_items (order_id, store_id);
create index if not exists idx_order_parts_order on public.order_store_parts (order_id);
create index if not exists idx_order_parts_store on public.order_store_parts (store_id, status);
create index if not exists idx_notifications_user on public.notifications (user_id, created_at desc);

-- =========================================================
-- 2. HELPER FUNCTIONS (SECURITY DEFINER FOR CLEAN RLS)
-- =========================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active = true
  );
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.generate_order_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text;
begin
  loop
    candidate := 'ORD-' || lpad((1000 + floor(random() * 9000)::int)::text, 4, '0');
    exit when not exists (select 1 from public.orders where code = candidate);
  end loop;
  return candidate;
end;
$$;

-- =========================================================
-- 3. AUTH TRIGGER & ORDER STATUS COMPUTATION TRIGGER
-- =========================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
  safe_role text;
  raw_name text;
  raw_phone text;
  raw_vehicle text;
  raw_store_name text;
  is_oauth boolean;
  needs_step boolean;
  generated_slug text;
begin
  requested_role := coalesce(new.raw_user_meta_data ->> 'role', '');
  -- Public sign-up supports buyer, driver, store only. Admins are created strictly by seed/SQL.
  if requested_role in ('buyer', 'driver', 'store') then
    safe_role := requested_role;
  else
    safe_role := 'buyer';
  end if;

  is_oauth := coalesce(new.raw_app_meta_data ->> 'provider', 'email') <> 'email';
  raw_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    split_part(coalesce(new.email, 'user@hazyeats.co.za'), '@', 1)
  );
  raw_phone := coalesce(trim(new.raw_user_meta_data ->> 'phone'), '');
  raw_vehicle := coalesce(trim(new.raw_user_meta_data ->> 'vehicle'), '');
  raw_store_name := coalesce(trim(new.raw_user_meta_data ->> 'store_name'), '');

  needs_step := is_oauth and (requested_role = '' or raw_phone = '');

  insert into public.profiles (id, role, name, phone, vehicle, is_online, is_active, needs_onboarding)
  values (
    new.id,
    safe_role,
    raw_name,
    raw_phone,
    case when safe_role = 'driver' then raw_vehicle else '' end,
    false,
    true,
    needs_step
  )
  on conflict (id) do nothing;

  if safe_role = 'store' and raw_store_name <> '' then
    generated_slug := regexp_replace(lower(raw_store_name), '[^a-z0-9]+', '-', 'g');
    generated_slug := trim(both '-' from generated_slug) || '-' || substr(new.id::text, 1, 6);
    insert into public.stores (slug, owner_id, name, category, delivery_time, is_community, is_open, is_approved)
    values (
      generated_slug,
      new.id,
      raw_store_name,
      coalesce(nullif(trim(new.raw_user_meta_data ->> 'store_category'), ''), 'Restaurant'),
      '30–45 min',
      false,
      true,
      false
    )
    on conflict (name) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.sync_order_from_parts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_order_id uuid;
  ord_row public.orders%rowtype;
  total_parts int;
  active_parts int;
  accepted_or_ready_parts int;
  ready_parts int;
  new_subtotal numeric(10, 2);
  computed_status text;
begin
  target_order_id := coalesce(new.order_id, old.order_id);
  select * into ord_row from public.orders where id = target_order_id for update;
  if not found then
    return null;
  end if;

  if ord_row.status in ('out_for_delivery', 'delivered', 'cancelled') then
    return null;
  end if;

  select
    count(*),
    count(*) filter (where status <> 'rejected'),
    count(*) filter (where status in ('accepted', 'ready')),
    count(*) filter (where status = 'ready')
  into total_parts, active_parts, accepted_or_ready_parts, ready_parts
  from public.order_store_parts
  where order_id = target_order_id;

  if total_parts > 0 and active_parts = 0 then
    update public.orders
    set
      subtotal = 0,
      total = 0,
      status = 'cancelled',
      cancelled_at = coalesce(cancelled_at, now()),
      updated_at = now()
    where id = target_order_id;
    return null;
  end if;

  select coalesce(sum(oi.price * oi.qty), 0)
  into new_subtotal
  from public.order_items oi
  join public.order_store_parts osp
    on osp.order_id = oi.order_id and osp.store_id = oi.store_id
  where oi.order_id = target_order_id
    and osp.status <> 'rejected';

  if active_parts > 0 and ready_parts = active_parts then
    computed_status := 'ready_for_pickup';
  elsif active_parts > 0 and accepted_or_ready_parts = active_parts then
    computed_status := 'preparing';
  else
    computed_status := 'placed';
  end if;

  update public.orders
  set
    subtotal = new_subtotal,
    total = case when new_subtotal > 0 then new_subtotal + delivery_fee else 0 end,
    status = computed_status,
    updated_at = now()
  where id = target_order_id;

  return null;
end;
$$;

drop trigger if exists trg_order_parts_sync on public.order_store_parts;
create trigger trg_order_parts_sync
  after insert or update or delete on public.order_store_parts
  for each row execute function public.sync_order_from_parts();

-- =========================================================
-- 4. ROW LEVEL SECURITY POLICIES
-- =========================================================

alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_store_parts enable row level security;
alter table public.notifications enable row level security;

-- PROFILES
drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

drop policy if exists profiles_update_own_safe on public.profiles;
create policy profiles_update_own_safe
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select p.role from public.profiles p where p.id = auth.uid())
    and is_active = (select p.is_active from public.profiles p where p.id = auth.uid())
  );

-- STORES
drop policy if exists stores_select_public_or_owner_admin on public.stores;
create policy stores_select_public_or_owner_admin
  on public.stores for select
  using (is_approved = true or owner_id = auth.uid() or public.is_admin());

drop policy if exists stores_update_owner on public.stores;
create policy stores_update_owner
  on public.stores for update
  using (owner_id = auth.uid() or public.is_admin())
  with check (
    public.is_admin()
    or (
      owner_id = auth.uid()
      and is_approved = (select s.is_approved from public.stores s where s.id = stores.id)
    )
  );

-- MENU ITEMS
drop policy if exists menu_items_select_visible on public.menu_items;
create policy menu_items_select_visible
  on public.menu_items for select
  using (
    exists (
      select 1 from public.stores s
      where s.id = menu_items.store_id
        and (s.is_approved = true or s.owner_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists menu_items_write_owner_or_admin on public.menu_items;
create policy menu_items_write_owner_or_admin
  on public.menu_items for all
  using (
    public.is_admin()
    or exists (
      select 1 from public.stores s
      where s.id = menu_items.store_id and s.owner_id = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.stores s
      where s.id = menu_items.store_id and s.owner_id = auth.uid()
    )
  );

-- ORDERS (Strictly buyer-own or admin; driver/store access goes through scoped RPCs so PII never leaks)
drop policy if exists orders_select_buyer_or_admin on public.orders;
create policy orders_select_buyer_or_admin
  on public.orders for select
  using (buyer_id = auth.uid() or public.is_admin());

-- ORDER ITEMS
drop policy if exists order_items_select_scoped on public.order_items;
create policy order_items_select_scoped
  on public.order_items for select
  using (
    public.is_admin()
    or exists (select 1 from public.orders o where o.id = order_items.order_id and o.buyer_id = auth.uid())
    or exists (select 1 from public.stores s where s.id = order_items.store_id and s.owner_id = auth.uid())
  );

-- ORDER STORE PARTS (No buyer phone/address in this table)
drop policy if exists order_parts_select_scoped on public.order_store_parts;
create policy order_parts_select_scoped
  on public.order_store_parts for select
  using (
    public.is_admin()
    or exists (select 1 from public.orders o where o.id = order_store_parts.order_id and o.buyer_id = auth.uid())
    or exists (select 1 from public.stores s where s.id = order_store_parts.store_id and s.owner_id = auth.uid())
  );

-- NOTIFICATIONS
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
  on public.notifications for select
  using (user_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
  on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- =========================================================
-- 5. STORAGE BUCKET FOR LOGOS AND ITEM PHOTOS
-- =========================================================

insert into storage.buckets (id, name, public)
values ('store-assets', 'store-assets', true)
on conflict (id) do nothing;

drop policy if exists store_assets_public_read on storage.objects;
create policy store_assets_public_read
  on storage.objects for select
  using (bucket_id = 'store-assets');

drop policy if exists store_assets_auth_insert on storage.objects;
create policy store_assets_auth_insert
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'store-assets');

drop policy if exists store_assets_auth_update on storage.objects;
create policy store_assets_auth_update
  on storage.objects for update
  to authenticated
  using (bucket_id = 'store-assets');

drop policy if exists store_assets_auth_delete on storage.objects;
create policy store_assets_auth_delete
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'store-assets');

-- =========================================================
-- 6. SECURITY DEFINER RPC FUNCTIONS
-- =========================================================

create or replace function public.complete_google_onboarding(
  p_role text,
  p_name text,
  p_phone text,
  p_vehicle text default '',
  p_store_name text default '',
  p_store_category text default 'Restaurant'
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  updated_profile public.profiles%rowtype;
  generated_slug text;
begin
  if caller_id is null then
    raise exception 'Authentication required.';
  end if;
  if p_role not in ('buyer', 'driver', 'store') then
    raise exception 'Please choose a customer, driver, or store role.';
  end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'Please enter your full name.';
  end if;
  if char_length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) < 7 then
    raise exception 'Please enter a valid phone number.';
  end if;
  if p_role = 'driver' and char_length(trim(coalesce(p_vehicle, ''))) < 3 then
    raise exception 'Please enter your vehicle type and registration.';
  end if;
  if p_role = 'store' and char_length(trim(coalesce(p_store_name, ''))) < 2 then
    raise exception 'Please enter your business name.';
  end if;

  update public.profiles
  set
    role = p_role,
    name = trim(p_name),
    phone = trim(p_phone),
    vehicle = case when p_role = 'driver' then trim(p_vehicle) else '' end,
    needs_onboarding = false
  where id = caller_id
  returning * into updated_profile;

  if p_role = 'store' then
    generated_slug := regexp_replace(lower(trim(p_store_name)), '[^a-z0-9]+', '-', 'g');
    generated_slug := trim(both '-' from generated_slug) || '-' || substr(caller_id::text, 1, 6);
    insert into public.stores (slug, owner_id, name, category, delivery_time, is_community, is_open, is_approved)
    values (
      generated_slug,
      caller_id,
      trim(p_store_name),
      coalesce(nullif(trim(p_store_category), ''), 'Restaurant'),
      '30–45 min',
      false,
      true,
      false
    )
    on conflict (name) do nothing;
  end if;

  return updated_profile;
end;
$$;

create or replace function public.place_order(
  p_address text,
  p_phone text,
  p_notes text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  caller_profile public.profiles%rowtype;
  new_order_id uuid;
  new_code text;
  item_rec record;
  db_item record;
  store_rec record;
  v_subtotal numeric(10, 2) := 0;
  v_delivery_fee numeric(10, 2) := 20.00;
  v_total numeric(10, 2) := 0;
  distinct_store_id uuid;
begin
  if caller_id is null then
    raise exception 'Please sign in before placing an order.';
  end if;

  select * into caller_profile from public.profiles where id = caller_id;
  if not found or not caller_profile.is_active then
    raise exception 'Your account is inactive or incomplete.';
  end if;
  if char_length(trim(coalesce(p_address, ''))) < 5 then
    raise exception 'Please enter a full delivery address in Shabalala or Hazyview.';
  end if;
  if char_length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) < 7 then
    raise exception 'Please enter a valid contact phone number.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your black bag is empty.';
  end if;

  -- Validate every requested item directly against DB prices, availability, store status, and main-before-addon rule
  create temp table tmp_cart_items (
    store_id uuid,
    menu_item_id uuid,
    name text,
    price numeric(10, 2),
    item_group text,
    qty integer
  ) on commit drop;

  for item_rec in
    select
      (elem ->> 'menuItemId')::uuid as menu_item_id,
      coalesce((elem ->> 'qty')::integer, 0) as qty
    from jsonb_array_elements(p_items) as elem
  loop
    if item_rec.qty <= 0 or item_rec.qty > 50 then
      raise exception 'Invalid item quantity.';
    end if;

    select mi.id, mi.store_id, mi.name, mi.price, mi.item_group, mi.is_available,
           s.name as store_name, s.is_open, s.is_approved
    into db_item
    from public.menu_items mi
    join public.stores s on s.id = mi.store_id
    where mi.id = item_rec.menu_item_id;

    if not found then
      raise exception 'One of the menu items is no longer available.';
    end if;
    if not db_item.is_approved then
      raise exception '% is currently unavailable.', db_item.store_name;
    end if;
    if not db_item.is_open then
      raise exception '% is currently closed.', db_item.store_name;
    end if;
    if not db_item.is_available then
      raise exception '% at % is sold out.', db_item.name, db_item.store_name;
    end if;

    insert into tmp_cart_items (store_id, menu_item_id, name, price, item_group, qty)
    values (db_item.store_id, db_item.id, db_item.name, db_item.price, db_item.item_group, item_rec.qty);

    v_subtotal := v_subtotal + (db_item.price * item_rec.qty);
  end loop;

  -- Require at least one main item for any store that has extras, sides, or drinks in the order
  for distinct_store_id in
    select distinct store_id from tmp_cart_items where item_group in ('side', 'extra', 'drink')
  loop
    if not exists (
      select 1 from tmp_cart_items
      where store_id = distinct_store_id and item_group = 'main'
    ) then
      select name into store_rec from public.stores where id = distinct_store_id;
      raise exception 'Add a main meal from % before adding sides, extras, or drinks.', coalesce(store_rec.name, 'this store');
    end if;
  end loop;

  v_total := v_subtotal + v_delivery_fee;
  new_code := public.generate_order_code();

  insert into public.orders (
    code, buyer_id, buyer_phone, address, notes, subtotal, delivery_fee, total, status
  )
  values (
    new_code,
    caller_id,
    trim(p_phone),
    trim(p_address),
    trim(coalesce(p_notes, '')),
    v_subtotal,
    v_delivery_fee,
    v_total,
    'placed'
  )
  returning id into new_order_id;

  insert into public.order_items (order_id, store_id, menu_item_id, name, price, item_group, qty)
  select new_order_id, store_id, menu_item_id, name, price, item_group, qty
  from tmp_cart_items;

  insert into public.order_store_parts (order_id, store_id, status)
  select distinct new_order_id, store_id, 'pending'
  from tmp_cart_items;

  insert into public.notifications (user_id, order_id, text)
  select distinct s.owner_id, new_order_id, 'New order ' || new_code || ' received for ' || s.name || '.'
  from tmp_cart_items t
  join public.stores s on s.id = t.store_id
  where s.owner_id is not null;

  return jsonb_build_object(
    'order_id', new_order_id,
    'code', new_code,
    'total', v_total
  );
end;
$$;

create or replace function public.buyer_cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  ord public.orders%rowtype;
begin
  if caller_id is null then
    raise exception 'Authentication required.';
  end if;

  select * into ord from public.orders where id = p_order_id for update;
  if not found or ord.buyer_id <> caller_id then
    raise exception 'Order not found.';
  end if;
  if ord.status <> 'placed' then
    raise exception 'Order can no longer be cancelled because preparation or delivery has started.';
  end if;
  if exists (
    select 1 from public.order_store_parts
    where order_id = p_order_id and status in ('accepted', 'ready')
  ) then
    raise exception 'A store has already accepted this order, so it can no longer be cancelled.';
  end if;

  update public.orders
  set status = 'cancelled', cancelled_at = now(), updated_at = now()
  where id = p_order_id;

  insert into public.notifications (user_id, order_id, text)
  select distinct s.owner_id, p_order_id, 'Order ' || ord.code || ' was cancelled by the customer.'
  from public.order_store_parts osp
  join public.stores s on s.id = osp.store_id
  where osp.order_id = p_order_id and s.owner_id is not null;
end;
$$;

create or replace function public.get_buyer_orders()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(order_json order by created_at desc)
    from (
      select
        o.created_at,
        jsonb_build_object(
          'id', o.id,
          'code', o.code,
          'address', o.address,
          'buyer_phone', o.buyer_phone,
          'notes', o.notes,
          'subtotal', o.subtotal,
          'delivery_fee', o.delivery_fee,
          'total', o.total,
          'status', o.status,
          'driver_id', o.driver_id,
          'created_at', o.created_at,
          'picked_up_at', o.picked_up_at,
          'delivered_at', o.delivered_at,
          'cancelled_at', o.cancelled_at,
          'driver', case when drv.id is not null then jsonb_build_object(
            'id', drv.id,
            'name', drv.name,
            'phone', drv.phone,
            'vehicle', drv.vehicle
          ) else null end,
          'parts', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', osp.id,
              'store_id', osp.store_id,
              'store_name', s.name,
              'status', osp.status,
              'reason', osp.reason
            ) order by s.name)
            from public.order_store_parts osp
            join public.stores s on s.id = osp.store_id
            where osp.order_id = o.id
          ), '[]'::jsonb),
          'items', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', oi.id,
              'store_id', oi.store_id,
              'store_name', s.name,
              'name', oi.name,
              'price', oi.price,
              'qty', oi.qty
            ) order by s.name, oi.name)
            from public.order_items oi
            join public.stores s on s.id = oi.store_id
            where oi.order_id = o.id
          ), '[]'::jsonb)
        ) as order_json
      from public.orders o
      left join public.profiles drv on drv.id = o.driver_id
      where o.buyer_id = caller_id
    ) sub
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_store_orders()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  owned_store_id uuid;
begin
  if caller_id is null then
    return '[]'::jsonb;
  end if;

  select id into owned_store_id from public.stores where owner_id = caller_id limit 1;
  if owned_store_id is null then
    return '[]'::jsonb;
  end if;

  -- Strictly excludes buyer_phone and address per privacy contract
  return coalesce((
    select jsonb_agg(part_json order by created_at desc)
    from (
      select
        o.created_at,
        jsonb_build_object(
          'part_id', osp.id,
          'order_id', o.id,
          'order_code', o.code,
          'order_status', o.status,
          'part_status', osp.status,
          'reason', osp.reason,
          'buyer_first_name', split_part(b.name, ' ', 1),
          'created_at', o.created_at,
          'store_subtotal', coalesce((
            select sum(oi.price * oi.qty)
            from public.order_items oi
            where oi.order_id = o.id and oi.store_id = owned_store_id
          ), 0),
          'items', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', oi.id,
              'name', oi.name,
              'price', oi.price,
              'qty', oi.qty
            ) order by oi.name)
            from public.order_items oi
            where oi.order_id = o.id and oi.store_id = owned_store_id
          ), '[]'::jsonb)
        ) as part_json
      from public.order_store_parts osp
      join public.orders o on o.id = osp.order_id
      join public.profiles b on b.id = o.buyer_id
      where osp.store_id = owned_store_id
    ) sub
  ), '[]'::jsonb);
end;
$$;

create or replace function public.store_respond_order_part(
  p_part_id uuid,
  p_action text,
  p_reason text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  part_row public.order_store_parts%rowtype;
  store_row public.stores%rowtype;
  ord_row public.orders%rowtype;
begin
  if caller_id is null then
    raise exception 'Authentication required.';
  end if;
  if p_action not in ('accept', 'reject', 'ready') then
    raise exception 'Invalid store action.';
  end if;

  select * into part_row from public.order_store_parts where id = p_part_id for update;
  if not found then
    raise exception 'Order part not found.';
  end if;

  select * into store_row from public.stores where id = part_row.store_id;
  if not found or (store_row.owner_id <> caller_id and not public.is_admin()) then
    raise exception 'Only the owning store can update this order.';
  end if;

  select * into ord_row from public.orders where id = part_row.order_id;
  if ord_row.status in ('out_for_delivery', 'delivered', 'cancelled') then
    raise exception 'Order has already been finalized.';
  end if;

  if p_action = 'accept' then
    if part_row.status <> 'pending' then
      raise exception 'Order part is already %.', part_row.status;
    end if;
    update public.order_store_parts
    set status = 'accepted', accepted_at = now()
    where id = p_part_id;

    insert into public.notifications (user_id, order_id, text)
    values (ord_row.buyer_id, ord_row.id, store_row.name || ' accepted order ' || ord_row.code || ' and started preparing.');
  elsif p_action = 'reject' then
    if part_row.status not in ('pending', 'accepted') then
      raise exception 'Cannot reject after marking ready.';
    end if;
    if char_length(trim(coalesce(p_reason, ''))) < 3 then
      raise exception 'Please provide a reason for rejecting this order.';
    end if;
    update public.order_store_parts
    set status = 'rejected', reason = trim(p_reason), rejected_at = now()
    where id = p_part_id;

    insert into public.notifications (user_id, order_id, text)
    values (ord_row.buyer_id, ord_row.id, store_row.name || ' declined part of ' || ord_row.code || ': ' || trim(p_reason));
  elsif p_action = 'ready' then
    if part_row.status <> 'accepted' then
      raise exception 'Please accept the order before marking it ready for pickup.';
    end if;
    update public.order_store_parts
    set status = 'ready', ready_at = now()
    where id = p_part_id;

    insert into public.notifications (user_id, order_id, text)
    values (ord_row.buyer_id, ord_row.id, store_row.name || ' marked ' || ord_row.code || ' ready for pickup.');
  end if;
end;
$$;

create or replace function public.driver_set_online(p_online boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null or public.current_user_role() <> 'driver' then
    raise exception 'Only drivers can toggle availability.';
  end if;
  update public.profiles set is_online = coalesce(p_online, false) where id = caller_id;
end;
$$;

create or replace function public.get_driver_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  caller_profile public.profiles%rowtype;
  available_jobs jsonb;
  active_jobs jsonb;
  history_jobs jsonb;
begin
  if caller_id is null then
    return jsonb_build_object('available', '[]'::jsonb, 'active', '[]'::jsonb, 'history', '[]'::jsonb);
  end if;
  select * into caller_profile from public.profiles where id = caller_id;
  if not found or caller_profile.role <> 'driver' or not caller_profile.is_active then
    raise exception 'Driver access required.';
  end if;

  -- Available jobs visible ONLY when driver is online; hide customer phone/notes until accepted
  if caller_profile.is_online then
    available_jobs := coalesce((
      select jsonb_agg(job_json order by created_at asc)
      from (
        select
          o.created_at,
          jsonb_build_object(
            'id', o.id,
            'code', o.code,
            'delivery_fee', o.delivery_fee,
            'status', o.status,
            'created_at', o.created_at,
            'stores', coalesce((
              select jsonb_agg(jsonb_build_object(
                'store_id', s.id,
                'store_name', s.name,
                'items', coalesce((
                  select jsonb_agg(jsonb_build_object('name', oi.name, 'qty', oi.qty))
                  from public.order_items oi
                  where oi.order_id = o.id and oi.store_id = s.id
                ), '[]'::jsonb)
              ) order by s.name)
              from public.order_store_parts osp
              join public.stores s on s.id = osp.store_id
              where osp.order_id = o.id and osp.status <> 'rejected'
            ), '[]'::jsonb)
          ) as job_json
        from public.orders o
        where o.status = 'ready_for_pickup' and o.driver_id is null
      ) sub
    ), '[]'::jsonb);
  else
    available_jobs := '[]'::jsonb;
  end if;

  -- Active assigned orders: customer phone, address, and notes visible ONLY while active
  active_jobs := coalesce((
    select jsonb_agg(active_json order by created_at asc)
    from (
      select
        o.created_at,
        jsonb_build_object(
          'id', o.id,
          'code', o.code,
          'status', o.status,
          'delivery_fee', o.delivery_fee,
          'total', o.total,
          'buyer_name', b.name,
          'buyer_phone', coalesce(nullif(o.buyer_phone, ''), b.phone),
          'address', o.address,
          'notes', o.notes,
          'created_at', o.created_at,
          'picked_up_at', o.picked_up_at,
          'stores', coalesce((
            select jsonb_agg(jsonb_build_object(
              'store_id', s.id,
              'store_name', s.name,
              'items', coalesce((
                select jsonb_agg(jsonb_build_object('name', oi.name, 'qty', oi.qty))
                from public.order_items oi
                where oi.order_id = o.id and oi.store_id = s.id
              ), '[]'::jsonb)
            ) order by s.name)
            from public.order_store_parts osp
            join public.stores s on s.id = osp.store_id
            where osp.order_id = o.id and osp.status <> 'rejected'
          ), '[]'::jsonb)
        ) as active_json
      from public.orders o
      join public.profiles b on b.id = o.buyer_id
      where o.driver_id = caller_id and o.status in ('ready_for_pickup', 'out_for_delivery')
    ) sub
  ), '[]'::jsonb);

  -- Completed history (no sensitive buyer PII retained after delivery)
  history_jobs := coalesce((
    select jsonb_agg(hist_json order by delivered_at desc nulls last)
    from (
      select
        o.delivered_at,
        jsonb_build_object(
          'id', o.id,
          'code', o.code,
          'delivery_fee', o.delivery_fee,
          'delivered_at', o.delivered_at,
          'store_names', coalesce((
            select jsonb_agg(s.name order by s.name)
            from public.order_store_parts osp
            join public.stores s on s.id = osp.store_id
            where osp.order_id = o.id and osp.status <> 'rejected'
          ), '[]'::jsonb)
        ) as hist_json
      from public.orders o
      where o.driver_id = caller_id and o.status = 'delivered'
      limit 50
    ) sub
  ), '[]'::jsonb);

  return jsonb_build_object(
    'available', available_jobs,
    'active', active_jobs,
    'history', history_jobs
  );
end;
$$;

create or replace function public.driver_accept_job(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  drv public.profiles%rowtype;
  ord public.orders%rowtype;
begin
  if caller_id is null then
    raise exception 'Authentication required.';
  end if;
  select * into drv from public.profiles where id = caller_id;
  if not found or drv.role <> 'driver' or not drv.is_active then
    raise exception 'Only active drivers can accept delivery jobs.';
  end if;
  if not drv.is_online then
    raise exception 'Switch online before accepting a job.';
  end if;

  select * into ord from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found.';
  end if;
  if ord.status <> 'ready_for_pickup' or ord.driver_id is not null then
    raise exception 'This delivery job was already claimed by another driver.';
  end if;

  update public.orders
  set driver_id = caller_id, updated_at = now()
  where id = p_order_id;

  insert into public.notifications (user_id, order_id, text)
  values (ord.buyer_id, ord.id, 'Driver ' || drv.name || ' is on the way to collect ' || ord.code || '.');
end;
$$;

create or replace function public.driver_update_delivery_status(
  p_order_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  ord public.orders%rowtype;
begin
  if caller_id is null then
    raise exception 'Authentication required.';
  end if;
  if p_status not in ('out_for_delivery', 'delivered') then
    raise exception 'Invalid driver delivery status.';
  end if;

  select * into ord from public.orders where id = p_order_id for update;
  if not found or ord.driver_id <> caller_id then
    raise exception 'Assigned delivery not found.';
  end if;

  if p_status = 'out_for_delivery' then
    if ord.status <> 'ready_for_pickup' then
      raise exception 'Order is not waiting for pickup.';
    end if;
    update public.orders
    set status = 'out_for_delivery', picked_up_at = now(), updated_at = now()
    where id = p_order_id;

    insert into public.notifications (user_id, order_id, text)
    values (ord.buyer_id, ord.id, 'Your order ' || ord.code || ' has been picked up and is on its way!');
  elsif p_status = 'delivered' then
    if ord.status not in ('ready_for_pickup', 'out_for_delivery') then
      raise exception 'Order cannot be marked delivered from current state.';
    end if;
    update public.orders
    set
      status = 'delivered',
      picked_up_at = coalesce(picked_up_at, now()),
      delivered_at = now(),
      updated_at = now()
    where id = p_order_id;

    insert into public.notifications (user_id, order_id, text)
    values (ord.buyer_id, ord.id, 'Order ' || ord.code || ' has been delivered. Enjoy!');
  end if;
end;
$$;

create or replace function public.get_admin_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required.';
  end if;

  return jsonb_build_object(
    'stats', jsonb_build_object(
      'gmv', coalesce((select sum(total) from public.orders where status <> 'cancelled'), 0),
      'orders', (select count(*) from public.orders),
      'users', (select count(*) from public.profiles),
      'stores', (select count(*) from public.stores where is_approved = true)
    ),
    'stores', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'category', s.category,
        'delivery_time', s.delivery_time,
        'is_community', s.is_community,
        'is_open', s.is_open,
        'is_approved', s.is_approved,
        'owner_email', coalesce(au.email, ''),
        'owner_name', coalesce(p.name, '')
      ) order by s.is_approved asc, s.name asc)
      from public.stores s
      left join public.profiles p on p.id = s.owner_id
      left join auth.users au on au.id = s.owner_id
    ), '[]'::jsonb),
    'drivers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'phone', p.phone,
        'vehicle', p.vehicle,
        'is_online', p.is_online
      ) order by p.name)
      from public.profiles p
      where p.role = 'driver' and p.is_active = true
    ), '[]'::jsonb),
    'users', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'email', coalesce(au.email, ''),
        'name', p.name,
        'role', p.role,
        'phone', p.phone,
        'is_active', p.is_active,
        'created_at', p.created_at
      ) order by p.created_at desc)
      from public.profiles p
      left join auth.users au on au.id = p.id
    ), '[]'::jsonb),
    'orders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id,
        'code', o.code,
        'buyer_name', b.name,
        'driver_id', o.driver_id,
        'driver_name', coalesce(d.name, ''),
        'address', o.address,
        'total', o.total,
        'status', o.status,
        'created_at', o.created_at
      ) order by o.created_at desc)
      from (select * from public.orders order by created_at desc limit 80) o
      join public.profiles b on b.id = o.buyer_id
      left join public.profiles d on d.id = o.driver_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_set_store_approval(p_store_id uuid, p_approved boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required.';
  end if;
  update public.stores set is_approved = coalesce(p_approved, false) where id = p_store_id;
end;
$$;

create or replace function public.admin_onboard_vendor(
  p_name text,
  p_category text,
  p_dish_name text,
  p_price numeric,
  p_owner_email text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_store_id uuid;
  v_slug text;
begin
  if not public.is_admin() then
    raise exception 'Admin access required.';
  end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 or char_length(trim(coalesce(p_dish_name, ''))) < 2 then
    raise exception 'Vendor name and signature dish name are required.';
  end if;
  if p_price is null or p_price < 0 then
    raise exception 'Price must be zero or positive.';
  end if;

  if trim(coalesce(p_owner_email, '')) <> '' then
    select id into v_owner_id from auth.users where lower(email) = lower(trim(p_owner_email)) limit 1;
    if v_owner_id is not null then
      update public.profiles set role = 'store' where id = v_owner_id and role = 'buyer';
    end if;
  end if;

  v_slug := regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g');
  v_slug := trim(both '-' from v_slug);

  insert into public.stores (slug, owner_id, name, category, delivery_time, is_community, is_open, is_approved)
  values (
    v_slug,
    v_owner_id,
    trim(p_name),
    coalesce(nullif(trim(p_category), ''), 'Community'),
    '25–40 min',
    lower(trim(coalesce(p_category, ''))) = 'community',
    true,
    true
  )
  returning id into v_store_id;

  insert into public.menu_items (store_id, name, price, item_group, is_available, sort_order)
  values (v_store_id, trim(p_dish_name), p_price, 'main', true, 1);

  return v_store_id;
end;
$$;

create or replace function public.admin_cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ord public.orders%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Admin access required.';
  end if;
  select * into ord from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found.';
  end if;
  update public.orders
  set status = 'cancelled', cancelled_at = coalesce(cancelled_at, now()), updated_at = now()
  where id = p_order_id;
  insert into public.notifications (user_id, order_id, text)
  values (ord.buyer_id, ord.id, 'Order ' || ord.code || ' was cancelled by HazyEats support.');
end;
$$;

create or replace function public.admin_reassign_driver(p_order_id uuid, p_driver_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ord public.orders%rowtype;
  drv public.profiles%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Admin access required.';
  end if;
  select * into ord from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found.';
  end if;
  select * into drv from public.profiles where id = p_driver_id and role = 'driver' and is_active = true;
  if not found then
    raise exception 'Selected driver is invalid or inactive.';
  end if;
  update public.orders set driver_id = p_driver_id, updated_at = now() where id = p_order_id;
  insert into public.notifications (user_id, order_id, text)
  values (p_driver_id, ord.id, 'Admin assigned delivery ' || ord.code || ' to you.');
end;
$$;

create or replace function public.admin_set_user_active(p_user_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required.';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Cannot deactivate your own admin account.';
  end if;
  update public.profiles set is_active = coalesce(p_active, true) where id = p_user_id;
end;
$$;

-- =========================================================
-- 7. REALTIME PUBLICATION
-- =========================================================

alter table public.orders replica identity full;
alter table public.order_store_parts replica identity full;
alter table public.menu_items replica identity full;
alter table public.notifications replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'order_store_parts'
  ) then
    alter publication supabase_realtime add table public.order_store_parts;
  end if;
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'menu_items'
  ) then
    alter publication supabase_realtime add table public.menu_items;
  end if;
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
