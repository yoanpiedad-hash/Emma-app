'use strict';
/* ══════════════════════════════════════════════════════════════
   EMMA · CAPA DE NUBE (Supabase)
   La app sigue trabajando con DB en memoria como siempre. Esta capa:
   - carga todo desde la base al entrar,
   - detecta qué cambió (por fila) cada vez que la app "guarda" y lo sube,
   - si no hay internet, guarda los cambios en una cola local y los sube después,
   - recibe en tiempo real lo que cambian otros dispositivos.
   ══════════════════════════════════════════════════════════════ */
const NUBE_URL = 'https://ssipaovluukkypsbzboe.supabase.co';
const NUBE_KEY = 'sb_publishable_-hoSPEhxcQoioc7Wit65iA_4cnM4nMC';

const NUBE = {
  sb: null, user: null, listo: false,
  ult: {},     // col → Map(id → JSON de la última fila sincronizada)
  filas: {},   // col → Map(id → última fila (para marcar borrado))
  out: {},     // col → Map(id → fila pendiente de subir)
  marca: {},   // col → último "actualizado" visto (para pedir solo lo nuevo)
  estado: 'ok', error: '', subiendo: false, timer: null, canal: null,
  compras: []
};
const ORDEN = ['clientas', 'lives', 'stock', 'pedidos', 'movimientos', 'mostrador', 'config'];
const TODAS = [...ORDEN, 'compras'];
const SIN_BORRADO = new Set(['movimientos', 'config']);
const PK = { config: 'clave' };
const pk = c => PK[c] || 'id';

