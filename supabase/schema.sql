-- Esquema inicial (borrador) para el resumen ejecutivo de agregadores de delivery.
-- Ajustar los campos de "settlements" una vez que tengamos las columnas exactas
-- de cada Excel (Rappi, Pedidos Ya, Justo, Uber Eats, ...).

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

-- Cada carga de Excel queda registrada acá para trazabilidad.
create table if not exists imports (
  id uuid primary key default gen_random_uuid(),
  platform_id integer not null references platforms(id),
  file_name text not null,
  period_start date,
  period_end date,
  imported_at timestamptz not null default now(),
  imported_by text
);

-- Liquidación/resumen por período y plataforma (lo que se muestra en el dashboard).
create table if not exists settlements (
  id uuid primary key default gen_random_uuid(),
  import_id uuid references imports(id) on delete cascade,
  platform_id integer not null references platforms(id),
  period_start date not null,
  period_end date not null,
  gross_sales numeric(14, 2) not null default 0,   -- ventas brutas
  commission numeric(14, 2) not null default 0,    -- comisión cobrada por el agregador
  taxes numeric(14, 2) not null default 0,         -- impuestos/retenciones
  other_adjustments numeric(14, 2) not null default 0,
  net_payout numeric(14, 2) not null default 0,    -- monto neto pagado
  raw jsonb,                                       -- fila original del Excel, por si se necesita auditar
  created_at timestamptz not null default now()
);

create index if not exists settlements_platform_period_idx
  on settlements (platform_id, period_start, period_end);
