create table if not exists public.suppliers (
  id text primary key,
  name text not null,
  normalized_name text not null,
  phone text,
  email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id text primary key,
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
create index if not exists invoices_status_idx on public.invoices(status);
create index if not exists invoices_invoice_date_idx on public.invoices(invoice_date);

create table if not exists public.inventory (
  id text primary key,
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
create index if not exists inventory_supplier_id_idx on public.inventory(supplier_id);

create table if not exists public.app_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.suppliers enable row level security;
alter table public.invoices enable row level security;
alter table public.inventory enable row level security;
alter table public.app_state enable row level security;

create policy "anon read suppliers" on public.suppliers for select to anon using (true);
create policy "anon insert suppliers" on public.suppliers for insert to anon with check (true);
create policy "anon update suppliers" on public.suppliers for update to anon using (true) with check (true);
create policy "anon delete suppliers" on public.suppliers for delete to anon using (true);

create policy "anon read invoices" on public.invoices for select to anon using (true);
create policy "anon insert invoices" on public.invoices for insert to anon with check (true);
create policy "anon update invoices" on public.invoices for update to anon using (true) with check (true);
create policy "anon delete invoices" on public.invoices for delete to anon using (true);

create policy "anon read inventory" on public.inventory for select to anon using (true);
create policy "anon insert inventory" on public.inventory for insert to anon with check (true);
create policy "anon update inventory" on public.inventory for update to anon using (true) with check (true);
create policy "anon delete inventory" on public.inventory for delete to anon using (true);

create policy "anon read app_state" on public.app_state for select to anon using (true);
create policy "anon insert app_state" on public.app_state for insert to anon with check (true);
create policy "anon update app_state" on public.app_state for update to anon using (true) with check (true);
create policy "anon delete app_state" on public.app_state for delete to anon using (true);