/* ── Cómo se ve cada colección en la base ── */
const COL = {
  clientas: {
    lista: () => DB.clientes,
    fila: c => ({ id: c.id, nombre: c.nombre || '', tel_key: c.telKey || '', datos: c })
  },
  lives: {
    lista: () => DB.lives,
    fila: l => { const { pedidos, ...r } = l; return { id: l.id, nombre: l.nombre || '', fecha: l.fecha || null, datos: r }; }
  },
  pedidos: {
    lista: () => DB.lives.flatMap(l => l.pedidos || []),
    fila: p => ({ id: p.id, live_id: p.liveId, clienta_id: p.clienteId || null, num: +p.num || 0, codigo: String(p.codigo || p.id),
      estado: p.estado || 'pendiente', entrega: p.entrega || 'sin_definir', datos: p })
  },
  stock: {
    lista: () => DB.stock,
    fila: s => ({ id: s.id, codigo: s.codigo || '', datos: s })
  },
  movimientos: {
    lista: () => DB.movimientos,
    fila: m => ({ id: m.id, stock_id: (m.stockId && DB.stock.some(s => s.id === m.stockId)) ? m.stockId : null,
      fecha: m.fecha || new Date().toISOString(), cantidad: +m.cantidad || 0, motivo: m.motivo || '', ref: m.ref || null }),
    obj: r => ({ id: r.id, fecha: r.fecha, stockId: r.stock_id, cantidad: r.cantidad, motivo: r.motivo, ref: r.ref })
  },
  mostrador: {
    lista: () => DB.mostrador,
    fila: v => ({ id: v.id, fecha: v.fecha || null, datos: v })
  },
  config: {
    lista: () => Object.entries(DB.config || {}).map(([clave, valor]) => ({ id: clave, clave, valor })),
    fila: c => ({ clave: c.clave, valor: c.valor === undefined ? null : c.valor }),
    obj: r => ({ clave: r.clave, valor: r.valor })
  }
};
// La fila "comparable": solo las columnas que escribimos (sin actualizado, actualizado_por)
function normal(col, r) {
  const ej = { clientas: ['id', 'nombre', 'tel_key', 'datos'], lives: ['id', 'nombre', 'fecha', 'datos'],
    pedidos: ['id', 'live_id', 'clienta_id', 'num', 'codigo', 'estado', 'entrega', 'datos'], stock: ['id', 'codigo', 'datos'],
    movimientos: ['id', 'stock_id', 'fecha', 'cantidad', 'motivo', 'ref'], mostrador: ['id', 'fecha', 'datos'], config: ['clave', 'valor'],
    compras: ['id', 'datos'] }[col];
  const o = {}; for (const k of ej) o[k] = r[k] === undefined ? null : r[k];
  if (col === 'movimientos' && o.fecha) o.fecha = new Date(o.fecha).toISOString();
  if (col === 'mostrador' && o.fecha) o.fecha = new Date(o.fecha).toISOString();
  return o;
}
/** JSON con las claves ordenadas: la base devuelve los objetos con otro orden y no tiene que contar como cambio. */
function estable(v) {
  if (Array.isArray(v)) return '[' + v.map(estable).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ':' + estable(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}
const firma = (col, r) => estable(normal(col, r));

/* ── Cola local (IndexedDB aparte, no se mezcla con las fotos) ── */
let _kv = null;
function kv() {
  if (_kv) return _kv;
  _kv = new Promise((res, rej) => {
    const r = indexedDB.open('emma-nube', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  _kv.catch(() => { _kv = null; });
  return _kv;
}
const kvGet = k => kv().then(db => new Promise((res, rej) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }));
const kvSet = (k, v) => kv().then(db => new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }));

let _guardCola = null;
function guardarCola() {
  clearTimeout(_guardCola);
  _guardCola = setTimeout(() => {
    const o = {}; for (const c of ORDEN) o[c] = [...(NUBE.out[c] || new Map()).values()];
    kvSet('cola', o).catch(() => {});
  }, 200);
}
let _guardCache = null;
function guardarCache() {
  clearTimeout(_guardCache);
  _guardCache = setTimeout(() => {
    kvSet('cache', { fecha: new Date().toISOString(), datos: { clientes: DB.clientes, lives: DB.lives, stock: DB.stock, movimientos: DB.movimientos, mostrador: DB.mostrador, config: DB.config }, compras: NUBE.compras, marca: NUBE.marca }).catch(() => {});
  }, 2000);
}
const pendientes = () => ORDEN.reduce((n, c) => n + (NUBE.out[c] ? NUBE.out[c].size : 0), 0);

/* ── Detectar cambios y encolarlos ── */
function nubeDiff(col) {
  const C = COL[col], ult = NUBE.ult[col], filas = NUBE.filas[col], out = NUBE.out[col];
  const vistos = new Set();
  for (const o of C.lista()) {
    const f = C.fila(o), id = f[pk(col)]; vistos.add(id);
    const s = firma(col, f);
    if (ult.get(id) !== s) { ult.set(id, s); filas.set(id, f); out.set(id, f); }
  }
  if (!SIN_BORRADO.has(col)) for (const id of [...ult.keys()]) {
    if (vistos.has(id)) continue;
    const f = Object.assign({}, filas.get(id), { borrado: true });
    ult.delete(id); filas.delete(id); out.set(id, f);
  }
}
const QUE_COLS = { emma_clientes: ['clientas'], emma_lives: ['lives', 'pedidos'], emma_stock: ['stock'], emma_movimientos: ['movimientos'], emma_mostrador: ['mostrador'], emma_config: ['config'] };
/** La app llama a esto en lugar de escribir en localStorage. */
function nubeCambio(key) {
  const cols = QUE_COLS[key]; if (!cols || !NUBE.listo) return;
  for (const c of cols) nubeDiff(c);
  guardarCola(); guardarCache(); pintarNube();
  programarSubida(150);
}
function nubeCambioTodo() { for (const c of ORDEN) nubeDiff(c); guardarCola(); guardarCache(); pintarNube(); programarSubida(50); }

/* ── Subir la cola ── */
function programarSubida(ms) { clearTimeout(NUBE.timer); NUBE.timer = setTimeout(subir, ms); }
let _reintento = 2000;
async function subir() {
  if (NUBE.subiendo || !NUBE.user) return;
  if (!pendientes()) { NUBE.estado = 'ok'; pintarNube(); return; }
  if (!navigator.onLine) { NUBE.estado = 'offline'; pintarNube(); programarSubida(5000); return; }
  NUBE.subiendo = true; NUBE.estado = 'subiendo'; pintarNube();
  try {
    for (const col of ORDEN) {
      const out = NUBE.out[col];
      while (out.size) {
        const lote = [...out.entries()].slice(0, 300);
        const { error } = await NUBE.sb.from(col === 'config' ? 'config' : col).upsert(lote.map(([, f]) => f), { onConflict: pk(col) });
        if (error) throw Object.assign(new Error(error.message), { col, code: error.code, status: error.status });
        for (const [id, f] of lote) if (out.get(id) === f) out.delete(id);
        guardarCola();
      }
    }
    NUBE.estado = 'ok'; NUBE.error = ''; _reintento = 2000;
  } catch (e) {
    console.error('Nube:', e);
    const red = !navigator.onLine || /fetch|network|Failed|timeout/i.test(e.message) || !e.status || e.status >= 500;
    NUBE.estado = red ? 'offline' : 'error';
    NUBE.error = red ? '' : `${e.col}: ${e.message}`;
    if (!red && e.code === '23505' && e.col === 'pedidos') arreglarCodigoRepetido();
    _reintento = Math.min(_reintento * 2, 60000);
    programarSubida(_reintento);
  } finally { NUBE.subiendo = false; pintarNube(); }
}
/** Dos equipos crearon un pedido con el mismo código al mismo tiempo: se le da otro al nuestro. */
function arreglarCodigoRepetido() {
  const out = NUBE.out.pedidos;
  for (const [id] of out) {
    const p = DB.lives.flatMap(l => l.pedidos).find(x => x.id === id);
    if (p && p.fechas && p.fechas.creado === hoyISO()) { p.codigo = siguienteCodigo(); }
  }
  nubeDiff('pedidos'); guardarCola();
}

/* ── Traer de la base ── */
async function traerTodo(col, desde) {
  const filas = []; const paso = 1000;
  for (let i = 0; ; i += paso) {
    let q = NUBE.sb.from(col).select('*').range(i, i + paso - 1).order(pk(col));
    if (desde) q = q.gt('actualizado', desde); else if (!SIN_BORRADO.has(col)) q = q.eq('borrado', false);
    const { data, error } = await q;
    if (error) throw error;
    filas.push(...data);
    if (data.length < paso) break;
  }
  for (const r of filas) if (r.actualizado && (!NUBE.marca[col] || r.actualizado > NUBE.marca[col])) NUBE.marca[col] = r.actualizado;
  return filas;
}
function objDe(col, r) { return COL[col] && COL[col].obj ? COL[col].obj(r) : r.datos; }
async function cargarTodo() {
  const t = {};
  for (const col of TODAS) t[col] = await traerTodo(col);
  for (const col of ORDEN) { NUBE.ult[col] = new Map(); NUBE.filas[col] = new Map(); NUBE.out[col] = NUBE.out[col] || new Map(); }
  const recordar = (col, r) => { const f = normal(col, r); NUBE.ult[col].set(f[pk(col)], estable(f)); NUBE.filas[col].set(f[pk(col)], f); };
  DB.clientes = t.clientas.map(r => { recordar('clientas', r); return r.datos; });
  const porLive = new Map();
  for (const r of t.pedidos) { recordar('pedidos', r); if (!porLive.has(r.live_id)) porLive.set(r.live_id, []); porLive.get(r.live_id).push(r.datos); }
  DB.lives = t.lives.map(r => { recordar('lives', r); return Object.assign({}, r.datos, { pedidos: (porLive.get(r.id) || []).sort((a, b) => a.num - b.num) }); })
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || String(a.id).localeCompare(String(b.id)));
  DB.stock = t.stock.map(r => { recordar('stock', r); return r.datos; });
  DB.movimientos = t.movimientos.map(r => { recordar('movimientos', r); return objDe('movimientos', r); }).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  DB.mostrador = t.mostrador.map(r => { recordar('mostrador', r); return r.datos; });
  DB.config = {}; for (const r of t.config) { recordar('config', r); DB.config[r.clave] = r.valor; }
  NUBE.compras = t.compras.map(r => r.datos);
  // Lo que quedó en la cola local (cambios sin subir de antes) se vuelve a aplicar encima
  const cola = await kvGet('cola').catch(() => null);
  if (cola) for (const col of ORDEN) for (const f of (cola[col] || [])) aplicarFila(col, f, true);
}
/** Arranque sin internet: lo último que se guardó en este equipo. */
async function cargarCache() {
  const c = await kvGet('cache').catch(() => null);
  if (!c) return false;
  Object.assign(DB, c.datos); NUBE.compras = c.compras || []; NUBE.marca = c.marca || {};
  for (const col of ORDEN) { NUBE.ult[col] = new Map(); NUBE.filas[col] = new Map(); NUBE.out[col] = NUBE.out[col] || new Map();
    for (const o of COL[col].lista()) { const f = COL[col].fila(o); NUBE.ult[col].set(f[pk(col)], firma(col, f)); NUBE.filas[col].set(f[pk(col)], f); } }
  const cola = await kvGet('cola').catch(() => null);
  if (cola) for (const col of ORDEN) for (const f of (cola[col] || [])) aplicarFila(col, f, true);
  return true;
}

