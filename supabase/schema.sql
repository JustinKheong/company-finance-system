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

create table if not exists public.suppliers (
  id text primary key,
  user_id uuid not null default auth.uid(),
  name text not null,
  normalized_name text not null,
  phone text,
  email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists suppliers_user_id_idx on public.suppliers(user_id);

create table if not exists public.invoices (
  id text primary key,
  user_id uuid not null default auth.uid(),
  supplier_id text references public.suppliers(id) on delete set null,
  supplier_name text not null,
  invoice_no text not null,
  invoice_date date,
  total numeric(14, 2) not null default 0,
  paid numeric(14, 2) not null default 0,
  status text not null default 'Unpaid',
  items jsonb not null default '[]'::jsonb,
  receipt_images jsonb not null default '[]'::jsonb,
  receipt_file_names jsonb not null default '[]'::jsonb,
  settlement_statement jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invoices_supplier_id_idx on public.invoices(supplier_id);
create index if not exists invoices_user_id_idx on public.invoices(user_id);
create index if not exists invoices_status_idx on public.invoices(status);
create index if not exists invoices_invoice_date_idx on public.invoices(invoice_date);

create table if not exists public.inventory (
  id text primary key,
  user_id uuid not null default auth.uid(),
  product text not null,
  latest_cost numeric(14, 4) not null default 0,
  invoice_date date,
  supplier_id text references public.suppliers(id) on delete set null,
  supplier_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inventory_product_idx on public.inventory(product);
create index if not exists inventory_user_id_idx on public.inventory(user_id);
create index if not exists inventory_supplier_id_idx on public.inventory(supplier_id);

create table if not exists public.app_state (
  id text primary key,
  user_id uuid not null default auth.uid(),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_state_user_id_idx on public.app_state(user_id);

alter table public.suppliers enable row level security;
alter table public.invoices enable row level security;
alter table public.inventory enable row level security;
alter table public.app_state enable row level security;
alter table public.profiles enable row level security;

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

create policy "phase1 read assigned suppliers" on public.suppliers for select to authenticated using (user_id = public.current_profile_owner_id());
create policy "phase1 insert assigned suppliers" on public.suppliers for insert to authenticated with check (user_id = public.current_profile_owner_id());
create policy "phase1 update assigned suppliers" on public.suppliers for update to authenticated using (user_id = public.current_profile_owner_id()) with check (user_id = public.current_profile_owner_id());
create policy "phase1 delete owner suppliers" on public.suppliers for delete to authenticated using (public.is_owner() and user_id = auth.uid());

create policy "phase1 read assigned invoices" on public.invoices for select to authenticated using (user_id = public.current_profile_owner_id());
create policy "phase1 insert assigned invoices" on public.invoices for insert to authenticated with check (user_id = public.current_profile_owner_id());
create policy "phase1 update assigned invoices" on public.invoices for update to authenticated using (user_id = public.current_profile_owner_id()) with check (user_id = public.current_profile_owner_id());
create policy "phase1 delete owner invoices" on public.invoices for delete to authenticated using (public.is_owner() and user_id = auth.uid());

create policy "phase1 read assigned inventory" on public.inventory for select to authenticated using (user_id = public.current_profile_owner_id());
create policy "phase1 insert assigned inventory" on public.inventory for insert to authenticated with check (user_id = public.current_profile_owner_id());
create policy "phase1 update assigned inventory" on public.inventory for update to authenticated using (user_id = public.current_profile_owner_id()) with check (user_id = public.current_profile_owner_id());
create policy "phase1 delete owner inventory" on public.inventory for delete to authenticated using (public.is_owner() and user_id = auth.uid());

create policy "phase1 owner read app_state" on public.app_state for select to authenticated using (public.is_owner() and user_id = auth.uid());
create policy "phase1 owner insert app_state" on public.app_state for insert to authenticated with check (public.is_owner() and user_id = auth.uid());
create policy "phase1 owner update app_state" on public.app_state for update to authenticated using (public.is_owner() and user_id = auth.uid()) with check (public.is_owner() and user_id = auth.uid());
create policy "phase1 owner delete app_state" on public.app_state for delete to authenticated using (public.is_owner() and user_id = auth.uid());
