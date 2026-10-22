import sys
src, dst = sys.argv[1], sys.argv[2]
s=open(src).read()
def R(a,b,n=1):
    global s
    c=s.count(a)
    assert c==n,(a[:100],c); s=s.replace(a,b)

# --- CSS ---
R("#toast{position:fixed;", """/* Nube */
.nube{margin-left:auto;font:600 12px var(--sans);padding:5px 10px;border-radius:999px;border:1px solid var(--bd);background:var(--s2);color:var(--mu);white-space:nowrap}
.nube.ok{color:var(--ok)}.nube.sub{color:var(--pe)}.nube.off{color:var(--pe);border-color:var(--pe)}.nube.err{color:var(--li);border-color:var(--li)}
#login,#carga{position:fixed;inset:0;z-index:900;background:var(--bg);display:flex;align-items:center;justify-content:center;padding:20px}
#login[hidden],#carga[hidden]{display:none}
#login .bx{width:100%;max-width:360px;text-align:center}
#login .bx .logo{width:56px;height:56px;font-size:26px;margin:0 auto 12px}
#login h2{font-size:22px;margin-bottom:14px}#login h2 span{color:var(--ac)}
#login input{margin-bottom:10px}
#lg-err{color:var(--li);font-size:13px;min-height:18px;margin-top:8px}
#carga{flex-direction:column;gap:12px;color:var(--mu);font-weight:600}
#toast{position:fixed;""")
# --- HTML ---
R("""<header>
  <div class="logo">🛍️</div>
  <h1>Emma <span>Pedidos</span></h1>
</header>""","""<div id="login" hidden><div class="bx">
  <div class="logo">🛍️</div>
  <h2>Emma <span>Pedidos</span></h2>
  <input id="lg-email" type="email" autocomplete="username" placeholder="Mail">
  <input id="lg-pass" type="password" autocomplete="current-password" placeholder="Contraseña" onkeydown="if(event.key==='Enter')entrar()">
  <button class="b pri blk" id="lg-btn" onclick="entrar()" style="width:100%">Entrar</button>
  <div id="lg-err"></div>
</div></div>
<div id="carga" hidden><div style="font-size:34px">☁️</div><div>Trayendo tus datos…</div></div>
<header>
  <div class="logo">🛍️</div>
  <h1>Emma <span>Pedidos</span></h1>
  <span id="nube-estado" class="nube">☁️</span>
</header>""")
R("""    <div class="card-t">📊 Espacio usado</div>
    <div id="cf-espacio"></div>""","""    <div class="card-t">☁️ Cuenta y nube</div>
    <p class="small muted mb">Los datos se guardan en la nube y se ven igual desde la compu y el celular. Si se corta internet, se sigue cargando y se sube al volver.</p>
    <div class="row"><button class="b" onclick="cambiarPass()">🔑 Cambiar contraseña</button><button class="b dan" onclick="salir()">Cerrar sesión</button></div>
    <div id="cf-espacio" hidden></div>""")
R("<script>\n'use strict';", "<script src=\"vendor/supabase-2.45.4.js\"></script>\n<script src=\"nube.js\"></script>\n<script>\n'use strict';\nconst MODO_NUBE = true;")

# --- almacenamiento: los datos de trabajo van a la nube ---
R("function leer(k, def) {", """const CLAVES_NUBE = { emma_clientes: () => DB.clientes, emma_lives: () => DB.lives, emma_stock: () => DB.stock, emma_movimientos: () => DB.movimientos, emma_mostrador: () => DB.mostrador, emma_config: () => DB.config, emma_compras: () => NUBE.compras };
function leer(k, def) {
  if (MODO_NUBE && CLAVES_NUBE[k]) { const v = CLAVES_NUBE[k](); return v == null ? def : v; }""")
