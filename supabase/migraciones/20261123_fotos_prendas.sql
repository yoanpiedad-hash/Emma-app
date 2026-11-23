-- Fotos de prendas (Paso 1 del catálogo web).
-- Bucket PÚBLICO solo para fotos de prendas: cualquiera con el link puede verlas (las va a mostrar el catálogo).
-- Subir, cambiar y borrar: solo usuarias de la tienda (privado.es_miembro()).
-- Nada privado va en este bucket.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('prendas', 'prendas', true, 5242880, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists prendas_leer on storage.objects;
drop policy if exists prendas_subir on storage.objects;
drop policy if exists prendas_cambiar on storage.objects;
drop policy if exists prendas_borrar on storage.objects;

create policy prendas_leer on storage.objects for select to authenticated
  using (bucket_id = 'prendas' and privado.es_miembro());
create policy prendas_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'prendas' and privado.es_miembro());
create policy prendas_cambiar on storage.objects for update to authenticated
  using (bucket_id = 'prendas' and privado.es_miembro())
  with check (bucket_id = 'prendas' and privado.es_miembro());
create policy prendas_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'prendas' and privado.es_miembro());
