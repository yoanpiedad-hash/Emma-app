'use strict';
/* ══════════════════════════════════════════════════════════════
   EMMA GESTIÓN · FOTOS DE PRENDAS (Paso 1 del catálogo web)
   Cada modelo guarda en m.web: { fotos: [{ p: ruta, u: link }], nombre, precio, pub, publicado }.
   - Las fotos van al bucket PÚBLICO "prendas" de Supabase Storage (solo fotos de prendas, nada privado).
   - Estados: sin fotos → ✅ listo (tiene fotos y precio) → 🌐 publicado (pub = true).
   - Modelos de una compra "pedida" que todavía no existen: las fotos quedan en el color de la compra (mo.web)
     y pasan al modelo al recibir, como ✅ listo (NO se publica solo).
   Se carga después del script de gestion.html.
   ══════════════════════════════════════════════════════════════ */
const FOTOS_BUCKET = 'prendas';
const FOTO_MAX = 1600;       // lado más largo, en píxeles
const FOTO_CALIDAD = 0.82;   // JPEG
const FOTOS_TOPE = 12;       // por modelo

/* ── Datos ── */
const webDe = x => (x && x.web) || null;
const fotosDe = x => ((webDe(x) || {}).fotos || []).filter(f => f && f.u);
const nombreWeb = (x, base) => String((webDe(x) || {}).nombre || '').trim() || String((base || x || {}).nombre || '');
const precioWeb = (x, base) => num((webDe(x) || {}).precio) || num((base || x || {}).precioVenta);
/** 'sin' (sin fotos) · 'listo' · 'pub' (publicado) */
function estadoWeb(m) {
  if (!fotosDe(m).length) return 'sin';
  return webDe(m).pub ? 'pub' : 'listo';
}
const ESTADO_WEB_TXT = { sin: '📷 sin fotos', listo: '✅ listo', pub: '🌐 publicado' };
const ESTADO_WEB_CLS = { sin: '', listo: 'ok', pub: 'gu' };
const chipWeb = m => `<span class="chip ${ESTADO_WEB_CLS[estadoWeb(m)]}">${ESTADO_WEB_TXT[estadoWeb(m)]}</span>`;
const listoParaPublicar = m => m && m.activo !== false && estadoWeb(m) === 'listo' && precioWeb(m) > 0;
const conStockSinFotos = () => modelosActivos().filter(m => totalModelo(m) > 0 && !fotosDe(m).length);
const listosSinPublicar = () => modelosActivos().filter(listoParaPublicar);

/* ── A qué le estamos poniendo fotos: un modelo, o un color de una compra pedida ── */
// t = { m: modeloId }  ó  { cid, lid, k }
function objetivo(t) {
  if (t.m) { const m = modeloById(t.m); return m ? { x: m, m, base: m, tipo: 'modelo' } : null; }
  const c = compraById(t.cid), l = lineaDe(c, t.lid), mo = l && (l.modelos || []).find(z => z.k === t.k);
  if (!mo) return null;
  const m = mo.mid && modeloById(mo.mid);
  if (m) return { x: m, m, base: m, tipo: 'modelo', c, mo };   // reposición: las fotos son del modelo que ya existe
  return { x: mo, m: null, base: mo, tipo: 'compra', c, mo };
}
function asegurarWeb(x) { if (!x.web) x.web = { fotos: [] }; if (!Array.isArray(x.web.fotos)) x.web.fotos = []; return x.web; }
function guardarObjetivo(o) {
  if (o.tipo === 'modelo') { o.m.web.cambiado = ahoraISO(); put('emma_modelos'); }
  else saveCompras();
}
const carpeta = o => o.tipo === 'modelo' ? 'm/' + o.m.id : 'c/' + o.mo.k;

/* ── Achicar la foto en el equipo antes de subir ── */
async function cargarImagen(file) {
  if (window.createImageBitmap) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) {}
  }
  return await new Promise((ok, mal) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); ok(img); };
    img.onerror = () => { URL.revokeObjectURL(url); mal(new Error('No se pudo leer la foto')); };
    img.src = url;
  });
}
async function achicar(file) {
  const img = await cargarImagen(file);
  const w0 = img.width, h0 = img.height, k = Math.min(1, FOTO_MAX / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); cx.drawImage(img, 0, 0, w, h);
  if (img.close) try { img.close(); } catch (e) {}
  const blob = await new Promise(ok => cv.toBlob(ok, 'image/jpeg', FOTO_CALIDAD));
  if (!blob) throw new Error('No se pudo achicar la foto');
  return { blob, w, h };
}
function storage() {
  if (!NUBE.sb || !NUBE.user) throw new Error('Sin conexión con la base');
  return NUBE.sb.storage.from(FOTOS_BUCKET);
}
async function subirFoto(o, file) {
  const { blob, w, h } = await achicar(file);
  const ruta = `${carpeta(o)}/${uid('f')}.jpg`;
  const st = storage();
  const r = await st.upload(ruta, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false });
  if (r.error) throw r.error;
  const u = st.getPublicUrl(ruta).data.publicUrl;
  return { p: ruta, u, w, h };
}
function borrarDeStorage(rutas) {
  rutas = (rutas || []).filter(Boolean); if (!rutas.length) return;
  try { storage().remove(rutas).then(r => { if (r && r.error) console.warn('fotos: no se borró', r.error); }).catch(() => {}); } catch (e) {}
}

