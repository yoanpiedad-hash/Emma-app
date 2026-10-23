# Emma App

Emma Pedidos y Emma Gestión — Emma Indumentaria.

## Cómo se arma index.html
1. `python3 herramientas/generar-index.py emma-pedidos.html index.html` (modo nube, desde `claude/emma-pedidos.html` del proyecto)
2. `python3 herramientas/agregar-despacho.py index.html` (pestaña Despacho, paquetes y pagos)
3. `python3 herramientas/agregar-pagos.py index.html` (pestaña Pagos y orden de pestañas)
4. `python3 herramientas/agregar-escaner.py index.html` (cámara y etiquetas QR)
5. `python3 herramientas/agregar-etiquetas.py index.html` (etiqueta al cargar prenda, versión y recarga automática)
6. `python3 herramientas/agregar-live.py index.html` (Live simple y etiqueta general)

`nube.js` sincroniza con Supabase; `despacho.js` es la pestaña Despacho (reemplaza a Salidas); `pagos.js` es la pestaña Pagos; `escaner.js` la cámara y las etiquetas QR.
