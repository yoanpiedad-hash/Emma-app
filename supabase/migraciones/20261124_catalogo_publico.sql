-- ============================================================================
-- Catálogo web (Paso 3) · lectura pública
-- 24/11/2026. Se prueba en emma-prueba; en la base real solo con ok de Yoan.
--
-- catalogo_publico(): la ÚNICA cosa que puede leer alguien de afuera (rol anon).
-- Devuelve:
--   { vivo: true/false,             -- hay un vivo en curso (misma regla que Mabel: un live de hoy, o de ayer antes de las 6; el registro "Ventas · mes" no cuenta)
--     linkVivo: '…',                 -- config.linkVivo (o null)
--     whatsapp: '…',                 -- config.negocio.whatsapp, o config.negocio.tel (o null: el catálogo usa el de negocio.js)
--     modelos: [{ num, nombre, categoria, precio, fotos: [rutas en el bucket prendas], talles: { talle: disponible } }] }
-- Solo modelos PUBLICADOS (web.pub), con número de modelo, activos, con fotos, con precio y con al menos una prenda con stock.
-- Nombre y precio: los "para la clienta" (web.nombre / web.precio) y si están vacíos, los del modelo.
-- No devuelve nada más: ni alias, costos, códigos de prenda, clientas, pedidos, pagos, cuentas ni el resto de config.
-- Las tablas siguen cerradas para anon (RLS con privado.es_miembro()).
-- ============================================================================
create or replace function public.catalogo_publico()
 returns jsonb language sql stable security definer set search_path to 'public', 'privado'
as $f$
  with ahora as (
    select (now() at time zone 'America/Montevideo') as t
  ), vivo as (
    select exists (
      select 1 from public.lives l, ahora
      where not l.borrado and coalesce(l.datos->>'tipo', '') <> 'ventas'
        and (l.datos->>'fecha' = to_char(ahora.t, 'YYYY-MM-DD')
             or (extract(hour from ahora.t) < 6 and l.datos->>'fecha' = to_char(ahora.t - interval '1 day', 'YYYY-MM-DD')))
    ) as v
  ), m as (
    select id, datos, datos->'web' as w,
      coalesce(nullif((datos->'web'->>'precio'), '')::numeric, 0) as pw,
      coalesce(nullif((datos->>'precioVenta'), '')::numeric, 0) as pv
    from public.modelos
    where not borrado
      and coalesce(nullif(datos->>'num', '')::numeric, 0) > 0   -- sin número no se puede pedir ("E" + número)
      and coalesce(datos->>'activo', 'true') <> 'false'
      and coalesce(datos->>'archivado', 'false') <> 'true'
      and coalesce(datos->'web'->>'pub', 'false') = 'true'
      and jsonb_typeof(datos->'web'->'fotos') = 'array' and jsonb_array_length(datos->'web'->'fotos') > 0
  ), t as (
    select s.datos->>'modeloId' as mid, s.datos->>'talle' as talle, sum(greatest(0, privado.stock_num(s.datos)))::int as q
    from public.stock s
    where not s.borrado and coalesce(s.datos->>'activo', 'true') <> 'false' and coalesce(s.datos->>'talle', '') <> ''
    group by 1, 2
  ), sel as (
    select m.*, case when m.pw > 0 then m.pw else m.pv end as precio from m
    where (m.pw > 0 or m.pv > 0) and exists (select 1 from t where t.mid = m.id and t.q > 0)
  )
  select jsonb_build_object(
    'vivo', (select v from vivo),
    'linkVivo', (select nullif(c.valor #>> '{}', '') from public.config c where c.clave = 'linkVivo'),
    'whatsapp', (select coalesce(nullif(c.valor->>'whatsapp', ''), nullif(c.valor->>'tel', '')) from public.config c where c.clave = 'negocio' and jsonb_typeof(c.valor) = 'object'),
    'modelos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'num', (sel.datos->>'num')::int,
        'nombre', coalesce(nullif(trim(sel.w->>'nombre'), ''), sel.datos->>'nombre', ''),
        'categoria', coalesce(nullif(sel.datos->>'categoria', ''), 'Otros'),
        'precio', sel.precio,
        'fotos', (select coalesce(jsonb_agg(f->>'p' order by i), '[]'::jsonb)
                  from jsonb_array_elements(sel.w->'fotos') with ordinality as x(f, i)
                  where coalesce(f->>'p', '') <> '' and f->>'p' !~ '\.\.'),
        'talles', (select jsonb_object_agg(t.talle, t.q) from t where t.mid = sel.id)
      ) order by coalesce(sel.w->>'publicado', '') desc, (sel.datos->>'num')::int desc)
      from sel), '[]'::jsonb)
  );
$f$;
revoke all on function public.catalogo_publico() from public;
grant execute on function public.catalogo_publico() to anon, authenticated;
