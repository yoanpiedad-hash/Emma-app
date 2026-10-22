# Emma App

Emma Pedidos y Emma Gestión — Emma Indumentaria.

## Cómo se arma index.html
1. `python3 herramientas/generar-index.py emma-pedidos.html index.html` (modo nube, desde `claude/emma-pedidos.html` del proyecto)
2. `python3 herramientas/agregar-despacho.py index.html` (pestaña Despacho, paquetes y pagos)
3. `python3 herramientas/agregar-pagos.py index.html` (pestaña Pagos y orden de pestañas)

`nube.js` sincroniza con Supabase; `despacho.js` es la pestaña Despacho (reemplaza a Salidas); `pagos.js` es la pestaña Pagos.
