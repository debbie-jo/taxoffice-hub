create table if not exists public.app_state (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

drop policy if exists "Allow public read app_state" on public.app_state;
drop policy if exists "Allow public upsert app_state" on public.app_state;
drop policy if exists "Allow signed-in users to read app_state" on public.app_state;
drop policy if exists "Allow signed-in users to write app_state" on public.app_state;

create policy "Allow public read app_state"
on public.app_state
for select
using (true);

create policy "Allow public upsert app_state"
on public.app_state
for all
using (true)
with check (true);

alter table if exists public.clients enable row level security;

drop policy if exists "Allow public read clients" on public.clients;
drop policy if exists "Allow public write clients" on public.clients;
drop policy if exists "Allow signed-in users to read clients" on public.clients;
drop policy if exists "Allow signed-in users to write clients" on public.clients;

create policy "Allow public read clients"
on public.clients
for select
using (true);

create policy "Allow public write clients"
on public.clients
for all
using (true)
with check (true);

alter table if exists public.client_histories enable row level security;

drop policy if exists "Allow public read client_histories" on public.client_histories;
drop policy if exists "Allow public write client_histories" on public.client_histories;
drop policy if exists "Allow signed-in users to read client_histories" on public.client_histories;
drop policy if exists "Allow signed-in users to write client_histories" on public.client_histories;

create policy "Allow public read client_histories"
on public.client_histories
for select
using (true);

create policy "Allow public write client_histories"
on public.client_histories
for all
using (true)
with check (true);
