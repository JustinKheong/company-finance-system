alter table public.suppliers add column if not exists user_id uuid default auth.uid();
alter table public.invoices add column if not exists user_id uuid default auth.uid();
alter table public.inventory add column if not exists user_id uuid default auth.uid();
alter table public.app_state add column if not exists user_id uuid default auth.uid();

create index if not exists suppliers_user_id_idx on public.suppliers(user_id);
create index if not exists invoices_user_id_idx on public.invoices(user_id);
create index if not exists inventory_user_id_idx on public.inventory(user_id);
create index if not exists app_state_user_id_idx on public.app_state(user_id);

alter table public.suppliers enable row level security;
alter table public.invoices enable row level security;
alter table public.inventory enable row level security;
alter table public.app_state enable row level security;

drop policy if exists "anon read suppliers" on public.suppliers;
drop policy if exists "anon insert suppliers" on public.suppliers;
drop policy if exists "anon update suppliers" on public.suppliers;
drop policy if exists "anon delete suppliers" on public.suppliers;
drop policy if exists "users read own suppliers" on public.suppliers;
drop policy if exists "users insert own suppliers" on public.suppliers;
drop policy if exists "users update own suppliers" on public.suppliers;
drop policy if exists "users delete own suppliers" on public.suppliers;

drop policy if exists "anon read invoices" on public.invoices;
drop policy if exists "anon insert invoices" on public.invoices;
drop policy if exists "anon update invoices" on public.invoices;
drop policy if exists "anon delete invoices" on public.invoices;
drop policy if exists "users read own invoices" on public.invoices;
drop policy if exists "users insert own invoices" on public.invoices;
drop policy if exists "users update own invoices" on public.invoices;
drop policy if exists "users delete own invoices" on public.invoices;

drop policy if exists "anon read inventory" on public.inventory;
drop policy if exists "anon insert inventory" on public.inventory;
drop policy if exists "anon update inventory" on public.inventory;
drop policy if exists "anon delete inventory" on public.inventory;
drop policy if exists "users read own inventory" on public.inventory;
drop policy if exists "users insert own inventory" on public.inventory;
drop policy if exists "users update own inventory" on public.inventory;
drop policy if exists "users delete own inventory" on public.inventory;

drop policy if exists "anon read app_state" on public.app_state;
drop policy if exists "anon insert app_state" on public.app_state;
drop policy if exists "anon update app_state" on public.app_state;
drop policy if exists "anon delete app_state" on public.app_state;
drop policy if exists "users read own app_state" on public.app_state;
drop policy if exists "users insert own app_state" on public.app_state;
drop policy if exists "users update own app_state" on public.app_state;
drop policy if exists "users delete own app_state" on public.app_state;

create policy "users read own suppliers" on public.suppliers for select to authenticated using (user_id = auth.uid());
create policy "users insert own suppliers" on public.suppliers for insert to authenticated with check (user_id = auth.uid());
create policy "users update own suppliers" on public.suppliers for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users delete own suppliers" on public.suppliers for delete to authenticated using (user_id = auth.uid());

create policy "users read own invoices" on public.invoices for select to authenticated using (user_id = auth.uid());
create policy "users insert own invoices" on public.invoices for insert to authenticated with check (user_id = auth.uid());
create policy "users update own invoices" on public.invoices for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users delete own invoices" on public.invoices for delete to authenticated using (user_id = auth.uid());

create policy "users read own inventory" on public.inventory for select to authenticated using (user_id = auth.uid());
create policy "users insert own inventory" on public.inventory for insert to authenticated with check (user_id = auth.uid());
create policy "users update own inventory" on public.inventory for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users delete own inventory" on public.inventory for delete to authenticated using (user_id = auth.uid());

create policy "users read own app_state" on public.app_state for select to authenticated using (user_id = auth.uid());
create policy "users insert own app_state" on public.app_state for insert to authenticated with check (user_id = auth.uid());
create policy "users update own app_state" on public.app_state for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users delete own app_state" on public.app_state for delete to authenticated using (user_id = auth.uid());
