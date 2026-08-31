create table if not exists public.products (
  internal_product_id text primary key,
  user_id uuid not null default public.current_profile_owner_id(),
  internal_sku text not null,
  standard_name text not null,
  brand text,
  size text,
  pack_size text,
  barcode text,
  supplier_product_code text,
  supplier_id text references public.suppliers(id) on delete set null,
  supplier_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists products_user_internal_sku_idx on public.products(user_id, internal_sku);
create unique index if not exists products_user_supplier_identity_idx
  on public.products(user_id, (coalesce(supplier_id, '')), (lower(coalesce(standard_name, ''))), (lower(coalesce(brand, ''))), (lower(coalesce(size, ''))));
create index if not exists products_user_id_idx on public.products(user_id);
create index if not exists products_barcode_idx on public.products(barcode);

create table if not exists public.product_channel_mappings (
  id text primary key,
  user_id uuid not null default public.current_profile_owner_id(),
  internal_product_id text references public.products(internal_product_id) on delete cascade,
  channel text not null,
  channel_product_id text,
  channel_variant_id text,
  channel_sku text,
  barcode text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists product_channel_mappings_unique_idx
  on public.product_channel_mappings(user_id, internal_product_id, channel, (coalesce(channel_variant_id, '')), (coalesce(channel_sku, '')), (coalesce(barcode, '')));
create index if not exists product_channel_mappings_user_id_idx on public.product_channel_mappings(user_id);

create table if not exists public.supplier_product_mappings (
  id text primary key,
  user_id uuid not null default public.current_profile_owner_id(),
  normalized_invoice_product_name text not null,
  supplier_id text references public.suppliers(id) on delete set null,
  supplier_product_code text,
  internal_product_id text references public.products(internal_product_id) on delete cascade,
  internal_sku text not null,
  loyverse_item_id text,
  loyverse_variant_id text,
  loyverse_sku text,
  bigseller_sku text,
  woocommerce_sku text,
  barcode text,
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists supplier_product_mappings_unique_idx
  on public.supplier_product_mappings(user_id, (coalesce(supplier_id, '')), normalized_invoice_product_name, (coalesce(supplier_product_code, '')));
create index if not exists supplier_product_mappings_user_id_idx on public.supplier_product_mappings(user_id);

create table if not exists public.product_cost_history (
  id text primary key,
  user_id uuid not null default public.current_profile_owner_id(),
  internal_product_id text references public.products(internal_product_id) on delete cascade,
  supplier_id text references public.suppliers(id) on delete set null,
  supplier_name text,
  invoice_id text references public.invoices(id) on delete set null,
  invoice_number text,
  invoice_date date,
  original_product_name text,
  brand text,
  standard_name text,
  size text,
  pack_size text,
  barcode text,
  supplier_product_code text,
  line_total_cost numeric(14, 4) not null default 0,
  quantity numeric(14, 4) not null default 0,
  unit_cost numeric(14, 4) not null default 0,
  currency text not null default 'MYR',
  receipt_images jsonb not null default '[]'::jsonb,
  uploaded_by uuid references auth.users(id) on delete set null,
  confirmed_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists product_cost_history_product_idx on public.product_cost_history(internal_product_id);
create index if not exists product_cost_history_user_id_idx on public.product_cost_history(user_id);
create index if not exists product_cost_history_invoice_date_idx on public.product_cost_history(invoice_date);

create table if not exists public.mock_loyverse_catalog (
  id text primary key,
  user_id uuid not null default public.current_profile_owner_id(),
  mock_loyverse_item_id text not null,
  mock_loyverse_variant_id text not null,
  product_name text not null,
  sku text,
  barcode text,
  supplier text,
  status text not null default 'mock_catalog',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists mock_loyverse_catalog_mock_ids_idx
  on public.mock_loyverse_catalog(user_id, mock_loyverse_item_id, mock_loyverse_variant_id);
create index if not exists mock_loyverse_catalog_user_id_idx on public.mock_loyverse_catalog(user_id);

create table if not exists public.product_match_reviews (
  id text primary key,
  user_id uuid not null default public.current_profile_owner_id(),
  invoice_id text references public.invoices(id) on delete set null,
  invoice_number text,
  invoice_date date,
  supplier_id text references public.suppliers(id) on delete set null,
  supplier_name text,
  review_status text not null default 'pending_owner_review',
  original_product_name text,
  brand text,
  standard_name text,
  size text,
  pack_size text,
  barcode text,
  supplier_product_code text,
  quantity numeric(14, 4) not null default 0,
  line_total_cost numeric(14, 4) not null default 0,
  unit_cost numeric(14, 4) not null default 0,
  currency text not null default 'MYR',
  internal_product_id text references public.products(internal_product_id) on delete set null,
  internal_sku text,
  selected_candidate_id text,
  match_score numeric(6, 2),
  match_reason text,
  generated_product_name text,
  loyverse_item_id text,
  loyverse_variant_id text,
  loyverse_sku text,
  bigseller_sku text,
  woocommerce_sku text,
  is_new_loyverse_product boolean not null default false,
  submitted_by uuid references auth.users(id) on delete set null,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  mock_sync_status text,
  mock_sync_response jsonb,
  error_message text,
  candidates jsonb not null default '[]'::jsonb,
  receipt_images jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_match_reviews_user_id_idx on public.product_match_reviews(user_id);
create index if not exists product_match_reviews_status_idx on public.product_match_reviews(review_status);
create index if not exists product_match_reviews_invoice_idx on public.product_match_reviews(invoice_id);

alter table public.product_match_reviews add column if not exists invoice_date date;
alter table public.product_match_reviews add column if not exists candidates jsonb not null default '[]'::jsonb;
alter table public.product_match_reviews add column if not exists receipt_images jsonb not null default '[]'::jsonb;
alter table public.mock_loyverse_catalog add column if not exists status text not null default 'mock_catalog';

create table if not exists public.channel_sync_logs (
  id text primary key,
  user_id uuid not null default public.current_profile_owner_id(),
  internal_product_id text references public.products(internal_product_id) on delete set null,
  review_id text references public.product_match_reviews(id) on delete set null,
  channel text not null,
  sync_status text not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  old_value jsonb,
  new_value jsonb,
  api_response jsonb,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists channel_sync_logs_user_id_idx on public.channel_sync_logs(user_id);
create index if not exists channel_sync_logs_product_idx on public.channel_sync_logs(internal_product_id);

alter table public.products enable row level security;
alter table public.product_channel_mappings enable row level security;
alter table public.supplier_product_mappings enable row level security;
alter table public.product_cost_history enable row level security;
alter table public.mock_loyverse_catalog enable row level security;
alter table public.product_match_reviews enable row level security;
alter table public.channel_sync_logs enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'products',
    'product_channel_mappings',
    'supplier_product_mappings',
    'product_cost_history',
    'mock_loyverse_catalog',
    'product_match_reviews',
    'channel_sync_logs'
  ]
  loop
    execute format('drop policy if exists "phase2 read assigned %1$s" on public.%1$I', table_name);
    execute format('drop policy if exists "phase2 insert assigned %1$s" on public.%1$I', table_name);
    execute format('drop policy if exists "phase2 update assigned %1$s" on public.%1$I', table_name);
    execute format('drop policy if exists "phase2 delete owner %1$s" on public.%1$I', table_name);

    execute format('create policy "phase2 read assigned %1$s" on public.%1$I for select to authenticated using (user_id = public.current_profile_owner_id())', table_name);
    execute format('create policy "phase2 insert assigned %1$s" on public.%1$I for insert to authenticated with check (user_id = public.current_profile_owner_id())', table_name);
    execute format('create policy "phase2 update assigned %1$s" on public.%1$I for update to authenticated using (user_id = public.current_profile_owner_id()) with check (user_id = public.current_profile_owner_id())', table_name);
    execute format('create policy "phase2 delete owner %1$s" on public.%1$I for delete to authenticated using (public.is_owner() and user_id = auth.uid())', table_name);
  end loop;
end $$;
