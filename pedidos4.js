'use strict';
/* ══════════════════════════════════════════════════════════════
   EMMA PEDIDOS · ETAPA 4: talles, escáner de prenda, promos y VIP
   - Tipear "142" muestra los talles del modelo (los sin stock tachados). Escanear "P142-M" carga la prenda directo.
   - El total del pedido usa calcularPedido (promos.js): precio especial, combos/NxM en línea 🎁, live + VIP.
   - Cada pedido guarda las promos y el % VIP con que se calculó (promoCalc): no cambia si después se edita una promo.
   - ⭐ VIP en la ficha, candidatas a VIP y botón de bienvenida.
   Se carga después de live.js (reemplaza funciones de Pedidos sin tocar el archivo original).
   ══════════════════════════════════════════════════════════════ */

// ─── Prendas y talles ─────────────────────────────────────────
const esPrenda = s => /^P\d+(-[A-Z0-9]+)?$/i.test(String(s || '').trim());
const modeloDeStock = id => { const s = id && DB.stock.find(x => x.id === id); return s ? s.modeloId || null : null; };
const modeloActNum = n => (DB.modelos || []).find(m => m.activo !== false && +m.num === +n);
const ORDEN_T = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '34', '36', '38', '40', '42', '44', '46', '48'];
const tallesDe = m => DB.stock.filter(s => s.modeloId === m.id && s.activo !== false).sort((a, b) => (ORDEN_T.indexOf(a.talle) + 99) % 99 - (ORDEN_T.indexOf(b.talle) + 99) % 99);
/** "P142-M", "142-M", "142" (talle único) → la fila de stock de ese talle. */
function varPorCodigo(txt) {
  const q = String(txt || '').trim().replace(/^P(?=\d)/i, '').toUpperCase();
  if (!q) return null;
  return stockActivo().find(s => String(s.codigo).toUpperCase() === q) || null;
}

const _qlInput = qlInput, _qlKey = qlKey, _qlHTML = qlHTML;
qlHTML = function (px) {
  const h = _qlHTML(px);
  return h.replace('<div class="ql-info"', `<div class="row" style="margin-top:6px"><button class="b sm" data-act="camPrenda" data-px="${px}">📷 Escanear prenda</button></div><div class="ql-info"`);
};
/** Tipear el número de un modelo: aparecen sus talles. */
qlInput = function (px) {
  const st = QL[px], q = $('#' + px + '-txt').value.trim();
  const m = /^\d+$/.test(q) && modeloActNum(q), vs = m ? tallesDe(m) : [];
  if (!m || vs.length < 2) { st.q = q; return _qlInput(px); }
  st.sel = null; $('#' + px + '-info').textContent = '';
  st.items = vs.map(a => ({ a })).concat([{ manual: q }]);
  st.idx = Math.max(0, vs.findIndex(a => a.stock > 0));
  st.q = q;
  const sug = $('#' + px + '-sug');
  sug.innerHTML = `<div class="si" style="cursor:default;color:var(--mu);font-size:12px">${esc(m.num + ' · ' + m.nombre)} · ${fmt(m.precioVenta)} · elegí el talle</div>` + st.items.map((it, i) => it.a
    ? `<div class="si${i === st.idx ? ' hi' : ''}" data-act="qlPick" data-px="${px}" data-i="${i}"${it.a.stock > 0 ? '' : ' style="opacity:.55"'}><b style="font-size:16px;display:inline-block;min-width:44px">${esc(it.a.talle)}</b> <span class="mono small">${esc(it.a.codigo)}</span> · ${it.a.stock > 0 ? 'quedan ' + it.a.stock : '<s>sin stock</s>'}</div>`
    : `<div class="si${i === st.idx ? ' hi' : ''}" data-act="qlPick" data-px="${px}" data-i="${i}">✍️ Prenda manual: <b>${esc(it.manual)}</b> <span class="muted small">(no toca el stock)</span></div>`).join('');
  // qlPick usa el índice dentro de items: el renglón de título no cuenta
  sug.querySelectorAll('[data-act=qlPick]').forEach(el => { el.dataset.i = String(+el.dataset.i); });
  sug.classList.add('on');
};
qlKey = function (px, e) {
  if (e.key === 'Enter') {
    const st = QL[px], txt = $('#' + px + '-txt'), q = txt.value.trim(), sug = $('#' + px + '-sug');
    const v = varPorCodigo(q);
    if (v) { e.preventDefault(); qlElegir(px, { a: v }); if (esPrenda(q)) qlConfirmar(px); return; }
    const m = /^\d+$/.test(q) && modeloActNum(q);
    if (m && tallesDe(m).length > 1) {
      e.preventDefault();
      if (!sug.classList.contains('on') || st.q !== q) { qlInput(px); return; }
      return qlElegir(px, st.items[st.idx] || { manual: q });
    }
  }
  return _qlKey(px, e);
};
qlMarcar = function (px) {
  document.querySelectorAll('#' + px + '-sug [data-act=qlPick]').forEach(el => { const on = +el.dataset.i === QL[px].idx; el.classList.toggle('hi', on); if (on) el.scrollIntoView({ block: 'nearest' }); });
};