/* ── Aplicar una fila (de la base o de la cola) a la memoria ── */
function aplicarFila(col, r, propia) {
  if (col === 'compras') { const i = NUBE.compras.findIndex(x => String(x.id) === r.id); if (r.borrado) { if (i >= 0) NUBE.compras.splice(i, 1); } else if (i >= 0) NUBE.compras[i] = r.datos; else NUBE.compras.push(r.datos); return; }
  if (!COL[col]) return;
  const id = r[pk(col)];
  if (!propia) {
    if (NUBE.out[col] && NUBE.out[col].has(id)) return;           // tenemos un cambio propio sin subir: gana el nuestro
    const f = normal(col, r), s = estable(f);
    if (!r.borrado && NUBE.ult[col].get(id) === s) return;       // es el eco de lo que subimos
    if (r.borrado && !NUBE.ult[col].has(id)) return;             // ya estaba borrado acá
    NUBE.ult[col].set(id, s); NUBE.filas[col].set(id, f);
    if (r.borrado) { NUBE.ult[col].delete(id); NUBE.filas[col].delete(id); }
  } else {
    NUBE.out[col].set(id, r); NUBE.ult[col].set(id, firma(col, r)); NUBE.filas[col].set(id, r);
    if (r.borrado) { NUBE.ult[col].delete(id); NUBE.filas[col].delete(id); }
  }
  const borrar = !!r.borrado;
  const reemplazar = (arr, obj) => { const i = arr.findIndex(x => x.id === id); if (borrar) { if (i >= 0) arr.splice(i, 1); } else if (i >= 0) arr[i] = obj; else arr.push(obj); };
  if (col === 'clientas') reemplazar(DB.clientes, r.datos);
  else if (col === 'stock') reemplazar(DB.stock, r.datos);
  else if (col === 'mostrador') reemplazar(DB.mostrador, r.datos);
  else if (col === 'movimientos') reemplazar(DB.movimientos, COL.movimientos.obj(r));
  else if (col === 'config') { if (borrar) delete DB.config[id]; else DB.config[id] = r.valor; }
  else if (col === 'lives') {
    const i = DB.lives.findIndex(x => x.id === id);
    if (borrar) { if (i >= 0) DB.lives.splice(i, 1); }
    else if (i >= 0) DB.lives[i] = Object.assign({}, r.datos, { pedidos: DB.lives[i].pedidos });
    else { DB.lives.push(Object.assign({}, r.datos, { pedidos: [] })); DB.lives.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))); }
    if (!borrar) adoptarHuerfanos(id);
  } else if (col === 'pedidos') {
    for (const l of DB.lives) { const i = l.pedidos.findIndex(x => x.id === id); if (i >= 0 && (borrar || l.id !== r.live_id)) l.pedidos.splice(i, 1); }
    if (!borrar) {
      const l = DB.lives.find(x => x.id === r.live_id);
      if (!l) { HUERFANOS.set(id, r); return; }
      const i = l.pedidos.findIndex(x => x.id === id);
      if (i >= 0) l.pedidos[i] = r.datos; else { l.pedidos.push(r.datos); l.pedidos.sort((a, b) => a.num - b.num); }
    }
  }
}
const HUERFANOS = new Map();
function adoptarHuerfanos(liveId) { for (const [id, r] of HUERFANOS) if (r.live_id === liveId) { HUERFANOS.delete(id); aplicarFila('pedidos', r, false); } }

