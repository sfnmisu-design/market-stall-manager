-- ═══════════════════════════════════════════════════════════════════════════
-- MARKET STALL MANAGER — Supabase Database Schema
-- Run this entire file in: Supabase Dashboard → SQL Editor → New Query → Run
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── Users ────────────────────────────────────────────────────────────────────
create table if not exists public.users (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  email       text not null unique,
  password    text not null,  -- stored as plain text for demo; use bcrypt in production
  role        text not null default 'cashier' check (role in ('admin','manager','cashier')),
  created_at  timestamptz default now()
);

-- ── Stall Types ───────────────────────────────────────────────────────────────
create table if not exists public.stall_types (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null unique,
  bg_color    text not null default '#f3f4f6',
  border_color text not null default '#6b7280',
  text_color  text not null default '#374151',
  created_at  timestamptz default now()
);

-- ── Stalls ────────────────────────────────────────────────────────────────────
create table if not exists public.stalls (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null unique,
  zone        text not null,
  type        text not null references public.stall_types(name) on update cascade,
  size        text not null default '3×3m',
  price       numeric(10,2) not null,
  notes       text default '',
  status      text not null default 'available' check (status in ('available','booked','pending')),
  created_at  timestamptz default now()
);

-- ── Bookings ──────────────────────────────────────────────────────────────────
create table if not exists public.bookings (
  id            uuid primary key default uuid_generate_v4(),
  stall_id      uuid not null references public.stalls(id) on delete cascade,
  renter_name   text not null,
  email         text default '',
  phone         text default '',
  start_date    date not null,
  end_date      date not null,
  days          int not null,
  subtotal      numeric(10,2) not null,
  vat_amount    numeric(10,2) not null default 0,
  total         numeric(10,2) not null,
  amount_paid   numeric(10,2) not null default 0,
  notes         text default '',
  booked_by     text default '',
  receipt_no    int not null,
  created_at    timestamptz default now()
);

-- ── Activity Log ──────────────────────────────────────────────────────────────
create table if not exists public.activity_log (
  id          uuid primary key default uuid_generate_v4(),
  type        text not null,
  message     text not null,
  user_name   text default '',
  created_at  timestamptz default now()
);

-- ── Settings ─────────────────────────────────────────────────────────────────
create table if not exists public.settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz default now()
);

-- ── Receipt Counter ───────────────────────────────────────────────────────────
create table if not exists public.counters (
  key         text primary key,
  value       int not null default 0
);

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- All tables are readable/writable by anyone with the anon key.
-- For a production app you should tighten these policies.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.users        enable row level security;
alter table public.stall_types  enable row level security;
alter table public.stalls       enable row level security;
alter table public.bookings     enable row level security;
alter table public.activity_log enable row level security;
alter table public.settings     enable row level security;
alter table public.counters     enable row level security;

-- Allow full access with anon key (the app handles its own auth)
create policy "anon_all_users"        on public.users        for all using (true) with check (true);
create policy "anon_all_stall_types"  on public.stall_types  for all using (true) with check (true);
create policy "anon_all_stalls"       on public.stalls       for all using (true) with check (true);
create policy "anon_all_bookings"     on public.bookings     for all using (true) with check (true);
create policy "anon_all_activity_log" on public.activity_log for all using (true) with check (true);
create policy "anon_all_settings"     on public.settings     for all using (true) with check (true);
create policy "anon_all_counters"     on public.counters     for all using (true) with check (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- SEED DATA — Default users, stall types, stalls, settings, counters
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.users (name, email, password, role) values
  ('Admin User',     'admin@market.com',   'admin123',   'admin'),
  ('Market Manager', 'manager@market.com', 'manager123', 'manager'),
  ('Cashier One',    'cashier@market.com', 'cashier123', 'cashier')
on conflict (email) do nothing;

insert into public.stall_types (name, bg_color, border_color, text_color) values
  ('Food',   '#fff3e0', '#fb8c00', '#e65100'),
  ('Retail', '#e3f2fd', '#1e88e5', '#0d47a1'),
  ('Craft',  '#f3e5f5', '#8e24aa', '#4a148c')
on conflict (name) do nothing;

insert into public.stalls (name, zone, type, size, price, notes) values
  ('A1','A','Food',  '3×3m',120,'Near main entrance'),
  ('A2','A','Food',  '3×3m',120,''),
  ('A3','A','Food',  '4×3m',150,''),
  ('A4','A','Food',  '4×3m',150,''),
  ('B1','B','Retail','3×3m',100,''),
  ('B2','B','Retail','3×3m',100,''),
  ('B3','B','Retail','6×3m',200,'Corner – high traffic'),
  ('B4','B','Retail','3×3m',100,''),
  ('C1','C','Craft', '3×3m', 80,''),
  ('C2','C','Craft', '3×3m', 80,''),
  ('C3','C','Craft', '3×3m', 80,''),
  ('C4','C','Craft', '6×3m',140,'Large display area')
on conflict (name) do nothing;

insert into public.settings (key, value) values
  ('branding', '{"orgName":"SFN TechGeek","appName":"Market Stall Manager","tagline":"Professional market management","logoSrc":""}'),
  ('vat',      '{"enabled":false,"rate":0,"label":"VAT"}')
on conflict (key) do nothing;

insert into public.counters (key, value) values
  ('receipts', 2001)
on conflict (key) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- REALTIME — enable live updates for all tables
-- ═══════════════════════════════════════════════════════════════════════════
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;

alter publication supabase_realtime add table public.stalls;
alter publication supabase_realtime add table public.bookings;
alter publication supabase_realtime add table public.activity_log;
alter publication supabase_realtime add table public.settings;
alter publication supabase_realtime add table public.users;
alter publication supabase_realtime add table public.stall_types;
alter publication supabase_realtime add table public.counters;


-- ═══════════════════════════════════════════════════════════════════════════
-- AUDIT FIXES — Run this block if you already ran the schema above
-- Adds missing columns and performance indexes
-- ═══════════════════════════════════════════════════════════════════════════

-- Missing columns added after initial deploy
alter table public.bookings add column if not exists booked_at_fmt text default '';
alter table public.bookings add column if not exists stall_name    text default '';
alter table public.bookings add column if not exists stall_zone    text default '';
alter table public.bookings add column if not exists stall_type    text default '';
alter table public.bookings add column if not exists stall_size    text default '';
alter table public.bookings add column if not exists stall_price   numeric(10,2) default 0;
alter table public.bookings add column if not exists stall_notes   text default '';
alter table public.bookings add column if not exists weeks         integer default 0;

-- Performance indexes
create index if not exists idx_bookings_stall_id   on public.bookings(stall_id);
create index if not exists idx_bookings_created_at on public.bookings(created_at desc);
create index if not exists idx_bookings_end_date   on public.bookings(end_date);
create index if not exists idx_stalls_zone         on public.stalls(zone);
create index if not exists idx_stalls_status       on public.stalls(status);
create index if not exists idx_activity_log_time   on public.activity_log(created_at desc);
create index if not exists idx_users_email         on public.users(email);