// ─── Escáner de prenda ────────────────────────────────────────
function prendaEscaneada(px, t) {
  const v = varPorCodigo(t);
  if (!v) return toast(esPrenda(t) ? 'Esa prenda no está en el stock (¿archivada?)' : 'Eso no es una etiqueta de prenda', 3500);
  qlElegir(px, { a: v }); qlConfirmar(px);
  toast(`✓ ${v.codigo} · ${v.descripcion}${v.stock > 0 ? '' : ' (⚠️ figuraba sin stock)'}`);
}
const _codigoLeido = codigoLeido;
codigoLeido = function (t) { const s = String(t).trim(); return esPrenda(s) ? s.toUpperCase() : _codigoLeido(t); };
if (typeof buscarEnter === 'function') {
  const _buscarEnter = buscarEnter;
  buscarEnter = function () {
    const q = String(UI.desp && UI.desp.q || '').trim();
    if (esPrenda(q)) {
      const v = varPorCodigo(q);
      UI.desp.q = ''; const el = $('#dsp-q'); if (el) el.value = '';
      return toast(v ? `👕 Es una prenda: ${v.codigo} · ${v.descripcion} · quedan ${v.stock}` : '👕 Etiqueta de prenda (no está en el stock)', 4500);
    }
    return _buscarEnter();
  };
}

// ─── Cálculo del pedido con promos y VIP ──────────────────────
const vipPctCfg = () => { const v = DB.config.vipPct; return Math.max(0, v === undefined || v === null || v === '' ? 5 : +v || 0); };   // cfg() de Pedidos no tiene valor por defecto
const editable = p => p.estado === 'pendiente' && !(typeof pagado === 'function' && pagado(p)) && !p.cambio;
/** Guarda en el pedido las promos que valen hoy (solo las que tocan sus prendas) y el % VIP de la clienta. */
function refrescarPromos(p) {
  if (!p || !editable(p)) return;
  const mids = new Set(p.prendas.map(pr => modeloDeStock(pr.stockId)).filter(Boolean));
  const hoy = hoyISO();
  const promos = (DB.promos || []).filter(x => promoVigente(x, p.liveId, hoy) && (x.modelos || []).some(m => mids.has(m))).map(x => JSON.parse(JSON.stringify(x)));
  const c = cliById(p.clienteId);
  p.promoCalc = { fecha: hoy, promos, vipPct: c && c.vip ? vipPctCfg() : 0 };
}
function ctxPedido(p) {
  const s = p.promoCalc || {}, live = liveById(p.liveId);
  return { promos: s.promos || [], modeloDe: modeloDeStock, liveId: p.liveId, hoy: s.fecha || hoyISO(), livePct: live ? live.descuento : 0, vipPct: s.vipPct || 0 };
}
const calcViejo = calc;   // el cálculo anterior (sin promos ni VIP): sirve para comprobar que los pedidos viejos dan igual
calc = function (p) {
  const r = calcularPedido(p, ctxPedido(p));
  r.desc = r.livePct; r.descMonto = r.descLive + r.descVip + r.descPromos + r.ahorroEspecial;
  return r;
};
// Cada cambio de prendas pasa por recalcSaldo: ahí se actualizan las promos del pedido
const _recalcSaldo = recalcSaldo;
recalcSaldo = function (p) { refrescarPromos(p); return _recalcSaldo(p); };
const _agregarPrenda = agregarPrenda;
agregarPrenda = function (p, pr) {
  _agregarPrenda(p, pr);
  const s = pr.stockId && DB.stock.find(x => x.id === pr.stockId);
  if (s && s.modeloId && (+s.stock || 0) <= 0 && esActivo(p.estado)) toast(`⚠️ Se acabó el ${s.codigo}${s.talle && s.talle !== 'U' ? ' (talle ' + s.talle + ')' : ''}`, 3500);
};
/** Renglones de descuentos para tarjetas y ventanas (reemplaza "Descuento X%"). */
function descLineasHTML(t) {
  if (!t.descMonto) return '';
  const l = (txt, m, col) => `<div class="tot-l" style="color:var(--${col || 'ac'})"><span>${txt}</span><span>−${fmt(m)}</span></div>`;
  return `<div class="tot-l"><span>Subtotal</span><span>${fmt(t.bruto + t.ahorroEspecial)}</span></div>`
    + (t.ahorroEspecial ? l('🎁 Precios especiales', t.ahorroEspecial) : '')
    + t.promos.map(x => l('🎁 ' + esc(x.nombre), x.monto)).join('')
    + (t.descLive ? l(`🎉 Descuento live ${t.livePct}%`, t.descLive) : '')
    + (t.descVip ? l(`⭐ Descuento VIP ${t.vipPct}%`, t.descVip) : '');
}
mensajePedido = function (p) {
  const c = cliById(p.clienteId) || { nombre: '' }, live = liveById(p.liveId), t = calc(p);
  const porPrenda = new Map(); t.unidades.forEach(u => porPrenda.set(u.i, (porPrenda.get(u.i) || 0) + u.precio));
  const lineas = p.prendas.map((pr, i) => {
    const q = pr.qty || 1, x = q > 1 ? ' x' + q : '', tot = porPrenda.has(i) ? porPrenda.get(i) : pr.precio * q, lista = (pr.precioLista ?? pr.precio) * q;
    return lista > tot ? `- ${pr.nombre}${x}: ~${fmt(lista)}~ *${fmt(tot)}*` : `- ${pr.nombre}${x}: ${fmt(tot)}`;
  }).join('\n');
  let msg = `Hola ${c.nombre}! 🛍️\n\n`;
  if (live && live.fechaPago) msg += `📅 Fecha de pago: hasta ${live.fechaPago}\n\n`;
  msg += `Tu pedido #${p.num}:\n${lineas}`;
  const desc = [];
  t.promos.forEach(x => desc.push(`🎁 ${x.nombre}: -${fmt(x.monto)}`));
  if (t.descLive) desc.push(`🎉 Descuento live ${t.livePct}%: -${fmt(t.descLive)}`);
  if (t.descVip) desc.push(`⭐ Descuento VIP ${t.vipPct}%: -${fmt(t.descVip)}`);
  if (desc.length) msg += '\n\n' + desc.join('\n');
  if (t.saldo) msg += `\n💰 Saldo a favor: -${fmt(t.saldo)}`;
  msg += `\n\n*Total: ${fmt(t.total)}* ✅`;
  const pago = cfg('msgPago');
  if (pago) msg += '\n\n' + pago;
  return msg;
};