/* ── Tiempo real y puesta al día ── */
let _pintar = null;
function refrescarPronto() { clearTimeout(_pintar); _pintar = setTimeout(() => { if (typeof render === 'function') render(); guardarCache(); }, 250); }
function escuchar() {
  if (NUBE.canal) NUBE.sb.removeChannel(NUBE.canal);
  NUBE.canal = NUBE.sb.channel('emma-cambios')
    .on('postgres_changes', { event: '*', schema: 'public' }, ev => {
      const r = ev.new; if (!r || !Object.keys(r).length) return;
      if (r.actualizado && (!NUBE.marca[ev.table] || r.actualizado > NUBE.marca[ev.table])) NUBE.marca[ev.table] = r.actualizado;
      aplicarFila(ev.table, r, false); refrescarPronto();
    })
    .subscribe(st => { if (st === 'SUBSCRIBED') ponerseAlDia(); });
}
async function ponerseAlDia() {
  if (!NUBE.listo || !navigator.onLine) return;
  try {
    for (const col of TODAS) {
      const desde = NUBE.marca[col];
      if (!desde) continue;
      const filas = await traerTodo(col, desde);
      for (const r of filas) aplicarFila(col, r, false);
    }
    refrescarPronto();
  } catch (e) { console.warn('Puesta al día:', e); }
}

