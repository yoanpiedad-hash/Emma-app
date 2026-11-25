-- ============================================================================
-- 25/11/2026 · Chat de la pestaña Mabel: el equipo ve las fotos y PDF que mandan las clientas.
-- El bucket `comprobantes` lo escribe solo Mabel (clave de servicio). Hasta ahora nadie con sesión podía leerlo.
-- Lectura para miembros del equipo, igual que `prendas_leer`. La app pide links firmados de 1 h (createSignedUrl).
-- No agrega subir, cambiar ni borrar: eso sigue siendo solo de Mabel.
-- ============================================================================
drop policy if exists comprobantes_leer on storage.objects;
create policy comprobantes_leer on storage.objects for select to authenticated
  using (bucket_id = 'comprobantes' and privado.es_miembro());