/* ── Ventana de fotos ── */
let FT = null;   // { t, subiendo, hechas, total }
function abrirFotos(t) {
  if (!objetivo(t)) return toast('No encuentro ese modelo');
  FT = { t, subiendo: false, hechas: 0, total: 0 };
  pintarFotos();
}
function pintarFotos() {
  const o = FT && objetivo(FT.t); if (!o) { closeModal(); return; }
  const fotos = fotosDe(o.x), w = webDe(o.x) || {}, est = o.tipo === 'modelo' ? estadoWeb(o.m) : (fotos.length ? 'listo' : 'sin');
  const titulo = o.tipo === 'modelo' ? `${esc(numTxt(o.m))} · ${esc(o.m.nombre)}` : `${esc(o.mo.nombre || 'Color sin nombre')} <span class="chip pe">compra pedida</span>`;
  const pv = num(o.base.precioVenta);
  showModal(`<h3>📷 Fotos</h3>
    <p class="mb"><b>${titulo}</b> · ${o.tipo === 'modelo' ? chipWeb(o.m) : `<span class="chip ${ESTADO_WEB_CLS[est]}">${ESTADO_WEB_TXT[est]}</span>`}</p>
    ${o.tipo === 'compra' ? '<div class="alert pe small">Todavía no llegó: las fotos quedan guardadas y pasan al modelo cuando confirmes la recepción. Se publica después, a mano.</div>' : ''}
    <div class="ft-grid" id="ft-grid">${fotos.map((f, i) => `<div class="ft" data-fi="${i}">
        <img src="${esc(f.u)}" alt="" draggable="false" loading="lazy">${i === 0 ? '<span class="ft-por">Portada</span>' : ''}
        <button class="ft-x" data-act="ftQuitar" data-i="${i}" title="Quitar">✕</button></div>`).join('')}
      ${FT.subiendo ? `<div class="ft ft-sub">Subiendo<br>${FT.hechas + 1} de ${FT.total}…</div>` : ''}</div>
    ${fotos.length > 1 ? '<div class="small muted mt">Arrastrá las fotos para ordenarlas. La primera es la portada.</div>' : ''}
    ${fotos.length < FOTOS_TOPE ? `<div class="row mt">
      <label class="b pri${FT.subiendo ? ' dis' : ''}">📷 Sacar foto<input type="file" accept="image/*" capture="environment" id="ft-cam" hidden${FT.subiendo ? ' disabled' : ''}></label>
      <label class="b${FT.subiendo ? ' dis' : ''}">🖼️ Elegir de la galería<input type="file" accept="image/*" multiple id="ft-gal" hidden${FT.subiendo ? ' disabled' : ''}></label>
    </div>` : `<div class="small muted mt">Máximo ${FOTOS_TOPE} fotos por modelo.</div>`}
    <div class="sec-t">Para la clienta</div>
    <div class="grid2">
      <div class="full"><label class="lb">Nombre que ve la clienta</label><input id="ft-nom" maxlength="80" value="${esc(w.nombre || '')}" placeholder="${esc(o.base.nombre || 'ej: Remera de lino blanca')}"></div>
      <div><label class="lb">Precio</label><input id="ft-pre" type="text" inputmode="decimal" value="${num(w.precio) || ''}" placeholder="${pv ? esc(String(pv)) + ' (el de venta)' : 'precio'}"></div>
      <div style="align-self:end"><button class="b sm" data-act="ftDatos">✓ Guardar nombre y precio</button></div>
    </div>
    <div class="small muted mt">Si los dejás vacíos se usan el nombre y el precio de venta del modelo.</div>
    <div class="row mt">${o.tipo === 'modelo'
      ? (est === 'pub' ? '<button class="b dan" data-act="ftDespublicar">Despublicar</button>'
        : est === 'listo' ? '<button class="b ok" data-act="ftPublicar">🌐 Publicar</button>' : '<span class="small muted">Con al menos una foto queda ✅ listo para publicar.</span>')
      : '<span class="small muted">Se puede publicar cuando llegue la compra.</span>'}
      <span class="grow"></span><button class="b gh" data-act="ftCerrar">Cerrar</button></div>`);
  ['ft-cam', 'ft-gal'].forEach(id => { const el = $('#' + id); if (el) el.addEventListener('change', () => { const fs = [...(el.files || [])]; el.value = ''; if (fs.length) agregarFotos(fs); }); });
  activarArrastre();
}
async function agregarFotos(files) {
  if (!FT || FT.subiendo) return;
  let o = objetivo(FT.t); if (!o) return;
  const libres = FOTOS_TOPE - fotosDe(o.x).length;
  files = files.filter(f => /^image\//.test(f.type || 'image/')).slice(0, Math.max(0, libres));
  if (!files.length) return toast(libres > 0 ? 'Eso no es una foto' : `Máximo ${FOTOS_TOPE} fotos`);
  FT.subiendo = true; FT.hechas = 0; FT.total = files.length; pintarFotos();
  let mal = 0;
  for (const f of files) {
    try {
      const foto = await subirFoto(o, f);
      o = objetivo(FT.t); if (!o) break;   // por si cambió mientras subía
      asegurarWeb(o.x).fotos.push(foto);
      guardarObjetivo(o);
    } catch (e) { console.error('fotos', e); mal++; }
    FT.hechas++;
    if (FT && $('#ft-grid')) pintarFotos();
  }
  FT.subiendo = false;
  if (mal) toast(`⚠️ ${mal} foto(s) no se pudieron subir. Revisá internet y probá de nuevo.`, 4500);
  else toast(`✓ ${files.length} foto(s) guardada(s)`);
  if ($('#ft-grid')) pintarFotos();
  render();
}
function quitarFoto(i) {
  const o = FT && objetivo(FT.t); if (!o) return;
  const fs = asegurarWeb(o.x).fotos, f = fs[+i]; if (!f) return;
  if (!confirm(+i === 0 ? '¿Quitar la portada? La siguiente pasa a ser la portada.' : '¿Quitar esta foto?')) return;
  fs.splice(+i, 1);
  if (!fs.length && o.x.web.pub) { o.x.web.pub = false; toast('Sin fotos: se despublicó'); }
  guardarObjetivo(o);
  borrarDeStorage([f.p]);
  pintarFotos(); render();
}
function moverFoto(de, a) {
  const o = FT && objetivo(FT.t); if (!o || de === a) return;
  const fs = asegurarWeb(o.x).fotos; if (!fs[de]) return;
  const [f] = fs.splice(de, 1); fs.splice(Math.max(0, Math.min(fs.length, a)), 0, f);
  guardarObjetivo(o); pintarFotos(); render();
}
function guardarDatosWeb() {
  const o = FT && objetivo(FT.t); if (!o) return;
  const w = asegurarWeb(o.x);
  const nom = String(($('#ft-nom') || {}).value || '').trim(), pre = Math.max(0, num(($('#ft-pre') || {}).value));
  w.nombre = nom && nom !== o.base.nombre ? nom : '';
  w.precio = pre && pre !== num(o.base.precioVenta) ? pre : 0;
  guardarObjetivo(o); toast('✓ Guardado'); pintarFotos(); render();
}
function publicar(m, si) {
  const w = asegurarWeb(m);
  if (si) {
    if (!fotosDe(m).length) return toast('Primero poné al menos una foto'), false;
    if (!(precioWeb(m) > 0)) return toast('Le falta el precio'), false;
    if (m.activo === false) return toast('Está archivado: volvé a usarlo antes de publicar'), false;
  }
  w.pub = !!si; if (si) w.publicado = ahoraISO();
  w.cambiado = ahoraISO();
  return true;
}
function publicarListos() {
  const L = listosSinPublicar();
  if (!L.length) return toast('No hay modelos ✅ listos para publicar');
  if (!confirm(`¿Publicar ${L.length} modelo(s) ✅ listo(s)?\n\n${L.slice(0, 15).map(m => '• ' + numTxt(m) + ' · ' + nombreWeb(m)).join('\n')}${L.length > 15 ? `\n… y ${L.length - 15} más` : ''}`)) return;
  L.forEach(m => publicar(m, true));
  put('emma_modelos'); toast(`🌐 ${L.length} publicado(s)`); render();
}

/* ── Arrastrar para ordenar (dedo o mouse) ── */
function activarArrastre() {
  const grid = $('#ft-grid'); if (!grid) return;
  let arr = null;
  grid.querySelectorAll('.ft[data-fi]').forEach(el => {
    el.addEventListener('pointerdown', e => {
      if (e.target.closest('.ft-x') || FT.subiendo) return;
      arr = { el, de: +el.dataset.fi, a: +el.dataset.fi, x: e.clientX, y: e.clientY, mov: false, id: e.pointerId };
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
    });
    el.addEventListener('pointermove', e => {
      if (!arr || arr.el !== el) return;
      const dx = e.clientX - arr.x, dy = e.clientY - arr.y;
      if (!arr.mov && Math.hypot(dx, dy) < 8) return;
      arr.mov = true; el.classList.add('arr'); el.style.transform = `translate(${dx}px,${dy}px)`;
      el.style.pointerEvents = 'none';
      const bajo = document.elementFromPoint(e.clientX, e.clientY), d = bajo && bajo.closest('.ft[data-fi]');
      el.style.pointerEvents = '';
      grid.querySelectorAll('.ft.sobre').forEach(z => z.classList.remove('sobre'));
      if (d && d !== el) { d.classList.add('sobre'); arr.a = +d.dataset.fi; } else if (!d) arr.a = arr.de;
      e.preventDefault();
    });
    const fin = () => {
      if (!arr || arr.el !== el) return;
      const { de, a, mov } = arr; arr = null;
      el.classList.remove('arr'); el.style.transform = '';
      if (mov && a !== de) moverFoto(de, a); else grid.querySelectorAll('.ft.sobre').forEach(z => z.classList.remove('sobre'));
    };
    el.addEventListener('pointerup', fin);
    el.addEventListener('pointercancel', fin);
  });
}

/* ── Estilos ── */
(function () {
  const st = document.createElement('style');
  st.textContent = `.ft-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px;margin-top:6px}
.ft{position:relative;aspect-ratio:3/4;border-radius:10px;overflow:hidden;background:var(--s3);border:1px solid var(--bd);touch-action:none;user-select:none;-webkit-user-select:none;cursor:grab}
.ft img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}
.ft.arr{z-index:5;opacity:.85;box-shadow:0 6px 20px #000a;cursor:grabbing}
.ft.sobre{outline:2px solid var(--ac)}
.ft-por{position:absolute;left:4px;bottom:4px;background:var(--ac);color:#231800;font:700 10.5px var(--sans);padding:2px 6px;border-radius:6px}
.ft-x{position:absolute;top:4px;right:4px;width:26px;height:26px;border-radius:50%;border:0;background:#000a;color:#fff;font-size:13px;cursor:pointer}
.ft-sub{display:flex;align-items:center;justify-content:center;text-align:center;font-size:12px;color:var(--mu);cursor:default}
label.b{display:inline-flex;align-items:center;cursor:pointer}.b.dis{opacity:.5;pointer-events:none}
.ft-min{width:34px;height:44px;object-fit:cover;border-radius:6px;vertical-align:middle;margin-right:6px;background:var(--s3)}`;
  document.head.appendChild(st);
})();

/* ── Botones ── */
Object.assign(ACT, {
  ftModelo: d => abrirFotos({ m: d.id }),
  ftCompra: d => abrirFotos({ cid: d.cid, lid: d.lid, k: d.k }),
  ftQuitar: d => quitarFoto(d.i),
  ftDatos: () => guardarDatosWeb(),
  ftPublicar: () => { const o = FT && objetivo(FT.t); if (o && o.m && publicar(o.m, true)) { put('emma_modelos'); toast('🌐 Publicado'); pintarFotos(); render(); } },
  ftDespublicar: () => { const o = FT && objetivo(FT.t); if (o && o.m && confirm('¿Despublicar? Deja de verse en el catálogo (las fotos quedan).')) { publicar(o.m, false); put('emma_modelos'); toast('Despublicado'); pintarFotos(); render(); } },
  ftCerrar: () => { if (FT && FT.subiendo && !confirm('Todavía se están subiendo fotos. ¿Cerrar igual? (las que faltan se siguen subiendo)')) return; closeModal(); FT = null; },
  ftPubModelo: d => { const m = modeloById(d.id); if (m && publicar(m, true)) { put('emma_modelos'); toast('🌐 Publicado'); render(); } },
  ftDespubModelo: d => { const m = modeloById(d.id); if (m && confirm('¿Despublicar? Deja de verse en el catálogo (las fotos quedan).')) { publicar(m, false); put('emma_modelos'); toast('Despublicado'); render(); } },
  ftPubListos: () => publicarListos()
});

/* ── Al recibir la compra: las fotos del color pasan al modelo, como ✅ listo (no se publica solo) ── */
function pasarFotosAlModelo(mo, m) {
  const w = webDe(mo); if (!w || !m) return;
  const fs = (w.fotos || []).filter(f => f && f.u);
  if (!fs.length && !w.nombre && !num(w.precio)) return;
  const mw = asegurarWeb(m), ya = new Set(mw.fotos.map(f => f.p));
  fs.forEach(f => { if (!ya.has(f.p)) mw.fotos.push(f); });
  if (w.nombre && !mw.nombre) mw.nombre = w.nombre;
  if (num(w.precio) && !num(mw.precio)) mw.precio = num(w.precio);
  mw.cambiado = ahoraISO();
  delete mo.web;   // ya están en el modelo
}
