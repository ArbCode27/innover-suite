-- =============================================================================
-- Innover Suite — Solicitudes de Ingreso con Comprobante de Pago
-- Ejecutar en el SQL Editor de Supabase
-- =============================================================================

-- 1. Tabla de Solicitudes de Ingreso
create table if not exists public.organization_join_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text not null,
  organization_name text not null,
  business_template text not null check (business_template in ('restaurant', 'ventas', 'realestate')),
  plan_id text not null references public.plans(id),
  payment_method text not null check (payment_method in ('pagomovil', 'transferencia', 'binance', 'zelle')),
  payment_reference text not null,
  receipt_url text not null,
  receipt_storage_path text not null,
  amount_usd numeric(10, 2) not null,
  customer_notes text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_notes text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_organization_id bigint references public.organizations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índices de consulta frecuente
create index if not exists org_join_requests_status_idx
  on public.organization_join_requests(status);

create index if not exists org_join_requests_user_idx
  on public.organization_join_requests(user_id);

create index if not exists org_join_requests_created_at_idx
  on public.organization_join_requests(created_at desc);

-- 2. Bucket de Storage para Comprobantes
insert into storage.buckets (id, name, public)
values ('payment-receipts', 'payment-receipts', true)
on conflict (id) do update set public = true;

-- 3. Row Level Security
alter table public.organization_join_requests enable row level security;

drop policy if exists join_requests_select_own on public.organization_join_requests;
create policy join_requests_select_own
  on public.organization_join_requests for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists join_requests_insert_own on public.organization_join_requests;
create policy join_requests_insert_own
  on public.organization_join_requests for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists join_requests_update_own on public.organization_join_requests;
create policy join_requests_update_own
  on public.organization_join_requests for update
  to authenticated
  using (user_id = auth.uid() and status = 'rejected')
  with check (user_id = auth.uid());

-- Políticas de Storage para comprobantes
drop policy if exists "Receipts public read" on storage.objects;
create policy "Receipts public read"
  on storage.objects for select
  to public
  using (bucket_id = 'payment-receipts');

drop policy if exists "Receipts authenticated upload" on storage.objects;
create policy "Receipts authenticated upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'payment-receipts');

comment on table public.organization_join_requests is 'Solicitudes de ingreso a la plataforma con comprobante de pago manual (Pago Móvil, Zelle, Binance, Transferencia).';
