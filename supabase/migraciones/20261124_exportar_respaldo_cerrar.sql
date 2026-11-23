-- 24/11/2026 · Seguridad: exportar_respaldo() sin la clave cargada quedaba ABIERTA.
-- La comparación `clave <> (select valor …)` da NULL si no existe el secreto 'drive' en privado.secretos,
-- y NULL no entra al "raise": cualquiera con la clave pública de la app se llevaba la copia completa
-- (clientas, pedidos, pagos…). Pasó en emma-prueba (no tiene el secreto 'drive').
-- Arreglo: si el secreto no existe o no coincide, se rechaza siempre. Lo demás queda igual.
create or replace function public.exportar_respaldo(clave text)
 returns jsonb language plpgsql security definer set search_path to 'public', 'privado'
as $function$
declare d jsonb; s text;
begin
  select valor into s from privado.secretos where nombre = 'drive';
  if s is null or s = '' or clave is null or clave is distinct from s then
    raise exception 'clave incorrecta';
  end if;
  select datos into d from privado.respaldos order by fecha desc limit 1;
  if d is null or (d->>'fecha')::timestamptz < now() - interval '20 hours' then d := privado.armar_respaldo(); end if;
  return d;
end $function$;
