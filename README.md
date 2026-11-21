# Emma App

Emma Pedidos (`index.html`) y Emma Gestión (`gestion.html`) — Emma Indumentaria. Mabel (agente de WhatsApp) en `supabase/functions/whatsapp-webhook/`.

Las reglas de trabajo y publicación están en `CLAUDE.md`.

## Archivos
- `index.html` y `gestion.html`: se editan directo.
- `negocio.js`: datos del negocio (nombre, teléfono, RUT, tarifas, cuentas, horarios, barrios). Lo que se guarde en ⚙️ Config gana.
- `nube.js`: sincroniza con Supabase. `despacho.js`: pestaña Despacho. `pagos.js`: control de pagos del día. `escaner.js`: cámara y QR. `etiquetas.js`, `live.js`, `promos.js`, `pedidos4.js`, `mabel.js`, `mabeltab.js`: el resto de Pedidos.

## Versión
`version.js` (`EMMA_VERSION`) la muestran Pedidos y Gestión. En cada publicación: cambiarla y subir `CACHE` en `sw.js`.

## Pruebas
- `node herramientas/prueba-promos.js` (cálculo del pedido).
- `herramientas/prueba-*.py` corren con Playwright **contra la base real**: no usarlas sin ok (ver `CLAUDE.md`).
