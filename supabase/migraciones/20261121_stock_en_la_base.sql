-- ============================================================================
-- Parte 3 · Stock en la base (COD-01, parte de DAT-09) y código de prenda de 4 cifras
-- 21/11/2026. Se aplica igual en emma-prueba y en la base real.
--
-- Qué hace:
-- 1. El número de stock lo maneja la base: cada movimiento que entra suma o resta
--    en su fila de stock, en la misma operación (todo o nada, sin pisarse entre equipos).
-- 2. La app ya no puede escribir el número a mano: si manda una fila de stock con otro
--    número, la base se queda con el suyo. Una fila nueva arranca en 0 y la llenan sus movimientos.
-- 3. El stock nunca baja de 0 (CHECK). Si una venta deja una prenda en menos de 0
--    (se vendió algo que figuraba sin stock), la venta queda igual y la base suma sola un
--    movimiento "sin_stock" que la deja en 0: el stock sigue siendo la suma de sus movimientos.
-- 4. Código de prenda de 4 cifras (0001, 0002…): si dos filas quedan con el mismo, la base
--    le da el siguiente libre a la nueva y la marca para reimprimir la etiqueta.
--
-- Solo aplica a lo que hace la app (rol "authenticated"). Restaurar una copia (clave de
-- servicio o SQL Editor) carga los números tal cual, sin sumar dos veces.
-- ============================================================================

-- ---------- Número de stock de una fila ----------
create or replace function privado.stock_num(d jsonb)
 returns integer language sql immutable set search_path to 'public'
as $f$ select case when jsonb_typeof(d->'stock') = 'number' then floor((d->>'stock')::numeric)::int
                   when d->>'stock' ~ '^-?\d+$' then (d->>'stock')::int else 0 end $f$;
grant execute on function privado.stock_num(jsonb) to authenticated, service_role;

-- ---------- La fila de stock no acepta números de la app ----------
create or replace function privado.stock_proteger()
 returns trigger language plpgsql set search_path to 'public', 'privado'
as $f$
declare
  app boolean := coalesce(auth.role(), '') = 'authenticated';
  propio boolean := coalesce(current_setting('emma.stock_mov', true), '') = '1';
begin
  if propio or not app then return new; end if;
  if tg_op = 'INSERT' then
    new.datos := jsonb_set(coalesce(new.datos, '{}'::jsonb), '{stock}', '0'::jsonb);
    return new;
  end if;
  -- UPDATE: el número queda el de la base
  new.datos := jsonb_set(coalesce(new.datos, '{}'::jsonb), '{stock}', to_jsonb(privado.stock_num(old.datos)));
  -- Si lo único distinto era el número, no hay nada que cambiar
  if new.datos = old.datos and new.codigo is not distinct from old.codigo and new.borrado = old.borrado then
    return null;
  end if;
  return new;
end $f$;

-- ---------- Código de prenda de 4 cifras, sin repetir ----------
create sequence if not exists privado.codigo_prenda;
do $$ declare mx int; begin
  select coalesce(max(codigo::int), 0) into mx from public.stock where codigo ~ '^\d{4}$';
  if mx > 0 then perform setval('privado.codigo_prenda', mx); end if;
end $$;

create or replace function privado.stock_codigo()
 returns trigger language plpgsql security definer set search_path to 'public', 'privado'
as $f$
declare n int; viejo text;
begin
  if new.codigo !~ '^\d{4}$' or new.borrado then return new; end if;
  if tg_op = 'UPDATE' and new.codigo = old.codigo then return new; end if;
  if exists (select 1 from public.stock s where s.codigo = new.codigo and s.id <> new.id and not s.borrado) then
    viejo := new.codigo;
    loop
      n := nextval('privado.codigo_prenda');
      exit when not exists (select 1 from public.stock s where s.codigo = lpad(n::text, 4, '0') and not s.borrado);
    end loop;
    new.codigo := lpad(n::text, 4, '0');
    new.datos := coalesce(new.datos, '{}'::jsonb) || jsonb_build_object('codigo', new.codigo, 'codigoReasignado', viejo);
  else
    -- la secuencia queda siempre por delante del código más alto
    if new.codigo::int > coalesce((select last_value from privado.codigo_prenda), 0) then
      perform setval('privado.codigo_prenda', new.codigo::int);
    end if;
  end if;
  return new;
end $f$;

