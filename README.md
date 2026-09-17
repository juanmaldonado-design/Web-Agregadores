# Web Agregadores

Dashboard ejecutivo para consolidar la información que entregan los agregadores de delivery (Rappi, Pedidos Ya, Justo, Uber Eats, etc.): ventas, comisiones, facturación y pagos, hoy dispersos en planillas Excel de cada plataforma.

## Objetivo

1. **Importar** los Excel que entrega cada agregador y normalizarlos a un esquema común.
2. **Almacenar** esa data en una base de datos relacional (Supabase / Postgres) que quede como fuente única de verdad.
3. **Mostrar** un resumen ejecutivo (ventas, comisiones, neto a pagar, por plataforma y período) para gerencia.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript + Tailwind CSS
- [Supabase](https://supabase.com) (Postgres) como base de datos
- Importación de Excel vía `xlsx` (Node), normalizando cada planilla al esquema en `supabase/schema.sql`

## Estructura

```
src/app/            # Páginas y rutas (App Router)
src/lib/supabase.ts # Cliente de Supabase
supabase/schema.sql # Esquema de base de datos (plataformas, liquidaciones, pagos)
scripts/            # Scripts de importación de Excel -> Supabase
```

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # completar con tus credenciales de Supabase
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

## Variables de entorno

Ver `.env.example`. Se necesitan las credenciales del proyecto de Supabase (URL y anon key, más la service role key para los scripts de importación server-side).

## Estado

Proyecto en configuración inicial: scaffolding del entorno + conexión a GitHub. Próximos pasos: definir el esquema exacto según las columnas de cada Excel (Rappi/Pedidos Ya/Justo/Uber Eats) y construir el flujo de carga + dashboard.
