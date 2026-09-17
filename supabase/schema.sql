-- Esquema del dashboard ejecutivo de agregadores de delivery.
-- Reemplaza el borrador inicial: ahora refleja la estructura real encontrada en los
-- Excel de conciliación (ej. Rappi "Consolidado Semanal" + "Resumen Cuadratura").
--
-- Si ya corriste el schema.sql anterior (que creaba una tabla "settlements"),
-- este script la reemplaza por "weekly_summary". Es seguro volver a correr todo.

create table if not exists platforms (
  id serial primary key,
  slug text unique not null,        -- 'rappi' | 'pedidosya' | 'justo' | 'ubereats' | ...
  name text not null
);

insert into platforms (slug, name) values
  ('rappi', 'Rappi'),
  ('pedidosya', 'Pedidos Ya'),
  ('justo', 'Justo'),
  ('ubereats', 'Uber Eats')
on conflict (slug) do nothing;

-- Empresas (razones sociales) que operan los locales, ej. "ADMINISTRADORA ARBAL LTDA."
create table if not exists companies (
  id serial primary key,
  name text unique not null,
  rut text unique
);

insert into companies (name, rut) values
  ('ADMINISTRADORA ARBAL LTDA.', '77686950-3'),
  ('AVICOLA MONTSERRAT LTDA.', '81256700-4'),
  ('COMERCIAL JUAN BATLLE LTDA.', '83037300-4'),
  ('COMERCIAL TARRAGONA S.A.', '89505200-0'),
  ('DISTRIBUIDORA MONTSERRAT LTDA.', '84128600-6')
on conflict (name) do nothing;

-- Locales/tiendas, identificados por el ID que les da cada plataforma.
create table if not exists stores (
  id uuid primary key default gen_random_uuid(),
  platform_id integer not null references platforms(id),
  company_id integer references companies(id),
  external_store_id text not null,   -- 'ID de la tienda' en Rappi
  name text not null,                -- 'Nombre de la tienda'
  local_name text,                   -- 'Local'
  cost_center text,                  -- 'Cc'
  unique (platform_id, external_store_id)
);

-- Cada carga de Excel/semana queda registrada acá para trazabilidad.
create table if not exists imports (
  id uuid primary key default gen_random_uuid(),
  platform_id integer not null references platforms(id),
  file_name text not null,
  period_start date,
  period_end date,
  imported_at timestamptz not null default now(),
  imported_by text
);

-- Detalle pedido a pedido (hoja "Consolidado Semanal" en Rappi).
-- Se guardan las columnas clave normalizadas + el resto en "raw" para no perder nada.
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  import_id uuid references imports(id) on delete cascade,
  platform_id integer not null references platforms(id),
  company_id integer references companies(id),
  store_id uuid references stores(id),
  external_order_id text not null,    -- 'ID de la órden'
  paidlot_id text,                    -- 'ID del paidlot'
  order_created_at timestamptz,
  transaction_type text,              -- 'ORDEN' | 'COMPENSACIÓN' | 'EXTRA SERVICE'
  order_status text,                  -- 'Estado de la órden'
  gross_sales numeric(14, 2) not null default 0,     -- 'Venta Bruta'
  platform_fee numeric(14, 2) not null default 0,    -- 'Uso y alquiler de plataforma Rappi'
  platform_fee_tax numeric(14, 2) not null default 0, -- 'IVA Uso y alquiler de plataforma Rappi'
  manual_adjustment numeric(14, 2) not null default 0, -- 'Valor Ajustes Manuales'
  net_amount numeric(14, 2) not null default 0,       -- 'Valor Neto'
  raw jsonb,                          -- fila completa original, tal cual el Excel
  created_at timestamptz not null default now(),
  unique (platform_id, external_order_id)
);

create index if not exists orders_company_period_idx
  on orders (company_id, order_created_at);

create index if not exists orders_import_idx
  on orders (import_id);

-- Resumen ejecutivo por empresa y semana (hoja "Resumen Cuadratura" en Rappi):
-- compara lo que la plataforma dice depositar/facturar contra lo que realmente
-- llegó al banco y se facturó.
create table if not exists weekly_summary (
  id uuid primary key default gen_random_uuid(),
  import_id uuid references imports(id) on delete cascade,
  platform_id integer not null references platforms(id),
  company_id integer not null references companies(id),
  period_start date not null,
  period_end date not null,
  tipo_local text,                    -- 'Tipo Local'
  estado text,                        -- 'Estado' (ej. '✅ OK', '⚠️ Revisar')
  monto_a_depositar numeric(14, 2) not null default 0,  -- 'Rappi a Depositar'
  banco_recibido numeric(14, 2) not null default 0,     -- 'Banco Recibido'
  monto_a_facturar_neto numeric(14, 2) not null default 0, -- 'Rappi a Facturar (Neto)'
  facturado_xml_neto numeric(14, 2) not null default 0,    -- 'Facturado XML (Neto)'
  fecha_pago date,                    -- 'Fecha de Pago'
  dif_banco numeric(14, 2) generated always as (monto_a_depositar - banco_recibido) stored,
  dif_factura numeric(14, 2) generated always as (monto_a_facturar_neto - facturado_xml_neto) stored,
  created_at timestamptz not null default now(),
  -- una empresa puede tener más de una fila por semana (ej. CJB separa
  -- "Solo Local" de "FQ / ELE"), por eso tipo_local es parte de la clave.
  unique (platform_id, company_id, period_start, period_end, tipo_local)
);

create index if not exists weekly_summary_period_idx
  on weekly_summary (period_start, period_end);

-- Limpieza: si ya habías corrido el schema anterior, elimina la tabla vieja.
drop table if exists settlements;
