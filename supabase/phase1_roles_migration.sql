do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('owner', 'staff');
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade,
  email text,
  role public.app_role not null default 'staff',
  full_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_owner_id_idx on public.profiles(owner_id);
create index if not exists profiles_role_idx on public.profiles(role);

insert into public.profiles (id, owner_id, email, role)
select users.id, users.id, users.email, 'owner'::public.app_role
from auth.users users
where not exists (
  select 1 from public.profiles profiles where profiles.id = users.id
);

update public.profiles
set owner_id = id
where role = 'owner' and owner_id is null;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, owner_id, email, role)
  values (new.id, null, new.email, 'staff'::public.app_role)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

create or replace function public.current_profile_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.current_profile_owner_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(owner_id, id) from public.profiles where id = auth.uid()
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_profile_role() = 'owner'::public.app_role
$$;

alter table public.profiles enable row level security;

drop policy if exists "profiles read own or staff" on public.profiles;
drop policy if exists "profiles update own owner staff" on public.profiles;
drop policy if exists "profiles insert own profile" on public.profiles;

create policy "profiles read own or staff" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or (public.is_owner() and owner_id = auth.uid())
  );

create policy "profiles update own owner staff" on public.profiles
  for update to authenticated
  using (
    public.is_owner()
    and (id = auth.uid() or owner_id = auth.uid())
  )
  with check (
    public.is_owner()
    and (id = auth.uid() or owner_id = auth.uid())
  );

create policy "profiles insert own profile" on public.profiles
  for insert to authenticated
  with check (id = auth.uid() and owner_id is null and role = 'staff'::public.app_role);

drop policy if exists "users read own suppliers" on public.suppliers;
drop policy if exists "users insert own suppliers" on public.suppliers;
drop policy if exists "users update own suppliers" on public.suppliers;
drop policy if exists "users delete own suppliers" on public.suppliers;
drop policy if exists "phase1 read assigned suppliers" on public.suppliers;
drop policy if exists "phase1 insert assigned suppliers" on public.suppliers;
drop policy if exists "phase1 update assigned suppliers" on public.suppliers;
drop policy if exists "phase1 delete owner suppliers" on public.suppliers;

create policy "phase1 read assigned suppliers" on public.suppliers
  for select to authenticated
  using (user_id = public.current_profile_owner_id());
create policy "phase1 insert assigned suppliers" on public.suppliers
  for insert to authenticated
  with check (user_id = public.current_profile_owner_id());
create policy "phase1 update assigned suppliers" on public.suppliers
  for update to authenticated
  using (user_id = public.current_profile_owner_id())
  with check (user_id = public.current_profile_owner_id());
create policy "phase1 delete owner suppliers" on public.suppliers
  for delete to authenticated
  using (public.is_owner() and user_id = auth.uid());

drop policy if exists "users read own invoices" on public.invoices;
drop policy if exists "users insert own invoices" on public.invoices;
drop policy if exists "users update own invoices" on public.invoices;
drop policy if exists "users delete own invoices" on public.invoices;
drop policy if exists "phase1 read assigned invoices" on public.invoices;
drop policy if exists "phase1 insert assigned invoices" on public.invoices;
drop policy if exists "phase1 update assigned invoices" on public.invoices;
drop policy if exists "phase1 delete owner invoices" on public.invoices;

create policy "phase1 read assigned invoices" on public.invoices
  for select to authenticated
  using (user_id = public.current_profile_owner_id());
create policy "phase1 insert assigned invoices" on public.invoices
  for insert to authenticated
  with check (user_id = public.current_profile_owner_id());
create policy "phase1 update assigned invoices" on public.invoices
  for update to authenticated
  using (user_id = public.current_profile_owner_id())
  with check (user_id = public.current_profile_owner_id());
create policy "phase1 delete owner invoices" on public.invoices
  for delete to authenticated
  using (public.is_owner() and user_id = auth.uid());

drop policy if exists "users read own inventory" on public.inventory;
drop policy if exists "users insert own inventory" on public.inventory;
drop policy if exists "users update own inventory" on public.inventory;
drop policy if exists "users delete own inventory" on public.inventory;
drop policy if exists "phase1 read assigned inventory" on public.inventory;
drop policy if exists "phase1 insert assigned inventory" on public.inventory;
drop policy if exists "phase1 update assigned inventory" on public.inventory;
drop policy if exists "phase1 delete owner inventory" on public.inventory;

create policy "phase1 read assigned inventory" on public.inventory
  for select to authenticated
  using (user_id = public.current_profile_owner_id());
create policy "phase1 insert assigned inventory" on public.inventory
  for insert to authenticated
  with check (user_id = public.current_profile_owner_id());
create policy "phase1 update assigned inventory" on public.inventory
  for update to authenticated
  using (user_id = public.current_profile_owner_id())
  with check (user_id = public.current_profile_owner_id());
create policy "phase1 delete owner inventory" on public.inventory
  for delete to authenticated
  using (public.is_owner() and user_id = auth.uid());

drop policy if exists "users read own app_state" on public.app_state;
drop policy if exists "users insert own app_state" on public.app_state;
drop policy if exists "users update own app_state" on public.app_state;
drop policy if exists "users delete own app_state" on public.app_state;
drop policy if exists "phase1 owner read app_state" on public.app_state;
drop policy if exists "phase1 owner insert app_state" on public.app_state;
drop policy if exists "phase1 owner update app_state" on public.app_state;
drop policy if exists "phase1 owner delete app_state" on public.app_state;

create policy "phase1 owner read app_state" on public.app_state
  for select to authenticated
  using (public.is_owner() and user_id = auth.uid());
create policy "phase1 owner insert app_state" on public.app_state
  for insert to authenticated
  with check (public.is_owner() and user_id = auth.uid());
create policy "phase1 owner update app_state" on public.app_state
  for update to authenticated
  using (public.is_owner() and user_id = auth.uid())
  with check (public.is_owner() and user_id = auth.uid());
create policy "phase1 owner delete app_state" on public.app_state
  for delete to authenticated
  using (public.is_owner() and user_id = auth.uid());
