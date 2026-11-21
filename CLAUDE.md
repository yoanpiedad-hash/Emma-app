# CLAUDE.md · Emma App

App de Emma Indumentaria (ropa femenina, Uruguay, vende por TikTok Live): **Emma Pedidos** (`index.html`), **Emma Gestión** (`gestion.html`) y **Mabel**, el agente de WhatsApp (`supabase/functions/whatsapp-webhook/`).

## Con quién trabajás
- Yoan maneja todo y **no es técnico**. Respuestas cortas, en español rioplatense, sin explicaciones técnicas: qué hiciste y qué tiene que hacer él. Términos en inglés, con su explicación en español entre paréntesis.
- El plan vigente está en el Project de claude.ai: `claude/auditoria/10-plan-ajustado.md` (orden de trabajo) y `claude/auditoria/09-plan.md` (detalle de cada hallazgo, con IDs como COD-10, REV-02). Pendientes del día: `claude/emma-pendientes-*.md`. **Una parte por vez.**
- Antes de borrar algo que no está en el plan, o de cualquier cambio que toque plata, preguntale a Yoan.

## Reglas que no se rompen
1. **El repo es público.** Nunca claves, cuentas bancarias, números de cuenta, datos de clientas ni contraseñas. Las claves viven en Supabase (secretos y tabla `mabel_ajustes`).
2. **No tocar la base de producción** (Supabase `ssipaovluukkypsbzboe`) sin un ok explícito de Yoan para ese cambio: ni SQL, ni migraciones, ni publicar funciones. Todavía **no hay base de prueba** (COD-09, Parte 2 del plan).
3. **No publicar con un vivo corriendo.** Los vivos duran 3-4 h y terminan cerca de las 22 (alguno a las 23). Si no sabés si hay vivo, preguntá antes de publicar.
4. Los scripts `herramientas/prueba-*.py` y `ensayo-completo.py` corren **contra la base real**: no correrlos sin ok de Yoan (y algunos quedaron desactualizados).

## Cómo se publica la app
La app es estática y la sirve **GitHub Pages desde `main`**: publicar = merge a `main` + push.
En cada publicación:
1. Cambiar el texto de `version.js` (`EMMA_VERSION`: fecha y qué cambió). Se ve en Config de Pedidos y Gestión.
2. Subir el número de `CACHE` en `sw.js` (`emma-app-vNN`). Si se agrega un archivo, sumarlo a `ARCHIVOS` en `sw.js` y a los `<script>` de la página.
3. Probar antes (ver "Cómo probar").
4. Volver atrás: `git revert` del commit, subir `CACHE` y push.

## Cómo está armado el código
- `index.html` y `gestion.html` se editan **directo** (los parches viejos `herramientas/agregar-*.py` ya no existen).
- Orden de carga en Pedidos: `vendor/supabase` → `version.js` → `negocio.js` → `nube.js` → script de `index.html` → `despacho.js` → `pagos.js` → `vendor/qrcode` → `escaner.js` → `etiquetas.js` → `live.js` → `promos.js` → `pedidos4.js` → `mabel.js` → `mabeltab.js`.
- Los `.js` **extienden** lo anterior: `const _x = f; f = function () { _x(); … }` y `Object.assign(ACT, {…})`. Una función de `index.html` puede estar reemplazada por un archivo de más abajo (ej. `etqHTML` en `despacho.js`, `etqPedido` y `cambiarLive` en `live.js`, `bbScan` en `escaner.js`). Antes de arreglar algo, buscá la última definición.
- Botones: `data-act` → `ACT`, `data-chg` → `CHG`, `data-inp` → `INP`.
- Datos: todo vive en Supabase. `nube.js` carga las tablas al entrar, detecta qué filas cambiaron cuando la app llama a `put('emma_…')` y las sube; si no hay internet, encola. Una fila que falta en memoria se sube como `borrado: true`: **nunca reemplazar `DB.lives`, `DB.clientes`, etc. por una copia vieja** (por eso se sacaron "Recuperar", "Importar backup" y "Empezar de cero").
- localStorage solo guarda preferencias de cada equipo (pestaña activa, etiquetas, WhatsApp Web o app).

## Datos del negocio (COD-10)
- `negocio.js` tiene todo lo que cambia de una tienda a otra: nombre, nombre en etiquetas, teléfono, RUT, ciudad, tarifa, recargo de Mercado Pago, extra del cadete, cuentas de cobro, horarios de corte y barrios de la cadetería. Se usan con `negocio('tel')`, `NEGOCIO_DEF.x`, `CORTES.x`, `BARRIOS_GRISAL`.
- Lo que se guarda en ⚙️ Config gana: `config.negocio` = { nombre, marca, tel, rut, ciudad }, `config.tarifaEnvio`, `config.mpRecargo`, `config.cuentasPago`, `config.extraCobroCadete`. Config solo escribe lo que cambió.
- **Mabel tiene sus propias copias** y no lee `negocio.js`: cuentas por defecto y horarios en `tools.ts`, barrios en `barrios.ts`, nombre y montos en `prompt.ts`. Lee de `config` solo `tarifaEnvio`, `mpRecargo` y `cuentasPago`. Si cambiás un horario o un barrio, cambialo en los dos lados.

## Mabel (agente de WhatsApp)
- La función publicada `whatsapp-webhook` es solo un `index.ts` de pocas líneas que importa `app.ts` de este repo **fijado a un commit** (raw.githubusercontent). Cambiar el repo no cambia a Mabel hasta que se publica un `index.ts` con el hash nuevo.
- Flujo: editar `app.ts` / `tools.ts` / `prompt.ts` → commit → push → probar en `mabel-prueba` (números 0990000xx) → con ok de Yoan, publicar `index.ts` con el hash nuevo (verify_jwt apagado) → mirar que siga contestando y que el repaso dé 200.
- Los pines para volver atrás están en el comentario de `index.ts`.
- El texto de Mabel (`prompt.ts`) se toca en una sola pasada por tanda (cada cambio rehace la caché y cuesta).

## Cómo probar sin tocar la base
Servir la carpeta con un servidor local y, con Playwright, reemplazar `vendor/supabase-2.45.4.js` por un Supabase falso que devuelva datos de ejemplo y anote los `upsert` (lo que "se subiría"). Así se prueba que abren todas las pestañas sin errores y qué escribiría cada botón. Además: `node --check` de cada `.js` y del script de cada `.html`.

## Copia para otra tienda (marca de hombre)
Se arma en sus propias cuentas (otro GitHub, otro Supabase), con base vacía. Cambiar:
- `negocio.js` (todo).
- `nube.js`: `NUBE_URL` y `NUBE_KEY` del Supabase nuevo.
- Títulos "Emma Pedidos" / "Emma Gestión", `manifest.json`, `iconos/`, y los logos embebidos en `despacho.js` (`ETQ_IMG`, `GRISAL_LOGO`).
- Nombres de plantillas de WhatsApp (`emma_confirmacion`, `emma_total_2`, `emma_recordatorio_1/2` en `live.js`), solo para la etapa B.
- Ningún dato de clientas, cuentas ni claves de Emma pasa a la copia. El agente lleva sus propias instrucciones (no se copia `prompt.ts`).