/* ── Indicador ── */
function pintarNube() {
  const el = document.getElementById('nube-estado'); if (!el) return;
  const n = pendientes();
  const t = NUBE.estado === 'error' ? `⚠️ No se pudo guardar${n ? ' (' + n + ')' : ''}`
    : NUBE.estado === 'offline' ? `📴 Sin conexión${n ? ' · ' + n + ' cambio' + (n > 1 ? 's' : '') + ' esperando' : ''}`
    : n || NUBE.estado === 'subiendo' ? `⏳ Guardando${n ? ' ' + n : ''}…` : '☁️ Guardado';
  el.textContent = t;
  el.className = 'nube ' + (NUBE.estado === 'error' ? 'err' : NUBE.estado === 'offline' ? 'off' : n ? 'sub' : 'ok');
  el.title = NUBE.error || '';
}

/* ── Sesión ── */
function pantallaLogin(msg) {
  const el = document.getElementById('login'); el.hidden = false;
  document.getElementById('lg-err').textContent = msg || '';
  setTimeout(() => document.getElementById('lg-email').focus(), 50);
}
async function entrar() {
  const email = document.getElementById('lg-email').value.trim(), pass = document.getElementById('lg-pass').value;
  const btn = document.getElementById('lg-btn'); btn.disabled = true; document.getElementById('lg-err').textContent = '';
  const { error } = await NUBE.sb.auth.signInWithPassword({ email, password: pass });
  btn.disabled = false;
  if (error) { document.getElementById('lg-err').textContent = error.message === 'Invalid login credentials' ? 'Mail o contraseña incorrectos.' : 'No se pudo entrar: ' + error.message; return; }
  document.getElementById('login').hidden = true;
  arrancarConSesion();
}
async function salir() {
  if (pendientes() && !confirm('Hay cambios que todavía no subieron. Si cerrás sesión ahora se pierden. ¿Cerrar igual?')) return;
  await NUBE.sb.auth.signOut();
  await kvSet('cache', null).catch(() => {}); await kvSet('cola', null).catch(() => {});
  location.reload();
}
async function cambiarPass() {
  const p1 = prompt('Contraseña nueva (mínimo 8 caracteres):'); if (!p1) return;
  if (p1.length < 8) return alert('Tiene que tener al menos 8 caracteres.');
  const p2 = prompt('Repetila:'); if (p1 !== p2) return alert('No coinciden.');
  const { error } = await NUBE.sb.auth.updateUser({ password: p1 });
  alert(error ? 'No se pudo cambiar: ' + error.message : '✓ Contraseña cambiada.');
}

let _arranco = false;
async function arrancarConSesion() {
  if (_arranco) return; _arranco = true;
  const { data } = await NUBE.sb.auth.getUser().catch(() => ({ data: {} }));
  NUBE.user = (data && data.user) || (await NUBE.sb.auth.getSession()).data.session?.user || null;
  document.getElementById('carga').hidden = false;
  try {
    await cargarTodo();
    NUBE.estado = 'ok';
  } catch (e) {
    console.warn('Sin conexión al arrancar:', e);
    if (!(await cargarCache())) { document.getElementById('carga').hidden = true; _arranco = false; return pantallaLogin('No hay conexión y este equipo todavía no tiene datos guardados. Conectate a internet y probá de nuevo.'); }
    NUBE.estado = 'offline'; toast('📴 Sin conexión: trabajás con lo guardado en este equipo y se sube al volver internet', 5000);
  }
  NUBE.listo = true;
  document.getElementById('carga').hidden = true;
  guardarCache(); pintarNube();
  iniciarApp();
  escuchar();
  if (pendientes()) programarSubida(500);
  window.addEventListener('online', () => { NUBE.estado = 'subiendo'; pintarNube(); programarSubida(200); ponerseAlDia(); });
  window.addEventListener('offline', () => { NUBE.estado = 'offline'; pintarNube(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) ponerseAlDia(); });
  setInterval(ponerseAlDia, 60000);
  window.addEventListener('beforeunload', e => { if (pendientes() && navigator.onLine) { e.preventDefault(); e.returnValue = ''; } });
}
async function iniciarNube() {
  NUBE.sb = supabase.createClient(NUBE_URL, NUBE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  const { data } = await NUBE.sb.auth.getSession();
  if (data && data.session) arrancarConSesion(); else pantallaLogin();
}