drop trigger if exists stock_proteger on public.stock;
create trigger stock_proteger before insert or update on public.stock for each row execute function privado.stock_proteger();
drop trigger if exists stock_codigo on public.stock;
create trigger stock_codigo before insert or update of codigo, borrado on public.stock for each row execute function privado.stock_codigo();

-- ---------- Cada movimiento mueve su stock, en la misma operación ----------
create or replace function privado.aplicar_movimiento()
 returns trigger language plpgsql security definer set search_path to 'public', 'privado'
as $f$
declare
  app boolean := coalesce(auth.role(), '') = 'authenticated' or coalesce(current_setting('emma.aplicar_stock', true), '') = '1';
  d_new int := 0; d_old int := 0; actual int; nuevo int;
begin
  if not app or coalesce(current_setting('emma.compensando', true), '') = '1' then return null; end if;
  if tg_op = 'UPDATE' and old.stock_id is not distinct from new.stock_id and old.cantidad = new.cantidad then return null; end if;
  if tg_op = 'UPDATE' and old.stock_id is not null then
    -- un movimiento corregido: primero se deshace lo que había hecho
    perform set_config('emma.stock_mov', '1', true);
    update public.stock set datos = jsonb_set(datos, '{stock}', to_jsonb(greatest(0, privado.stock_num(datos) - old.cantidad))) where id = old.stock_id;
    perform set_config('emma.stock_mov', '', true);
  end if;
  if new.stock_id is null or coalesce(new.cantidad, 0) = 0 then return null; end if;
  select privado.stock_num(datos) into actual from public.stock where id = new.stock_id for update;
  if not found then return null; end if;
  nuevo := actual + new.cantidad;
  perform set_config('emma.stock_mov', '1', true);
  update public.stock set datos = jsonb_set(datos, '{stock}', to_jsonb(greatest(0, nuevo))) where id = new.stock_id;
  perform set_config('emma.stock_mov', '', true);
  if nuevo < 0 then
    -- Se vendió algo que figuraba sin stock: la venta queda y se compensa hasta 0 (queda a la vista en el historial)
    perform set_config('emma.compensando', '1', true);
    insert into public.movimientos (id, stock_id, fecha, cantidad, motivo, ref)
      values (new.id || '-sin', new.stock_id, new.fecha, -nuevo, 'sin_stock', new.id)
      on conflict (id) do nothing;
    perform set_config('emma.compensando', '', true);
  end if;
  return null;
end $f$;

drop trigger if exists aplicar_movimiento on public.movimientos;
create trigger aplicar_movimiento after insert or update of cantidad, stock_id on public.movimientos
  for each row execute function privado.aplicar_movimiento();

-- ---------- Para usar desde la base (o desde una función) ----------
create or replace function public.mover_stock(p_stock text, p_cantidad int, p_motivo text, p_ref text default null)
 returns integer language plpgsql set search_path to 'public', 'privado'
as $f$
declare r int; mid text := 'm' || replace(gen_random_uuid()::text, '-', '');
begin
  if not privado.es_miembro() and coalesce(auth.role(), '') <> 'service_role' then raise exception 'sin permiso'; end if;
  perform set_config('emma.aplicar_stock', '1', true);
  insert into public.movimientos (id, stock_id, cantidad, motivo, ref) values (mid, p_stock, p_cantidad, p_motivo, p_ref);
  perform set_config('emma.aplicar_stock', '', true);
  select privado.stock_num(datos) into r from public.stock where id = p_stock;
  return r;
end $f$;
revoke all on function public.mover_stock(text, int, text, text) from public, anon;
grant execute on function public.mover_stock(text, int, text, text) to authenticated, service_role;

revoke all on function privado.stock_proteger(), privado.stock_codigo(), privado.aplicar_movimiento() from public, anon;

-- ---------- Nunca menos de 0 ----------
alter table public.stock drop constraint if exists stock_no_negativo;
alter table public.stock add constraint stock_no_negativo check (borrado or privado.stock_num(datos) >= 0);

-- ---------- Control: stock distinto de la suma de sus movimientos (desde el conteo) ----------
-- select s.id, s.codigo, privado.stock_num(s.datos) stock, coalesce(sum(m.cantidad), 0) movs
--   from stock s left join movimientos m on m.stock_id = s.id and m.fecha >= '<fecha del conteo>'
--   where not s.borrado group by s.id having privado.stock_num(s.datos) <> coalesce(sum(m.cantidad), 0);
