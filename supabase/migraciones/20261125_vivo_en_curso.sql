-- ============================================================================
-- 25/11/2026 · Vivo en curso por botón: el catálogo se pausa solo cuando el botón 🔴 de la pestaña Live está prendido
-- (config.vivoEnCurso = {desde, hasta}), igual que Mabel. Antes contaba cualquier live con la fecha de hoy.
-- Requiere 20261124_catalogo_publico.sql aplicada. Solo cambia la parte "vivo" de catalogo_publico(); lo demás queda igual.
-- ============================================================================
create or replace function public.catalogo_publico()
 returns jsonb language sql stable security definer set search_path to 'public', 'privado'
as $f$
  with ahora as (
    select (now() at time zone 'America/Montevideo') as t
  ), vivo as (
    -- 25/11: misma regla que Mabel (vivo.ts): el botón 🔴 Vivo en curso de la app (config.vivoEnCurso), hasta su hora de apagado (6 h)
    select coalesce((
      select now() < coalesce(nullif(c.valor->>'hasta', '')::timestamptz, (c.valor->>'desde')::timestamptz + interval '6 hours')
      from public.config c
      where c.clave = 'vivoEnCurso' and jsonb_typeof(c.valor) = 'object' and nullif(c.valor->>'desde', '') is not null
    ), false) as v
  ), m as (
    select id, datos, datos->'web' as w,
      case when coalesce(nullif(datos->>'num', '')::numeric, 0) > 0 then (datos->>'num')::numeric::int::text
           else trim(coalesce(datos->'alias'->>0, '')) end as codigo,
      coalesce(nullif((datos->'web'->>'precio'), '')::numeric, 0) as pw,
      coalesce(nullif((datos->>'precioVenta'), '')::numeric, 0) as pv
    from public.modelos
    where not borrado
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
    where m.codigo ~ '^[A-Za-z0-9]+$'   -- sin código (o con espacios) no se puede pedir por mensaje
      and (m.pw > 0 or m.pv > 0) and exists (select 1 from t where t.mid = m.id and t.q > 0)
  )
  select jsonb_build_object(
    'vivo', (select v from vivo),
    'linkVivo', (select nullif(c.valor #>> '{}', '') from public.config c where c.clave = 'linkVivo'),
    'whatsapp', (select coalesce(nullif(c.valor->>'whatsapp', ''), nullif(c.valor->>'tel', '')) from public.config c where c.clave = 'negocio' and jsonb_typeof(c.valor) = 'object'),
    'modelos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'codigo', sel.codigo,
        'nombre', coalesce(nullif(trim(sel.w->>'nombre'), ''), sel.datos->>'nombre', ''),
        'categoria', coalesce(nullif(sel.datos->>'categoria', ''), 'Otros'),
        'precio', sel.precio,
        'fotos', (select coalesce(jsonb_agg(f->>'p' order by i), '[]'::jsonb)
                  from jsonb_array_elements(sel.w->'fotos') with ordinality as x(f, i)
                  where coalesce(f->>'p', '') <> '' and f->>'p' !~ '\.\.'),
        'talles', (select jsonb_object_agg(t.talle, t.q) from t where t.mid = sel.id)
      ) order by coalesce(sel.w->>'publicado', '') desc, sel.codigo)
      from sel), '[]'::jsonb)
  );
$f$;
revoke all on function public.catalogo_publico() from public;
grant execute on function public.catalogo_publico() to anon, authenticated;
