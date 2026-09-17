# Web Agregadores

Dashboard ejecutivo para consolidar la información que entregan los agregadores de delivery (Rappi, Pedidos Ya, Justo, Uber Eats, etc.): ventas, comisiones, facturación y pagos, hoy dispersos en planillas Excel de cada plataforma.

## Objetivo

1. **Importar** los Excel que entrega cada agregador y normalizarlos a un esquema común.
2. **Almacenar** esa data en una base de datos relacional (Supabase / Postgres) que quede como fuente única de verdad.
3. **Mostrar** un resumen ejecutivo por empresa/semana (lo que la plataforma dice depositar/facturar vs. lo que realmente llegó al banco y se facturó) para gerencia.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript + Tailwind CSS
- [Supabase](https://supabase.com) (Postgres) como base de datos
- [Vercel](https://vercel.com) para el despliegue (deploy automático al hacer push a GitHub)
- Importación de Excel vía `exceljs` (Node), normalizando cada planilla al esquema en `supabase/schema.sql`

## Estructura

```
src/app/                  # Páginas y rutas (App Router)
src/lib/supabase.ts       # Cliente de Supabase (browser/anon)
src/lib/supabase-admin.ts # Cliente de Supabase con service role (solo server-side)
supabase/schema.sql       # Esquema: platforms, companies, stores, imports, orders, weekly_summary
scripts/import-rappi.ts   # Importa el Excel semanal de Rappi (Consolidado Semanal + Resumen Cuadratura)
```

## Modelo de datos

- `companies`: empresas/razones sociales (ej. Administradora Arbal Ltda.)
- `stores`: locales, por plataforma (ej. tienda Rappi de un local)
- `orders`: detalle pedido a pedido (hoja "Consolidado Semanal" de Rappi), con el detalle completo en `raw` (jsonb)
- `weekly_summary`: resumen ejecutivo por empresa y semana (hoja "Resumen Cuadratura"): monto a depositar vs. banco recibido, monto a facturar vs. facturado XML, con las diferencias calculadas automáticamente

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # completar con tus credenciales de Supabase
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

## Importar un Excel de Rappi

```bash
npx tsx scripts/import-rappi.ts "ruta/al/SEM36_20260831_20260906_RAPPI....xlsx"
```

El nombre del archivo debe contener el período como `..._AAAAMMDD_AAAAMMDD_...` (el formato
que ya trae el Excel que entrega Rappi). El script lee las hojas "Consolidado Semanal" y
"Resumen Cuadratura", resuelve empresas/locales y hace upsert en Supabase — se puede correr
más de una vez con el mismo archivo sin duplicar datos.

## Variables de entorno

Ver `.env.example`. Se necesitan las credenciales del proyecto de Supabase (URL y anon key, más la service role key para los scripts de importación server-side).

## Estado

Repo conectado a GitHub y Supabase configurado con el esquema real (basado en un Excel de
Rappi de ejemplo). Próximos pasos: desplegar en Vercel, construir el dashboard que lea
`weekly_summary`, y agregar parsers para Pedidos Ya, Justo y Uber Eats.
