-- CardápioPro — schema Postgres para Railway
-- Sem dependências do Supabase (auth.users, storage, RLS).
-- A autorização fica na API (JWT).

create extension if not exists "pgcrypto";

-- Usuários (substitui auth.users do Supabase)
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists users_email_unique
  on public.users (lower(email));

-- Restaurantes
create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  name text not null,
  slug text not null,
  plan text not null default 'free' check (plan in ('free', 'pro', 'enterprise')),
  theme jsonb not null default '{}'::jsonb,
  subscription_status text not null default 'manual'
    check (subscription_status in ('active', 'trialing', 'paused', 'canceled', 'manual')),
  current_period_end timestamptz,
  updated_by_admin_id uuid references public.users (id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where c.conname = 'restaurants_slug_unique' and n.nspname = 'public' and t.relname = 'restaurants'
  ) then
    alter table public.restaurants add constraint restaurants_slug_unique unique (slug);
  end if;
end
$$;

create index if not exists restaurants_user_id_idx on public.restaurants (user_id);

-- Cardápios
create table if not exists public.menus (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  slug text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists menus_restaurant_id_idx on public.menus (restaurant_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where c.conname = 'menus_restaurant_slug_unique' and n.nspname = 'public' and t.relname = 'menus'
  ) then
    alter table public.menus add constraint menus_restaurant_slug_unique unique (restaurant_id, slug);
  end if;
end
$$;

-- Categorias
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  menu_id uuid not null references public.menus (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists categories_restaurant_id_idx on public.categories (restaurant_id);
create index if not exists categories_menu_id_idx on public.categories (menu_id);

-- Produtos
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  menu_id uuid not null references public.menus (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  name text not null,
  description text,
  price numeric(12, 2) not null check (price >= 0),
  image_url text,
  is_available boolean not null default true,
  highlight_badge text check (highlight_badge is null or highlight_badge in ('new', 'bestseller', 'special')),
  created_at timestamptz not null default now()
);

create index if not exists products_restaurant_id_idx on public.products (restaurant_id);
create index if not exists products_category_id_idx on public.products (category_id);
create index if not exists products_menu_id_idx on public.products (menu_id);

-- Admins da plataforma
create table if not exists public.platform_admins (
  user_id uuid primary key references public.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Auditoria admin
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.users (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  action text not null,
  old_plan text,
  new_plan text,
  old_status text,
  new_status text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_restaurant_idx
  on public.admin_audit_logs (restaurant_id, created_at desc);

-- Notificações de suporte / plano
create table if not exists public.support_notifications (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  request_type text not null check (request_type in ('plan', 'support')),
  contact_whatsapp text not null,
  message text not null,
  status text not null default 'new' check (status in ('new', 'in_progress', 'done')),
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by_admin_id uuid references public.users (id)
);

create index if not exists support_notifications_created_idx
  on public.support_notifications (created_at desc);

create index if not exists support_notifications_restaurant_idx
  on public.support_notifications (restaurant_id);