R("function put(k, v) {\n  if (TAB.bloqueada) return false;","function put(k, v) {\n  if (TAB.bloqueada) return false;\n  if (MODO_NUBE && CLAVES_NUBE[k]) { nubeCambio(k); return true; }")
R("function cargarDB() {","function cargarDB() {\n  if (MODO_NUBE) return; // la carga la hace la nube")
R("function reloadStock() {","function reloadStock() {\n  if (MODO_NUBE) return; // el stock llega en tiempo real")
R("const comp = leer('emma_compras', null); if (comp) d.emma_compras = comp;","const comp = leer('emma_compras', null); if (comp && comp.length !== undefined) d.emma_compras = comp;")
R("function entraEnMemoria(datos) {","function entraEnMemoria(datos) {\n  if (MODO_NUBE) return true;")
# importar / recuperar: a memoria y a la nube
R("""      for (const k in txt) localStorage.setItem(k, txt[k]);
      location.reload();""","""      if (MODO_NUBE) { aplicarDatosEnMemoria(d); toast('✓ Backup cargado; subiendo a la nube…', 4000); }
      else { for (const k in txt) localStorage.setItem(k, txt[k]); location.reload(); }""")
R("""  try { for (const k of KEYS) if (r.datos[k] != null) localStorage.setItem(k, r.datos[k]); }
  catch (e) { return alert('⚠️ No entra en la memoria: liberá espacio (archivá lives o borrá la v71) y probá de nuevo.'); }
  location.reload();""","""  if (MODO_NUBE) { const d = {}; for (const k of KEYS) if (r.datos[k] != null) d[k] = JSON.parse(r.datos[k]); aplicarDatosEnMemoria(d); toast('✓ Foto recuperada; subiendo a la nube…', 4000); return; }
  try { for (const k of KEYS) if (r.datos[k] != null) localStorage.setItem(k, r.datos[k]); }
  catch (e) { return alert('⚠️ No entra en la memoria: liberá espacio (archivá lives o borrá la v71) y probá de nuevo.'); }
  location.reload();""")
R("/** ¿Entran estos datos (claves → texto) en lugar de los actuales sin pasar el límite? */","""/** Modo nube: reemplaza lo que hay en memoria por un backup o foto y lo sube. */
function aplicarDatosEnMemoria(d) {
  if (d.emma_clientes) DB.clientes = d.emma_clientes;
  if (d.emma_lives) DB.lives = d.emma_lives;
  if (d.emma_stock) DB.stock = d.emma_stock;
  if (d.emma_movimientos) DB.movimientos = d.emma_movimientos;
  if (d.emma_mostrador) DB.mostrador = d.emma_mostrador;
  if (d.emma_config) DB.config = d.emma_config;
  nubeCambioTodo(); render();
}
/** ¿Entran estos datos (claves → texto) en lugar de los actuales sin pasar el límite? */""")
# --- inicio ---
R("""function init() {
  // Una sola pestaña""","""function init() {
  // Una sola pestaña""")
R("""  medirEspacio();
  montarComponentes();
  cargarDB();
  migrarRespaldosAlInicio().then(() => {""","""  medirEspacio();
  if (MODO_NUBE) { iniciarNube(); return; }
  iniciarApp();
}
/** Arranca la app con los datos ya en memoria (en modo nube, después de traerlos). */
function iniciarApp() {
  montarComponentes();
  cargarDB();
  migrarRespaldosAlInicio().then(() => {""")
R("""  const sinDatos = !localStorage.getItem('emma_lives');
  if (sinDatos && hayV71()) { iniciarMigracion(); return; }""","""  const sinDatos = !localStorage.getItem('emma_lives');
  if (!MODO_NUBE && sinDatos && hayV71()) { iniciarMigracion(); return; }""")
R("""    saveLives();
    if (!localStorage.getItem('emma_stock')) put('emma_stock', []);
  }
  render();
  actualizarAvisos();
}
init();""","""    saveLives();
    if (!MODO_NUBE && !localStorage.getItem('emma_stock')) put('emma_stock', []);
  }
  render();
  actualizarAvisos();
}
init();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});""")
open(dst,'w').write(s)
print('ok')
