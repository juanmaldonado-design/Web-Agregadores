# Scripts de importación

Acá irán los scripts que toman el Excel que entrega cada agregador (Rappi, Pedidos
Ya, Justo, Uber Eats) y lo normalizan al esquema de `supabase/schema.sql`.

Cada agregador tiene su propio formato de columnas, así que el plan es un
parser por plataforma (`import-rappi.ts`, `import-pedidosya.ts`, ...) que
comparta una función común de inserción en Supabase.

Pendiente: definir las columnas exactas de cada Excel para escribir los
parsers.