// ─── VIP ──────────────────────────────────────────────────────
const VIP_MSG_DEF = '{nombre}, ¿cómo estás? 😊\nTe escribimos para contarte que desde hoy sos *clienta VIP* y parte de la *Comunidad VIP de Emma* ⭐\nEs un grupito de clientas que nos acompañan hace tiempo, que compran seguido y con las que da gusto trabajar. Y vos sos una de ellas.\nTu beneficio: *{descuento}% de descuento VIP* en todos tus pedidos, de forma automática. Además, vas a ser de las primeras en enterarte de novedades y promos.\n¡Bienvenida a la comunidad! 💕';
function textoBienvenidaVip(nombre) {
  const link = String(cfg('vipGrupo') || '').trim();
  return (cfg('vipMensaje') || VIP_MSG_DEF).replace(/\{nombre\}/g, nombre).replace(/\{descuento\}/g, vipPctCfg()) + (link ? '\n\nSumate al grupo: ' + link : '');
}
/** Recalcula los pedidos abiertos de la clienta (al hacerla VIP o sacarla). */
function recalcPedidosDe(cid) { todosPedidos().filter(p => p.clienteId === cid && editable(p)).forEach(p => recalcSaldo(p)); }
function hacerVip(c, si) {
  if (si) { c.vip = true; c.vipDesde = c.vipDesde || hoyISO(); }
  else { c.vip = false; }
  recalcPedidosDe(c.id);
  guardar();
}
const VIP_MIN = 4, VIP_DIAS = 60;
function candidatasVip() {
  const m = stats(), lim = new Date(Date.now() - VIP_DIAS * 864e5).toISOString();
  return DB.clientes.filter(c => !c.vip && !c.noVip && (m[c.id] || ST0).ok >= VIP_MIN && !(m[c.id] || ST0).mal && !(m[c.id] || ST0).deudas.length && (c.ultimoUso || '') >= lim)
    .sort((a, b) => (m[b.id].ok - m[a.id].ok) || (b.ultimoUso || '').localeCompare(a.ultimoUso || ''));
}
const _nomAlias = nomAlias;
nomAlias = c => _nomAlias(c) + (c && c.vip ? ' <span class="chip ac" title="Clienta VIP">⭐ VIP</span>' : '');
const _itemClienta = itemClienta;
itemClienta = function (c, h) {
  const btn = c.vip
    ? `<button class="b sm" data-act="vipBienv" data-cid="${c.id}" title="Mandar mensaje de bienvenida">💬 Bienvenida VIP</button><button class="b sm gh" data-act="vipNo" data-cid="${c.id}" title="Sacar de VIP">✕ VIP</button>`
    : `<button class="b sm" data-act="vipSi" data-cid="${c.id}">⭐ Hacer VIP</button>`;
  let html = _itemClienta(c, h).replace('<button class="b sm" data-act="clEdit"', btn + '<button class="b sm" data-act="clEdit"');
  if (c.vip) html = html.replace('<div class="row mt">', `<div class="small muted mt">⭐ VIP desde el ${fechaUY(c.vipDesde)} · ${c.bienvenidaVip ? 'bienvenida enviada el ' + fechaUY(c.bienvenidaVip, 1) : '<span style="color:var(--pe)">falta mandar la bienvenida</span>'}</div><div class="row mt">`);
  return html;
};
const _renderClientes = renderClientes;
renderClientes = function () {
  _renderClientes();
  const cs = candidatasVip(), el = $('#cl-deshacer'); if (!el) return;
  const vips = DB.clientes.filter(c => c.vip).length;
  el.insertAdjacentHTML('beforeend', `<details class="card" id="cl-vip"${UI.vipAbierto ? ' open' : ''}><summary style="cursor:pointer;font-weight:700">⭐ VIP: ${vips} clienta${vips === 1 ? '' : 's'} · ${cs.length} candidata${cs.length === 1 ? '' : 's'}</summary>
    <p class="small muted mt">Candidatas: ${VIP_MIN} o más pedidos ✅, ningún ❌ ni deuda, y compró en los últimos ${VIP_DIAS} días. Decidís vos.</p>
    ${cs.length ? cs.slice(0, 30).map(c => { const h = stats()[c.id] || ST0; return `<div class="row" style="padding:6px 0;border-bottom:1px solid var(--bd)"><span class="grow" style="flex:1;min-width:0">${esc(c.nombre)} ${histHTML(h)}</span><button class="b sm" data-act="vipSi" data-cid="${c.id}">⭐ Hacer VIP</button><button class="b sm gh" data-act="vipDescartar" data-cid="${c.id}" title="No mostrarla más como candidata">No</button></div>`; }).join('') : '<div class="small muted">No hay candidatas nuevas.</div>'}
  </details>`);
  const d = $('#cl-vip'); if (d) d.addEventListener('toggle', () => { UI.vipAbierto = d.open; });
};
function mandarBienvenida(c) {
  if (!c.tel && !pedirTel(c)) return;
  if (abrirWA(c.tel, textoBienvenidaVip(c.nombre))) { c.bienvenidaVip = ahoraISO(); guardar(); render(); }
}
Object.assign(ACT, {
  camPrenda: d => abrirCamara(t => prendaEscaneada(d.px, t), 'Apuntá al QR de la etiqueta de la prenda'),
  vipSi: d => {
    const c = cliById(d.cid); if (!c) return;
    hacerVip(c, true); render();
    showModal(`<h3>⭐ ${esc(c.nombre)} ya es VIP</h3><p class="mb">Desde ahora tiene <b>${vipPctCfg()}% de descuento VIP</b> en sus pedidos (sumado al del live, sobre las prendas sin promo). Sus pedidos abiertos ya se recalcularon.</p>
      <div class="box small" style="white-space:pre-wrap;margin-bottom:12px">${esc(textoBienvenidaVip(c.nombre))}</div>
      <div class="row"><button class="b ok" data-act="vipBienv" data-cid="${c.id}">💬 Mandar bienvenida</button><button class="b gh" data-act="closeModal">Después</button></div>`);
  },
  vipBienv: d => { const c = cliById(d.cid); if (!c) return; closeModal(); mandarBienvenida(c); },
  vipNo: d => { const c = cliById(d.cid); if (!c || !confirm(`¿Sacar a ${c.nombre} de VIP?\nSus pedidos abiertos dejan de tener el descuento VIP.`)) return; hacerVip(c, false); render(); },
  vipDescartar: d => { const c = cliById(d.cid); if (!c) return; c.noVip = true; guardar(); render(); }
});
