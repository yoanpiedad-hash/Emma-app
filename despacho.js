'use strict';
/* ══════════════════════════════════════════════════════════════
   EMMA · DESPACHO (reemplaza a Salidas)
   Buscás o escaneás → ves los pedidos abiertos de la clienta → tildás →
   elegís cómo sale (Retiro / Agencia / Cadetería / Guardado / Liberado) → listo.
   Cada salida queda como un "paquete" (tabla paquetes) y lleva una sola etiqueta.
   Si un pedido no figura pagado, avisa y deja marcar "Pagó" con la cuenta (tabla pagos).
   ══════════════════════════════════════════════════════════════ */

(() => {
  const st = document.createElement('style');
  st.textContent = `
.dsp-q{font-size:18px;padding:14px}
.dsp-p{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--bd);border-radius:12px;background:var(--s1);margin-bottom:8px;cursor:pointer;user-select:none}
.dsp-p.on{border-color:var(--ac);background:var(--ac2)}
.dsp-chk{width:26px;height:26px;border:2px solid var(--mu);border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:800;flex:none;color:#fff}
.dsp-p.on .dsp-chk{background:var(--ac);border-color:var(--ac)}
.dsp-p .pc-tot{font-size:16px}
.dsp-segs{display:grid;grid-template-columns:repeat(6,1fr);gap:6px}
.dsp-segs .b{padding:11px 4px;font-size:13px;white-space:normal;text-align:center}
.dsp-sal{border:2px solid var(--ac)}
#dsp-go{white-space:normal;text-align:center;line-height:1.25}
.dsp-a{display:flex;gap:8px;align-items:center;padding:10px 2px;border-bottom:1px solid var(--bd);cursor:pointer}
.dsp-a:last-child{border-bottom:none}
.dsp-a:hover{background:var(--s2)}
.dsp-a .nm{font-weight:700;font-size:15px}
.dsp-k{display:flex;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid var(--bd);flex-wrap:wrap}
.dsp-k:last-child{border-bottom:none}
.dsp-fil{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px}
.dsp-fil .b{display:flex;flex-direction:column;align-items:center;gap:2px;padding:10px 4px;font-size:13px;white-space:normal;text-align:center}
.dsp-fil .b b{font-size:22px;line-height:1}
.dsp-fil .b.on{border-color:var(--ac);background:var(--ac2);color:var(--ac)}
.dsp-vistas{grid-template-columns:repeat(3,1fr);position:sticky;top:0;z-index:5;background:var(--bg,#fff);padding:6px 0 8px;margin-bottom:6px}
.dsp-vistas .b.warn:not(.on){border-color:var(--li);color:var(--li)}
.dsp-ag-h{font-weight:800;font-size:13px;letter-spacing:.5px;color:var(--ac);padding:10px 2px 2px;text-transform:uppercase}
.sheet-t.a4ag{margin:2mm 0 0 2mm;page-break-after:auto;break-after:auto}
@media print{body{min-height:0!important}#print-area{display:flow-root!important}}
.sheet-t.a4ag+.sheet-t.a4ag{page-break-before:always;break-before:page}
@font-face{font-family:'Poppins';font-weight:400;font-display:block;src:url(fonts/Poppins-Regular.woff) format('woff')}
@font-face{font-family:'Poppins';font-weight:500;font-display:block;src:url(fonts/Poppins-Medium.woff) format('woff')}
@font-face{font-family:'Poppins';font-weight:700;font-display:block;src:url(fonts/Poppins-Bold.woff) format('woff')}
.lbl.ag2,.sheet-t>.lbl.ag2{--u:.096639mm;position:relative;flex:none;align-self:flex-start;box-sizing:border-box;width:calc(var(--u)*952);height:calc(var(--u)*1444);padding:0;border:calc(var(--u)*8) solid #000;border-radius:calc(var(--u)*22);overflow:hidden;background:#fff;color:#000;font-family:'Poppins','DM Sans',Arial,sans-serif;line-height:1}
.ag2 *{box-sizing:border-box}
.ag2-in{position:absolute;left:calc(var(--u)*-8);top:calc(var(--u)*-8);width:calc(var(--u)*952);height:calc(var(--u)*1444)}
.ag2-c{position:absolute;left:0;width:100%;text-align:center;white-space:pre}
.ag2-c img{display:block;margin:0 auto}
.ag2-hr{position:absolute;height:calc(var(--u)*4);background:#000}
.ag2-fl{position:absolute;left:calc(var(--u)*77);top:calc(var(--u)*512);width:calc(var(--u)*860)}
.ag2-lab{margin-left:calc(var(--u)*2);height:calc(var(--u)*40);font-size:calc(var(--u)*40);font-weight:400;letter-spacing:.12em;line-height:1}
.ag2-nom{margin-top:calc(var(--u)*19);font-weight:700;white-space:nowrap}
.ag2-r{display:flex;align-items:center}
.ag2-ic{flex:none;width:calc(var(--u)*58);display:flex;justify-content:center}
.ag2-rt{margin-left:calc(var(--u)*37);font-weight:400;white-space:pre;line-height:1}
.ag2-dir{margin-left:calc(var(--u)*95);width:calc(var(--u)*735);font-weight:400;font-size:calc(var(--u)*44);line-height:calc(var(--u)*46);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ag2-box{position:absolute;left:calc(var(--u)*59);top:calc(var(--u)*1189);width:calc(var(--u)*835);height:calc(var(--u)*200);border:calc(var(--u)*6) solid #000;border-radius:calc(var(--u)*22);display:flex;align-items:center;justify-content:center;font-weight:700;white-space:nowrap}
@media (max-width:520px){.dsp-segs{grid-template-columns:repeat(3,1fr)}.dsp-p{gap:8px;padding:10px}}
`;
  document.head.appendChild(st);
})();

UI.desp = { filtro: 'todos', q: '', idx: 0, items: [], cid: null, sel: new Set(), salida: null, f: {}, sinPago: false, aviso: '', res: null };

const CUENTAS_DEF = ['BROU', 'Prex', 'Mi Dinero', 'OCA', 'Mercado Pago', 'Efectivo', 'POS Mercado Pago', 'POS Scantech'];
const cuentasPago = () => { const c = cfg('cuentasPago'); return Array.isArray(c) && c.length ? c : CUENTAS_DEF; };
const SALIDAS = [['retiro', '🏠 Retiro'], ['agencia', '📦 Agencia'], ['cadeteria', '🚴 Cadetería'], ['guardado', '⏸️ Guardado'], ['liberado', '❌ Liberado'], ['pago', '💸 Solo pago']];
const conPago = t => ENVIOS.has(t) || t === 'pago';
const esTactil = () => !!(window.matchMedia && matchMedia('(pointer:coarse)').matches);
const ENVIOS = new Set(['retiro', 'agencia', 'cadeteria']);
const savePaquetes = () => put('emma_paquetes', DB.paquetes);
const savePagos = () => put('emma_pagos', DB.pagos);
const paqById = id => (DB.paquetes || []).find(k => k.id === id);

// ─── Reglas ───────────────────────────────────────────────────
/** Pagado = marcado con "Pagó", o en estado listo (así se marcaba hasta ahora). Un cambio no se cobra acá. */
const pagado = p => !!p.cambio || !!p.pago || p.estado === 'listo';
/** En Despacho se pide la cuenta de todo pedido que no tenga un pago marcado (los cambios no se cobran acá). */
const porCobrar = p => !p.cambio && !p.pago;
/** Código de la etiqueta de GrisalExpress: EMMA + su N Orden (letras y números, con algún número; ej. EMMAHMGU5CMH). Un nombre como "Emma Pérez" no lo es. */
const esGrisal = q => /^(ema)?emma(?=[a-z]*\d)[a-z0-9]{6,16}$/i.test(String(q).trim());
/** Pedidos de una clienta que todavía no salieron, del más viejo al más nuevo. */
function abiertosDe(cid) {
  return todosPedidos().filter(p => p.clienteId === cid && sinSalir(p))
    .sort((a, b) => (a.fechas.creado || '').localeCompare(b.fechas.creado || '') || a.num - b.num);
}
/** El pedido "principal" del paquete: el más nuevo (su número y código van en la etiqueta). */
const principal = ps => [...ps].sort((a, b) => (b.fechas.creado || '').localeCompare(a.fechas.creado || '') || b.num - a.num)[0];
const numsTxt = ps => ps.map(p => '#' + p.num).join(' · ');

/** Medio del pago según la cuenta: Mercado Pago (transferencia/link) lleva recargo; Efectivo y los POS (Mercado Pago, Scantech) son al retirar, sin recargo; el resto, transferencia. */
const medioDe = cuenta => /^pos\b/i.test((cuenta || '').trim()) ? 'efectivo' : /mercado\s*pago/i.test(cuenta || '') ? 'mercadopago' : /efectivo|d[eé]bito|cr[eé]dito/i.test(cuenta || '') ? 'efectivo' : 'transferencia';
const recargoMP = () => { const v = DB.config.mpRecargo; return v === undefined || v === null || v === '' ? 10 : Math.max(0, +v || 0); };
/** Lo que tiene que transferir: pedidos + envío (si lo transfiere) + recargo de Mercado Pago. */
function esperadoDe(base, env, cuenta) { const rec = medioDe(cuenta) === 'mercadopago' ? Math.round((base + env) * recargoMP() / 100) : 0; return { base, env, rec, total: base + env + rec }; }
/** Pago con 2 medios. x = lo que entró por el 2º medio (ya con el recargo si ese medio es Mercado Pago). El recargo va solo sobre la parte que pagó por Mercado Pago. */
function esperadoDos(base, env, c1, c2, x) {
  const T = base + env, r = recargoMP() / 100, mp1 = medioDe(c1) === 'mercadopago', mp2 = medioDe(c2) === 'mercadopago';
  x = Math.max(0, Math.round(+x || 0));
  const part2 = Math.min(T, mp2 ? Math.round(x / (1 + r)) : x), part1 = T - part2;
  const rec1 = mp1 ? Math.round(part1 * r) : 0, rec2 = mp2 ? Math.max(0, x - part2) : 0;
  return { T, part1, part2, rec1, rec2, tot1: part1 + rec1, tot2: part2 + rec2, rec: rec1 + rec2, total: T + rec1 + rec2, ok: part1 > 0 && part2 > 0 && !!c2 && c2 !== c1 };
}
function marcarPago(p, cuenta, origen) {
  const g = { id: uid('g'), pedidoId: p.id, clienteId: p.clienteId, cuenta, medio: medioDe(cuenta), monto: p.cambio ? (p.cambio.cobrar || 0) : calc(p).total, fecha: ahoraISO(), origen: origen || 'despacho', antes: p.estado };
  DB.pagos.push(g);
  p.pago = { id: g.id, cuenta, fecha: g.fecha };
  if (p.estado === 'pendiente') setEstado(p, 'listo');
  return g;
}
/** Anula un pago marcado por error: el pedido vuelve a "sin pagar" (y a pendiente si estaba pendiente). */
function anularPago(id) {
  const g = DB.pagos.find(x => x.id === id); if (!g) return;
  const p = pedById(g.pedidoId);
  // Pago con 2 medios: las dos filas de ese pedido se anulan juntas
  const ids = g.splitId ? DB.pagos.filter(x => x.splitId === g.splitId && x.pedidoId === g.pedidoId).map(x => x.id) : [id];
  DB.pagos = DB.pagos.filter(x => !ids.includes(x.id));
  if (p && p.pago && ids.includes(p.pago.id)) {
    delete p.pago;
    if (g.antes === 'pendiente' && p.estado === 'listo') setEstado(p, 'pendiente');
  }
}

/** Pagados que esperan salir, por tipo de entrega (sin retiro: esos se entregan cuando vienen). */
function paraArmar() {
  const G = { cadeteria: new Map(), agencia: new Map(), retiro: new Map(), sin_definir: new Map() };
  for (const p of todosPedidos()) {
    if (!sinSalir(p) || p.estado === 'guardado' || !pagado(p)) continue;
    const t = entregaEf(p); if (!G[t]) continue;
    if (!G[t].has(p.clienteId)) G[t].set(p.clienteId, []);
    G[t].get(p.clienteId).push(p);
  }
  const orden = m => [...m.entries()].map(([cid, ps]) => ({ cid, ps: ps.sort((a, b) => (a.fechas.creado || '').localeCompare(b.fechas.creado || '') || a.num - b.num) }))
    .sort((a, b) => (a.ps[0].fechas.creado || '').localeCompare(b.ps[0].fechas.creado || ''));
  return { cadeteria: orden(G.cadeteria), agencia: orden(G.agencia), retiro: orden(G.retiro), sin_definir: orden(G.sin_definir) };
}
function despBadge() {
  const el = document.getElementById('bdg-desp'); if (!el) return;
  const a = paraArmar(), n = a.cadeteria.length + a.agencia.length;
  el.innerHTML = n ? ` <span class="bdg">${n}</span>` : '';
}

// ─── Pantalla ─────────────────────────────────────────────────
function renderDespacho() {
  const el = $('#p-despacho'); if (!el) return;
  if (!el.dataset.ok) {
    el.innerHTML = `<div class="card"><div class="row" style="flex-wrap:nowrap"><div class="sw" style="flex:1;min-width:0"><input id="dsp-q" class="dsp-q" data-inp="despQ" placeholder="🔎 Nombre, teléfono o código" autocomplete="off" autocapitalize="off" enterkeyhint="search"><div class="sug" id="dsp-sug"></div></div><button class="b lg" data-act="camDesp" title="Escanear con la cámara" style="padding:14px 16px">📷</button></div></div>
      <div id="dsp-res"></div><div id="dsp-body"></div>`;
    el.dataset.ok = '1';
  }
  $('#dsp-res').innerHTML = resHTML();
  $('#dsp-body').innerHTML = UI.desp.cid && cliById(UI.desp.cid) ? clientaHTML() : inicioHTML();
}
function resHTML() {
  const r = UI.desp.res; if (!r) return '';
  const k = r.paqId && paqById(r.paqId);
  if (k) {
    const c = cliById(k.clienteId) || { nombre: '?' };
    const txt = { retiro: '🏠 Entregado', agencia: '📦 Sale por agencia', cadeteria: '🚴 Sale por cadetería' }[k.tipo];
    return `<div class="card"><div class="big-alert ok" style="margin-top:0">${txt} · ${esc(c.nombre)}<div style="font-size:15px;font-weight:700;margin-top:4px">${esc(k.nums.map(n => '#' + n).join(' · '))}${k.tipo === 'cadeteria' ? ' · ' + (k.cobro ? 'cobra ' + fmt(k.cobro) : 'envío pago') : ''}</div></div>
      <div class="row mt">${k.tipo !== 'retiro' ? `<button class="b pri" id="dsp-print" data-act="despPrint" data-k="${k.id}">🖨️ Imprimir etiqueta</button>` : ''}<button class="b sm" data-act="waCli" data-cid="${k.clienteId}" title="Abrir el chat vacío">💬 Chat</button><span class="grow"></span><button class="b sm gh" data-act="despDeshacer" data-k="${k.id}">↩️ Deshacer</button><button class="b sm gh" data-act="despResX">✕</button></div></div>`;
  }
  return `<div class="card"><div class="big-alert ${r.cls || 'mu'}" style="margin-top:0">${r.html}</div><div class="row mt"><span class="grow"></span>${r.pagos && r.pagos.some(id => DB.pagos.some(g => g.id === id)) ? '<button class="b sm gh" data-act="despDeshacerPago">↩️ Deshacer</button>' : ''}${r.cid ? `<button class="b sm" data-act="waCli" data-cid="${r.cid}" title="Abrir el chat vacío">💬 Chat</button><button class="b sm" data-act="despAbrir" data-cid="${r.cid}">Ver clienta</button>` : ''}<button class="b sm gh" data-act="despResX">✕</button></div></div>`;
}

// ── Inicio: pagados para armar + lo que salió hoy ──
function inicioHTML() {
  const a = paraArmar(), m = stats();
  const grupo = (tipo, titulo, ayuda) => {
    let gs = a[tipo]; if (!gs.length) return '';
    const agKey = cid => ((cliById(cid) || {}).agencia || '').trim().toUpperCase();
    if (tipo === 'agencia') gs = [...gs].sort((x, y) => (!agKey(x.cid)) - (!agKey(y.cid)) || agKey(x.cid).localeCompare(agKey(y.cid)));
    let agAnt = null;
    return `<div class="card"><div class="card-t">${titulo} <span class="bdg">${gs.length}</span></div>${ayuda ? `<div class="small muted mb">${ayuda}</div>` : ''}
      ${gs.map(({ cid, ps }) => {
        const c = cliById(cid) || { nombre: '?' }, art = ps.reduce((s, p) => s + (p.cambio ? p.cambio.art : calc(p).art), 0);
        const marcas = [];
        if (tipo === 'cadeteria' && !(c.direccion || '').trim()) marcas.push('<span class="chip li">⚠️ sin dirección</span>');
        if (tipo === 'agencia' && !(c.agencia || '').trim()) marcas.push('<span class="chip li">⚠️ sin agencia</span>');
        if ((m[cid] || ST0).guardados.length) marcas.push('<span class="chip gu">⏸️ tiene guardado</span>');
        if (ps.some(p => p.cambio)) marcas.push('<span class="chip ac">🔄 cambio</span>');
        const k = tipo === 'agencia' ? agKey(cid) || 'SIN AGENCIA' : null, cab = k && k !== agAnt ? `<div class="dsp-ag-h">${esc(k)} · ${gs.filter(x => (agKey(x.cid) || 'SIN AGENCIA') === k).length}</div>` : '';
        if (k) agAnt = k;
        return cab + `<div class="dsp-a" data-act="despArmar" data-cid="${cid}" data-t="${tipo}">
          <div style="flex:1;min-width:0"><div class="nm">${esc(c.nombre)}</div><div class="small muted">${numsTxt(ps)} · ${art} art. · ${fechaUY(ps[0].fechas.creado, 1)}${tipo === 'agencia' && c.agencia ? ' · ' + esc(c.agencia) : ''}${tipo === 'cadeteria' && c.barrio ? ' · ' + esc(c.barrio) : ''}</div>${marcas.length ? `<div class="pc-sub">${marcas.join(' ')}</div>` : ''}</div>
          <span class="muted">›</span></div>`;
      }).join('')}</div>`;
  };
  const sinPagar = todosPedidos().filter(p => p.estado === 'pendiente' && !p.cambio).length, F = UI.desp.filtro || 'todos', ver = t => F === 'todos' || F === t;
  const fil = [['todos', 'Todos', a.cadeteria.length + a.agencia.length + a.retiro.length + a.sin_definir.length], ['cadeteria', '🚴 Cadetería', a.cadeteria.length], ['agencia', '📦 Agencias', a.agencia.length], ['retiro', '🏠 Retiros', a.retiro.length]]
    .map(([t, txt, n]) => `<button class="b${F === t ? ' on' : ''}" data-act="despFiltro" data-t="${t}"><b>${n}</b>${txt}</button>`).join('');
  let h = (ver('cadeteria') ? grupo('cadeteria', '🚴 Pagados para armar · Cadetería') : '') + (ver('agencia') ? grupo('agencia', '📦 Pagados para armar · Agencias') : '')
    + (ver('retiro') ? grupo('retiro', '🏠 Pagados para retirar') : '')
    + (F === 'todos' ? grupo('sin_definir', '❓ Pagados sin entrega definida', 'Tocá la clienta y elegí cómo sale.') : '');
  if (!h) h = '<div class="empty">No hay pedidos pagados esperando salir 🎉</div>';
  h = `<div class="row mb" style="justify-content:flex-end"><button class="b sm" data-act="tab" data-t="pagos">📊 Pagos del día</button></div><div class="dsp-fil">${fil}</div>` + h;
  if (sinPagar) h += `<div class="small muted" style="margin:-4px 2px 12px">⏳ ${sinPagar} pedido${sinPagar > 1 ? 's' : ''} todavía sin pagar.</div>`;
  // Subpestañas (28/10): cada cosa en su pantalla, sin bajar hasta el final
  const nArmar = a.cadeteria.length + a.agencia.length + a.retiro.length + a.sin_definir.length;
  const nLib = typeof paraLiberar === 'function' ? paraLiberar().length : 0, nHoy = paquetesDeHoy().length;
  let V = UI.desp.vista || 'armar'; if (V === 'liberar' && typeof liberarHTML !== 'function') V = 'armar';
  const vs = [['armar', '📦 Para armar', nArmar], ['liberar', '⏳ Para liberar', nLib], ['hoy', '🚚 Salió hoy', nHoy]]
    .map(([k, txt, n]) => `<button class="b${V === k ? ' on' : ''}${k === 'liberar' && n ? ' warn' : ''}" data-act="despVista" data-v="${k}"><b>${n}</b>${txt}</button>`).join('');
  const pes = `<div class="dsp-fil dsp-vistas">${vs}</div>`;
  if (V === 'liberar') return pes + liberarHTML();
  if (V === 'hoy') return pes + (hoyHTML() || '<div class="empty">Todavía no salió nada hoy</div>');
  return pes + h;
}
function paquetesDeHoy() {
  const hoy = hoyISO();
  return (DB.paquetes || []).filter(k => localISO(new Date(k.fecha)) === hoy).sort((a, b) => b.fecha.localeCompare(a.fecha));
}
function hoyHTML() {
  // Pestañas propias de "Salió hoy" (27/10): tocar Cadetería / Agencias / Retiros muestra solo eso. Si no se eligió, sigue el filtro de arriba.
  const todos = paquetesDeHoy(); if (!todos.length) return '';
  const F = UI.desp.filtroHoy || UI.desp.filtro || 'todos', ks = todos.filter(k => F === 'todos' || k.tipo === F);
  const n = t => todos.filter(k => k.tipo === t).length, cad = ks.filter(k => k.tipo === 'cadeteria').length;
  const hora = iso => { const d = new Date(iso); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
  const ico = { retiro: '🏠', agencia: '📦', cadeteria: '🚴' };
  const pes = [['todos', 'Todo', todos.length], ['cadeteria', '🚴 Cadetería', n('cadeteria')], ['agencia', '📦 Agencias', n('agencia')], ['retiro', '🏠 Retiros', n('retiro')]]
    .map(([t, txt, c]) => `<button class="b${F === t ? ' on' : ''}" data-act="despFiltroHoy" data-t="${t}"${c || t === 'todos' ? '' : ' disabled'}><b>${c}</b>${txt}</button>`).join('');
  return `<div class="card"><div class="card-t">Salió hoy</div><div class="dsp-fil">${pes}</div>
    ${ks.length ? '' : '<div class="empty">Nada de esto salió hoy</div>'}
    ${cad ? `<div class="row mb">${grisalConectado() ? `<button class="b sm pri" data-act="despGrisalPasar">🚴 Pasar a Grisal${grisalPendientes().length ? ' (' + grisalPendientes().length + ')' : ' ✓'}</button>` : ''}<button class="b sm" data-act="despGrisal">📋 Copiar para GrisalExpress</button><button class="b sm" data-act="despHoja">🖨️ Hoja del cadete</button></div>` : ''}
    ${ks.map(k => { const c = cliById(k.clienteId) || { nombre: '?' }; return `<div class="dsp-k"><span class="mono small muted">${hora(k.fecha)}</span><span>${ico[k.tipo]}</span><span style="flex:1;min-width:120px"><b>${esc(c.nombre)}</b> <span class="small muted">${esc(k.nums.map(x => '#' + x).join(' · '))}</span>${k.grisalCopiado ? ' <span class="chip ac">📋 copiada</span>' : ''}</span>${k.tipo !== 'retiro' ? `<button class="b sm" data-act="despPrint" data-k="${k.id}" title="Reimprimir etiqueta">🖨️</button>` : ''}<button class="b sm gh" data-act="despDeshacer" data-k="${k.id}" title="Deshacer">↩️</button></div>`; }).join('')}
  </div>`;
}

// ── Clienta: pedidos abiertos y cómo salen ──
function chipPago(p) {
  if (p.cambio) return `<span class="chip ac">🔄 Cambio${p.cambio.cobrar ? ' · cobrar ' + fmt(p.cambio.cobrar) : ''}</span>`;
  const g = p.estado === 'guardado' ? '<span class="chip gu">⏸️ Guardado</span> ' : '';
  return g + (pagado(p) ? `<span class="chip ok">✓ Pagado${p.pago ? ' · ' + esc(p.pago.cuenta) : ''}</span>` : '<span class="chip pe">⏳ Sin pagar</span>');
}
function clientaHTML() {
  const D = UI.desp, c = cliById(D.cid), m = stats(), h = m[c.id] || ST0, ab = abiertosDe(c.id);
  for (const id of [...D.sel]) if (!ab.some(p => p.id === id)) D.sel.delete(id);
  const alertas = [];
  if (D.aviso) alertas.push(`<div class="alert pe">${D.aviso}</div>`);
  if (h.deudas.length) { const d = h.deudas[h.deudas.length - 1]; alertas.push(`<div class="alert li">⚠️ DEUDORA: pedido sin pagar del ${fechaUY(d.fecha)} por ${fmt(d.total)}${h.deudas.length > 1 ? ' (+' + (h.deudas.length - 1) + ' más)' : ''}</div>`); }
  if (c.saldoFavor > 0) alertas.push(`<div class="alert ok">💰 Tiene ${fmt(c.saldoFavor)} a favor</div>`);
  const filas = ab.map(p => {
    const l = liveById(p.liveId) || { nombre: '?' }, t = calc(p), on = D.sel.has(p.id), ent = entregaEf(p);
    return `<div class="dsp-p${on ? ' on' : ''}" data-act="despTog" data-id="${p.id}">
      <span class="dsp-chk">${on ? '✓' : ''}</span><span class="num">#${p.num}</span>
      <div class="pc-main"><div class="small"><b>${esc(l.nombre)}</b> · ${fechaUY(p.fechas.creado || l.fecha, 1)} · ${p.cambio ? p.cambio.art : t.art} art.</div>
        <div class="pc-sub">${chipPago(p)}${ent !== 'sin_definir' ? ` <span>${ENTREGA_TXT[ent]}</span>` : ''}</div></div>
      <div class="pc-tot">${p.cambio ? (p.cambio.cobrar ? fmt(p.cambio.cobrar) : '🔄') : fmt(t.total)}</div>
      <button class="b sm gh" data-act="despVer" data-id="${p.id}" title="Ver detalle">👁️</button></div>`;
  }).join('');
  const todos = ab.length > 1 ? `<button class="b sm" data-act="despTodos">${D.sel.size === ab.length ? '☐ Ninguno' : '☑ Todos'}</button>` : '';
  // "Más plazo" se maneja desde Despacho (30/10): sobre los tildados, o sobre todos los que pueden si no hay ninguno tildado
  const conPlazo = typeof plazoBtnHTML === 'function' ? ab.filter(p => plazoBtnHTML(p)) : [], selPlazo = conPlazo.filter(p => D.sel.has(p.id)), usaPlazo = selPlazo.length ? selPlazo : conPlazo;
  const btnPlazo = usaPlazo.length ? `<button class="b sm" data-act="masPlazo" data-ids="${usaPlazo.map(p => p.id).join(',')}" title="Pasa a Guardado sin pagar con fecha límite">📅 ${usaPlazo.every(p => p.guardadoSinPagar) ? 'Cambiar plazo' : 'Más plazo'}${selPlazo.length && selPlazo.length < conPlazo.length ? ' (' + selPlazo.length + ')' : ''}</button>` : '';
  const ultimos = !ab.length ? (DB.paquetes || []).filter(k => k.clienteId === c.id).sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 3) : [];
  return `<div class="card">
      <div class="row" style="align-items:flex-start"><div class="grow" style="flex:1;min-width:0"><div class="pc-nom" style="white-space:normal">${nomAlias(c)}</div><div class="pc-sub">${histHTML(h)} ${c.tel ? '<span class="mono">' + esc(c.tel) + '</span>' : '<span class="chip pe">⚠️ sin tel</span>'}</div></div><button class="b sm gh" data-act="despCerrar" title="Volver (Esc)">✕</button></div>
      <div class="row mt"><button class="b sm" data-act="verFicha" data-cid="${c.id}">👤 Ficha</button>${c.tel ? `<button class="b sm" data-act="waCli" data-cid="${c.id}" title="Abrir el chat vacío">💬 Chat</button>` : ''}${(() => { const u = ultimoPedidoDe(c.id); return u ? `<button class="b sm" data-act="irPedido" data-id="${u.id}">🛍️ Último pedido #${u.num} · ${esc((liveById(u.liveId) || {}).nombre || '')}</button>` : ''; })()}</div>
      ${alertas.join('')}
    </div>
    <div class="list-h"><span class="t">Sin salida <span class="bdg">${ab.length}</span></span><span class="row" style="gap:6px">${btnPlazo}${todos}</span></div>
    ${filas || `<div class="empty">No tiene pedidos sin salida${ultimos.length ? '' : ''}</div>${ultimos.map(k => `<div class="small muted" style="text-align:center">Último: ${{ retiro: '🏠 Retiro', agencia: '📦 Agencia', cadeteria: '🚴 Cadetería' }[k.tipo]} el ${fechaUY(localISO(new Date(k.fecha)))} · ${esc(k.nums.map(x => '#' + x).join(' · '))}</div>`).join('')}`}
    ${D.sel.size ? salidaHTML(c, ab.filter(p => D.sel.has(p.id))) : (ab.length ? '<div class="small muted" style="text-align:center;margin:6px 0 14px">Tildá los pedidos que salen</div>' : '')}`;
}
/** Último pedido de la clienta (cualquier estado), por fecha y número. */
function ultimoPedidoDe(cid) {
  return todosPedidos().filter(p => p.clienteId === cid).sort((a, b) => (b.fechas.creado || '').localeCompare(a.fechas.creado || '') || b.num - a.num)[0] || null;
}
function campoD(k, label, ph, extra) {
  const v = esc(UI.desp.f[k] || '');
  if (k === 'barrio') return `<div class="sw"><label class="lb">${label}</label><input id="dsf-${k}" data-inp="despF" data-f="${k}" data-barrio="1" autocomplete="off" value="${v}" placeholder="${esc(ph || '')}"><div class="sug"></div></div>`;
  return `<div><label class="lb">${label}</label><input id="dsf-${k}" data-inp="despF" data-f="${k}" value="${v}" placeholder="${esc(ph || '')}" ${extra || ''}></div>`;
}
/** Bloque "Pagó con 2 medios": 2º medio + cuánto entró por ese medio. */
function dosHTML(f, ctas, v) {
  if (!f.dos) return '<div class="row mt"><button class="b sm gh" data-act="despDos">＋ Pagó con 2 medios</button></div>';
  const bs = ctas.filter(c => c !== f.cuenta).map(cta => `<button class="b sm seg${f.cuenta2 === cta ? ' on' : ''}" data-act="despCuenta2" data-c="${esc(cta)}">${esc(cta)}</button>`).join('');
  let h = `<div class="mt"><label class="lb">2º medio *</label><div class="row">${bs}<button class="b sm gh" data-act="despDos">✕ Quitar</button></div></div>`;
  if (f.cuenta2) h += `<div class="row mt"><label class="small muted" for="dsf-monto2">Entró por ${esc(f.cuenta2)}</label><input id="dsf-monto2" type="number" inputmode="numeric" data-inp="despF" data-f="monto2" value="${esc(f.monto2 || '')}" placeholder="$" style="width:130px"><span class="small muted" id="dsf-dos-res">${dosResTxt(f, v)}</span></div>`;
  return h;
}
function dosResTxt(f, v) {
  if (!v || !(num(f.monto2) > 0)) return 'Poné cuánto pagó por este medio';
  if (!v.ok) return '⚠️ Ese monto no cierra con el total';
  return `✓ ${esc(f.cuenta)} ${fmt(v.tot1)} + ${esc(f.cuenta2)} ${fmt(v.tot2)}`;
}
/** Cálculo del 2º medio desde el estado del formulario (para validar sin redibujar). */
function dosV0(porCob, t, f) {
  const tar = +cfg('tarifaEnvio') || 0, base = porCob.reduce((s2, p) => s2 + calc(p).total, 0), env = (t === 'cadeteria' || t === 'pago') && f.conEnvio ? tar : 0;
  return f.dos && f.cuenta && f.cuenta2 ? esperadoDos(base, env, f.cuenta, f.cuenta2, f.monto2) : null;
}
function salidaHTML(c, ps) {
  const D = UI.desp, f = D.f, t = D.salida, n = ps.length;
  const segs = SALIDAS.map(([k, txt]) => `<button class="b seg${t === k ? ' on' : ''}" data-act="despSal" data-k="${k}">${txt}</button>`).join('');
  let form = '';
  if (t === 'retiro') form = '<div class="small muted mt">Se entrega en mano: los pedidos quedan como entregados.</div>';
  if (t === 'agencia') form = `<div class="grid2 mt">${campoD('agencia', 'Agencia *', 'DAC, Mirtrans…')}${campoD('nombreEnvio', 'Nombre real', c.nombre)}${campoD('ci', 'C.I.', '', 'inputmode="numeric"')}${campoD('ciudad', 'Ciudad *')}${campoD('depto', 'Departamento')}${campoD('direccion', 'Dirección (opcional)')}</div>`;
  if (t === 'cadeteria') {
    const b = (fk, v, txt) => `<button class="b sm seg${f[fk] === v ? ' on' : ''}" data-act="despFv" data-f="${fk}" data-v="${v}">${txt}</button>`;
    form = `<div class="mt">${campoD('nombreEnvio', 'Nombre para la etiqueta (opcional)', 'Si queda vacío va ' + c.nombre)}</div>
      <div class="grid2 mt">${campoD('direccion', 'Dirección *', 'Calle, número, apto')}${campoD('barrio', 'Barrio (opcional)', 'Escribí y elegí de la lista')}</div>
      <div class="mt">${campoD('notaCadete', 'Nota para el cadete (opcional)', 'Horario, referencia…')}</div>
      <label class="lb mt">Tipo de envío</label><div class="row">${b('tipo', 'comun', '📦 Común')}${b('tipo', 'cambio', '🔄 Cambio')}</div>
      <label class="lb mt">Cobro del envío *</label><div class="row">${b('cobro', 'cobrar', 'Cobrar ' + fmt(cfg('tarifaEnvio')))}${b('cobro', 'pago', '✓ Envío pago')}${b('cobro', 'monto', '✏️ Otro monto')}${f.cobro === 'monto' ? `<input id="dsf-monto" type="number" inputmode="numeric" data-inp="despF" data-f="monto" value="${esc(f.monto || '')}" placeholder="$ total" style="width:110px">` : ''}</div>`;
  }
  if (t === 'guardado') form = '<div class="small muted mt">Si no elegís nada abajo, quedan guardados con el plazo normal de 30 días (pestaña Guardados). Si ya pagó, marcá el pago; si todavía no, elegí "Sin pagar · con plazo".</div>';
  if (t === 'liberado') form = '<div class="alert li">La ropa vuelve al stock y el pedido cuenta como ❌ (queda como deuda en la ficha).</div>';
  if (t === 'pago') form = '<div class="small muted mt">Marca el pago sin despachar (para hacerlo desde el celular cuando llega el comprobante). Al despachar en la compu ya figura pagado.</div>';
  // Pago: se marca acá mismo, junto con la salida
  const conP = conPago(t) || t === 'guardado';
  const porCob = conP ? ps.filter(porCobrar) : [];
  const yaPag = conP ? ps.filter(p => p.pago) : [];
  let pago = '';
  if (yaPag.length) pago += `<div class="small mt" style="color:var(--ok)">✓ Ya pagó: ${yaPag.map(p => '#' + p.num + ' (' + esc(p.pago.cuenta) + (p.pago.conEnvio ? ', con envío' : '') + ')').join(' · ')}</div>`;
  if (porCob.length) {
    const tar = +cfg('tarifaEnvio') || 0, base = porCob.reduce((s2, p) => s2 + calc(p).total, 0), env = (t === 'cadeteria' || t === 'pago') && f.conEnvio ? tar : 0, esp = esperadoDe(base, env, f.cuenta), dosV = f.dos && f.cuenta2 ? esperadoDos(base, env, f.cuenta, f.cuenta2, f.monto2) : null, auto = dosV && dosV.ok ? dosV.tot1 : esp.total;
    const ctas = cuentasPago(), extra = f.cuenta && f.cuenta !== 'sin' && !ctas.includes(f.cuenta) ? [f.cuenta] : [];
    pago += `<label class="lb mt">¿Cómo pagó${porCob.length < ps.length ? ' ' + numsTxt(porCob) : ''}? *</label>
      <div class="row">${ctas.concat(extra).map(cta => `<button class="b sm seg${f.cuenta === cta ? ' on' : ''}" data-act="despCuenta" data-c="${esc(cta)}">${esc(cta)}</button>`).join('')}<button class="b sm gh" data-act="despCuenta" data-c="">Otra…</button>${t === 'pago' ? '' : `<button class="b sm seg${f.cuenta === 'sin' ? ' on' : ''}" data-act="despCuenta" data-c="sin">${t === 'guardado' ? '⏳ Sin pagar · con plazo' : 'Sin confirmar'}</button>`}</div>`;
    if (t === 'cadeteria' || t === 'pago') pago += `<div class="row mt"><button class="b sm seg${f.conEnvio ? ' on' : ''}" data-act="despConEnvio">${f.conEnvio ? '✓' : '＋'} La transferencia incluye el envío de cadetería (${fmt(tar)})</button></div>`;
    if (f.cuenta && f.cuenta !== 'sin') pago += `<div class="row mt"><label class="small muted" for="dsf-transf">${f.dos ? 'Entró por ' + esc(f.cuenta) : 'Monto transferido'}</label><input id="dsf-transf" type="number" inputmode="numeric" data-inp="despF" data-f="transf" value="${esc(f.transfEdit ? f.transf : String(auto))}" style="width:130px"><span class="small muted">${dosV && dosV.ok ? 'su parte ' + fmt(dosV.part1) : 'pedido ' + fmt(base)}${env ? ' + envío ' + fmt(env) : ''}${(dosV && dosV.ok ? dosV.rec1 : esp.rec) ? ' + Mercado Pago ' + recargoMP() + '% ' + fmt(dosV && dosV.ok ? dosV.rec1 : esp.rec) : ''}</span></div>`;
    if (f.cuenta && f.cuenta !== 'sin') pago += dosHTML(f, ctas, dosV);
    if (f.cuenta === 'sin' && t === 'guardado') { const plz = f.plazo || sumarDias(hoyISO(), 3); pago += `<div class="row mt"><label class="small muted" for="dsf-plazo">Guardado sin pagar hasta</label><input type="date" id="dsf-plazo" min="${hoyISO()}" data-inp="despF" data-f="plazo" value="${esc(plz)}" style="width:auto"><button class="b sm" data-act="despPlazo" data-d="3">+3 días</button><button class="b sm" data-act="despPlazo" data-d="7">+7 días</button></div><div class="small muted mt">No recibe recordatorios. Al vencer aparece en "Para liberar" para que decidas vos.</div>`; }
    else if (f.cuenta === 'sin') pago += '<div class="small muted mt">Sale sin pago marcado: queda anotado en el paquete.</div>';
  }
  if (t === 'pago' && !porCob.length) pago += '<div class="small muted mt">Los pedidos tildados ya tienen el pago marcado.</div>';
  const bloqueado = !t || (porCob.length && !f.cuenta && t !== 'guardado') || (porCob.length && f.cuenta !== 'sin' && f.dos && !(f.cuenta2 && (dosV0(porCob, t, f) || {}).ok)) || (t === 'pago' && (!porCob.length || f.cuenta === 'sin'));
  const cobro = t === 'cadeteria' ? (f.cobro === 'pago' ? ' · envío pago' : f.cobro === 'monto' ? (num(f.monto) > 0 ? ' · cobra ' + fmt(num(f.monto)) : '') : f.cobro === 'cobrar' ? ' · cobra ' + fmt(cfg('tarifaEnvio')) : '') : '';
  const txt = !t ? 'Elegí cómo sale' : { retiro: `✓ Entregar ${n > 1 ? n + ' pedidos' : 'el pedido'}`, agencia: `📦 Despachar por agencia${n > 1 ? ' · ' + n + ' pedidos, 1 etiqueta' : ''}`, cadeteria: `🚴 Despachar por cadetería${cobro}`, guardado: porCob.length && f.cuenta === 'sin' ? `⏸️ Guardar sin pagar hasta el ${fechaUY(f.plazo || sumarDias(hoyISO(), 3), 1)}` : porCob.length && f.cuenta ? `⏸️ Guardar y marcar pago · ${esc(f.cuenta)}` : `⏸️ Guardar ${n > 1 ? n + ' pedidos' : 'el pedido'}`, liberado: `❌ Liberar ${n > 1 ? n + ' pedidos' : 'el pedido'}`, pago: '💸 Marcar pago' }[t];
  return `<div class="card dsp-sal"><div class="card-t">${t === 'pago' ? 'Pago' : '¿Cómo sale' + (n > 1 ? 'n' : '') + '?'} · ${numsTxt(ps)}</div>
    <div class="dsp-segs">${segs}</div>${form}${pago}
    <button class="b ${t === 'liberado' ? 'dan' : 'ok'} lg blk mt" id="dsp-go" data-act="despGo"${bloqueado ? ' disabled' : ''}>${txt}</button></div>`;
}

// ─── Acciones ─────────────────────────────────────────────────
/** Abre la clienta. ids = pedidos a tildar; tipo = salida sugerida. */
function abrirClientaDesp(cid, ids, tipo) {
  const D = UI.desp, ab = abiertosDe(cid);
  D.cid = cid; D.sinPago = false; D.aviso = '';
  D.sel = new Set(ids ? ids.filter(id => ab.some(p => p.id === id)) : ab.length === 1 ? [ab[0].id] : []);
  if (ids && ab.length > D.sel.size) { const otros = ab.filter(p => !D.sel.has(p.id)); D.aviso = `🔗 Tiene ${otros.length > 1 ? otros.length + ' pedidos más abiertos' : 'otro pedido abierto'}: ${numsTxt(otros)}. Tildalos si van juntos.`; }
  if (!tipo && D.sel.size) { const ts = new Set([...D.sel].map(id => entregaEf(pedById(id)))); if (ts.size === 1) tipo = [...ts][0]; }
  elegirSalida(ENVIOS.has(tipo) ? tipo : null);
  if (esTactil() && D.sel.size && [...D.sel].map(pedById).some(p => p && porCobrar(p))) D.salida = 'pago';
  D.q = ''; const q = $('#dsp-q'); if (q) q.value = '';
  cerrarSug();
  render();
  window.scrollTo(0, 0);
}
function elegirSalida(t) {
  const D = UI.desp, c = cliById(D.cid) || {}, ps = [...D.sel].map(pedById).filter(Boolean);
  D.salida = t;
  const m = ps.length ? principal(ps) : null;
  D.f = { agencia: c.agencia || '', nombreEnvio: c.nombreEnvio || '', ci: c.ci || '', ciudad: c.ciudad || '', depto: c.depto || '', direccion: c.direccion || '', barrio: c.barrio || '', notaCadete: c.notaCadete || '',
    tipo: ps.some(p => tipoEnvioDe(p) === 'cambio') ? 'cambio' : 'comun',
    cobro: m && m.cobroEnvio && m.entrega === 'cadeteria' ? m.cobroEnvio : null, monto: m && m.cobroMonto ? String(m.cobroMonto) : '',
    cuenta: (D.f && D.f.cuenta) || null, plazo: '', dos: !!(D.f && D.f.dos), cuenta2: (D.f && D.f.cuenta2) || null, monto2: (D.f && D.f.monto2) || '', conEnvio: false, transf: '', transfEdit: false };
}
function cerrarClientaDesp() { const D = UI.desp; D.cid = null; D.sel = new Set(); D.salida = null; D.f = {}; D.aviso = ''; D.sinPago = false; }
function focoBuscar() { setTimeout(() => { const q = $('#dsp-q'); if (q && UI.tab === 'despacho') q.focus(); }, 30); }

/** Crea el paquete, pasa los pedidos a enviado y guarda todo. Devuelve el paquete. */
function crearPaquete(c, ps, tipo, f, sinPago) {
  const m = principal(ps);
  const cobro = tipo === 'cadeteria' ? (f.cobro === 'pago' ? 0 : f.cobro === 'monto' ? num(f.monto) : +cfg('tarifaEnvio') || 0) : null;
  const envio = tipo === 'agencia' ? { nombre: c.nombreEnvio || c.nombre, tel: c.tel || '', agencia: c.agencia, ci: c.ci || '', ciudad: c.ciudad || '', depto: c.depto || '', direccion: c.direccion || '' }
    : tipo === 'cadeteria' ? { nombre: c.nombreEnvio || c.nombre, tel: c.tel || '', direccion: c.direccion || '', barrio: c.barrio || '', nota: c.notaCadete || '' }
    : { nombre: c.nombre, tel: c.tel || '' };
  const k = { id: uid('k'), tipo, fecha: ahoraISO(), pedidos: ps.map(p => p.id), nums: ps.map(p => p.num), clienteId: c.id, principal: m.id, codigo: m.codigo,
    cobro, tipoEnvio: tipo === 'cadeteria' ? (f.tipo || 'comun') : null, envio, sinPago: sinPago || [], grisalOrden: null,
    antes: ps.map(p => ({ id: p.id, estado: p.estado, entrega: p.entrega || 'sin_definir', cobroEnvio: p.cobroEnvio ?? null, cobroMonto: p.cobroMonto ?? 0, tipoEnvio: p.tipoEnvio ?? null, fechas: Object.assign({}, p.fechas) })) };
  for (const p of ps) {
    p.entrega = tipo;
    if (tipo === 'cadeteria') { p.cobroEnvio = f.cobro; p.cobroMonto = f.cobro === 'monto' ? num(f.monto) : 0; p.tipoEnvio = k.tipoEnvio; }
    setEstado(p, 'enviado');
    p.salida = { id: k.id, ts: k.fecha, tipo };
    p.paqueteId = k.id;
    if (p !== m) p.salioCon = m.id; else delete p.salioCon;
  }
  DB.paquetes.push(k);
  savePaquetes(); guardar();
  return k;
}
/** Marca el pago de estos pedidos con la cuenta elegida. El pedido más nuevo lleva el envío (si la transferencia lo incluye)
 *  y la diferencia con lo calculado, así la suma da lo transferido. */
function registrarPagos(ps, f, conEnvio, paquete) {
  const tar = +cfg('tarifaEnvio') || 0, env = conEnvio ? tar : 0;
  const base = ps.reduce((s2, p) => s2 + calc(p).total, 0);
  let dos = f.cuenta2 && f.cuenta2 !== f.cuenta && num(f.monto2) > 0 ? esperadoDos(base, env, f.cuenta, f.cuenta2, f.monto2) : null;
  if (dos && !dos.ok) dos = null;
  const esp = dos ? { rec: dos.rec1, total: dos.tot1 } : esperadoDe(base, env, f.cuenta);
  const transf = f.transfEdit || f.transf !== undefined && f.transf !== '' && f.origen === 'mabel' ? num(f.transf) : esp.total;
  const orden = [...ps].sort((a, b) => (a.fechas.creado || '').localeCompare(b.fechas.creado || '') || a.num - b.num);
  const gs = orden.map(p => marcarPago(p, f.cuenta, f.origen || (paquete ? 'despacho' : 'pago')));
  const g0 = gs[gs.length - 1];
  const extra = [];
  if (dos) {
    // Reparte: lo que pagó por el 2º medio se saca de las filas, de la última hacia atrás (el envío entra en la última fila)
    const splitId = uid('s');
    g0.monto = (+g0.monto || 0) + env;
    let falta = dos.part2;
    for (const g of [...gs].reverse()) {
      if (falta <= 0) break;
      const m = Math.min(falta, +g.monto || 0); if (m <= 0) continue;
      const h = { id: uid('g'), pedidoId: g.pedidoId, clienteId: g.clienteId, cuenta: f.cuenta2, medio: medioDe(f.cuenta2), monto: m, fecha: g.fecha, origen: g.origen, antes: g.antes, splitId };
      g.monto -= m; falta -= m; DB.pagos.push(h); extra.push(h);
    }
    if (extra[0]) extra[0].monto += dos.rec2;
    gs.forEach(g => { g.splitId = splitId; });
    orden.forEach(p => { p.pago.cuenta = f.cuenta + ' + ' + f.cuenta2; });
    g0.envio = env; g0.recargo = dos.rec; g0.esperado = dos.total; g0.ajuste = transf - dos.tot1; g0.monto = (+g0.monto || 0) + dos.rec1 + g0.ajuste;
  } else {
    // envio = lo que incluye de cadetería · recargo = Mercado Pago · ajuste = diferencia contra lo esperado · monto = lo realmente transferido (sumando las filas)
    g0.envio = env; g0.recargo = esp.rec; g0.esperado = esp.total; g0.ajuste = transf - esp.total; g0.monto = (+g0.monto || 0) + env + esp.rec + g0.ajuste;
  }
  if (f.nota) g0.nota = String(f.nota).slice(0, 200);
  gs.push(...extra);
  if (f.cobroId) gs.forEach(g => { g.cobroId = f.cobroId; });
  if (f.comprobante) g0.comprobante = f.comprobante;
  if (paquete) gs.forEach(g => { g.paqueteId = paquete.id; });
  if (conEnvio && !paquete) orden.forEach(p => { p.pago.conEnvio = true; p.entrega = 'cadeteria'; p.cobroEnvio = 'pago'; p.cobroMonto = 0; }); // pagó el envío de cadetería: sale por cadetería
  savePagos(); guardar();
  return gs;
}
function despGo() {
  const D = UI.desp, c = cliById(D.cid), t = D.salida, f = D.f;
  const ps = [...D.sel].map(pedById).filter(p => p && sinSalir(p));
  if (!c || !ps.length || !t) return;
  if (t === 'guardado' || t === 'liberado') {
    if (t === 'liberado' && !confirm(`¿Liberar ${numsTxt(ps)} de ${c.nombre}?\n\nLa ropa vuelve al stock y queda como deuda en la ficha.`)) return;
    let extra = '', gsId = [];
    if (t === 'guardado') {
      const pc = ps.filter(porCobrar);
      if (pc.length && f.cuenta && f.cuenta !== 'sin') { gsId = registrarPagos(pc, f, false, null).map(g => g.id); extra = ' · pagó por ' + esc(f.cuenta) + (f.dos && f.cuenta2 ? ' + ' + esc(f.cuenta2) : ''); }
      if (pc.length && f.cuenta === 'sin') { const hasta = f.plazo || sumarDias(hoyISO(), 3); if (hasta < hoyISO()) return toast('La fecha ya pasó'); aplicarPlazo(pc.map(p => p.id), hasta); extra = ' · sin pagar hasta el ' + fechaUY(hasta, 1); }
    }
    ps.filter(p => p.estado !== t).forEach(p => setEstado(p, t));
    guardar();
    D.res = t === 'guardado' ? { cls: 'mu', html: `⏸️ Guardado${ps.length > 1 ? 's' : ''} ${numsTxt(ps)} · ${esc(c.nombre)}${extra}`, cid: c.id, pagos: gsId } : { cls: 'li', html: `❌ Liberado${ps.length > 1 ? 's' : ''} ${numsTxt(ps)} · ${esc(c.nombre)}`, cid: c.id };
    cerrarClientaDesp(); render(); focoBuscar(); return;
  }
  const porCob = ps.filter(porCobrar);
  if (t === 'pago') {
    if (!porCob.length || !f.cuenta || f.cuenta === 'sin') return toast('Elegí la cuenta');
    const gs = registrarPagos(porCob, f, f.conEnvio);
    const tot = gs.reduce((s2, g) => s2 + (+g.monto || 0), 0);
    D.res = { cls: 'ok', html: `💸 ${esc(c.nombre)} pagó ${fmt(tot)}<div style="font-size:15px;margin-top:4px">${numsTxt(porCob)} · ${esc(f.cuenta)}${f.dos && f.cuenta2 ? ' + ' + esc(f.cuenta2) : ''}${f.conEnvio ? ' · con envío' : ''}</div>`, cid: c.id, pagos: gs.map(g => g.id) };
    cerrarClientaDesp(); render(); focoBuscar(); window.scrollTo(0, 0); return;
  }
  if (porCob.length && !f.cuenta) return toast('Elegí cómo pagó (o "Sin confirmar") antes de despachar');
  if (t === 'agencia') {
    const falta = []; if (!String(f.agencia || '').trim()) falta.push('la agencia'); if (!String(f.ciudad || '').trim()) falta.push('la ciudad');
    if (falta.length) return alert('⚠️ No salió.\n\nFalta cargar ' + falta.join(' y ') + '.');
    editarClienta(c, { agencia: f.agencia, nombreEnvio: f.nombreEnvio, ci: f.ci, ciudad: f.ciudad, depto: f.depto, direccion: f.direccion });
  }
  if (t === 'cadeteria') {
    const falta = faltaCadeteria(f.direccion, f.cobro, f.monto);
    if (falta.length) return alert('⚠️ No salió.\n\nFalta cargar ' + falta.join(' y ') + '.');
    if (f.barrio && !barrioCanon(f.barrio)) return alert('⚠️ "' + f.barrio + '" no está en la lista de barrios de GrisalExpress.\n\nElegilo de las sugerencias o dejalo vacío.');
    editarClienta(c, { nombreEnvio: f.nombreEnvio, direccion: f.direccion, barrio: f.barrio, notaCadete: f.notaCadete });
  }
  const k = crearPaquete(c, ps, t, f, f.cuenta === 'sin' ? porCob.map(p => p.id) : []);
  if (porCob.length && f.cuenta !== 'sin') {
    const gs = registrarPagos(porCob, f, t === 'cadeteria' && f.conEnvio, k);
    k.pagos = gs.map(g => g.id); k.transferido = gs.reduce((s2, g) => s2 + (+g.monto || 0), 0); k.cuenta = f.dos && f.cuenta2 ? f.cuenta + ' + ' + f.cuenta2 : f.cuenta;
    savePaquetes();
  }
  D.res = { paqId: k.id };
  cerrarClientaDesp(); render();
  if (t === 'retiro') focoBuscar(); else setTimeout(() => { const b = $('#dsp-print'); if (b) b.focus(); }, 30);
}
function deshacerPaquete(id) {
  const k = paqById(id); if (!k) return;
  const c = cliById(k.clienteId) || { nombre: '?' };
  if (!confirm(`¿Deshacer la salida de ${c.nombre} (${k.nums.map(n => '#' + n).join(' · ')})?\n\nLos pedidos vuelven a como estaban y se anula el pago marcado al despachar.`)) return;
  (k.pagos || []).forEach(anularPago);
  if ((k.pagos || []).length) savePagos();
  for (const a of k.antes || []) {
    const p = pedById(a.id); if (!p || p.paqueteId !== k.id) continue;
    setEstado(p, a.estado);
    p.entrega = a.entrega; p.cobroEnvio = a.cobroEnvio; p.cobroMonto = a.cobroMonto;
    if (a.tipoEnvio == null) delete p.tipoEnvio; else p.tipoEnvio = a.tipoEnvio;
    p.fechas = Object.assign({}, a.fechas);
    delete p.salida; delete p.paqueteId; delete p.salioCon;
  }
  DB.paquetes = DB.paquetes.filter(x => x.id !== id);
  savePaquetes(); guardar();
  UI.desp.res = { cls: 'mu', html: `↩️ Se deshizo la salida de ${esc(c.nombre)}`, cid: c.id };
  render();
}
/** Una etiqueta por paquete: la del pedido principal, con el número y los artículos de todo el paquete. */
function etqPaqueteHTML(k) {
  const ps = k.pedidos.map(pedById).filter(Boolean), m = pedById(k.principal) || ps[0];
  if (!m) return '';
  const v = Object.assign({}, m, { num: ps.length > 1 ? ps.map(p => p.num).join('+') : m.num, prendas: ps.flatMap(p => p.prendas || []) });
  if (!ps.every(p => p.cambio)) v.cambio = null;
  if (k.tipo === 'cadeteria') { v.cobroEnvio = k.cobro ? 'monto' : 'pago'; v.cobroMonto = k.cobro || 0; v.tipoEnvio = k.tipoEnvio || 'comun'; return etqCadeteHTML(v); }
  if (k.tipo === 'agencia') return etqAgenciaHTML(Object.assign({}, cliById(k.clienteId) || {}, k.envio || {}));
  return etqHTML(v);
}
/** Etiqueta 10×15 de agencia (diseño aprobado el 29/10): logo EMMA, INDUMENTARIA grande, Tel y RUT de Emma, destinatario, datos con
 *  íconos (el pin va una sola vez: ciudad + departamento si es distinto; dirección solo si hay) y abajo SOLO el nombre de la agencia.
 *  Medidas en "px del diseño" (1024×1536); ETQ_U las pasa a mm. Sin QR, sin número ni artículos. */
const ETQ_U = 0.096639;
const _eu = n => (n * ETQ_U).toFixed(3) + 'mm';
function etqAncho(txt, peso, px) {
  try {
    if (document.fonts && document.fonts.check(peso + ' 100px Poppins')) {
      const cv = etqAncho.cv || (etqAncho.cv = document.createElement('canvas').getContext('2d'));
      cv.font = peso + ' ' + px + 'px Poppins';
      return cv.measureText(txt).width;
    }
  } catch (e) { /* cae al cálculo aproximado */ }
  return txt.length * px * (peso >= 700 ? 0.72 : 0.68);
}
function etqFit(txt, peso, max, maxW) { const w = etqAncho(txt, peso, max); return w > maxW ? max * maxW / w : max; }
function etqNombre2(nombre) {
  const ws = String(nombre || '').trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (ws.length <= 1) return [ws.join(' ')];
  let best = [ws.join(' ')], bd = 1e9;
  for (let i = 1; i < ws.length; i++) {
    const a = ws.slice(0, i).join(' '), b = ws.slice(i).join(' '), d = Math.abs(a.length - b.length);
    if (d < bd) { bd = d; best = [a, b]; }
  }
  return best;
}
function etqAgenciaHTML(d) {
  const ciudad = String(d.ciudad || '').trim(), depto = String(d.depto || '').trim();
  let ub = ciudad;
  if (depto && depto.toLowerCase() !== ciudad.toLowerCase()) ub = ciudad ? ciudad + ', ' + depto : depto;
  ub = (ub || '________').toUpperCase();
  const lineas = etqNombre2(d.nombre || d.nombreEnvio || '');
  const nomS = Math.min(128, ...lineas.map(l => etqFit(l || ' ', 700, 128, 830)));
  const nomL = nomS * 0.7 + 30;
  const dir = String(d.direccion || '').trim(), conDir = !!dir, pitch = conDir ? 80 : 98;
  const ubS = etqFit(ub, 400, 54, 730);
  const ag = String(d.agencia || '________').toUpperCase();
  const agS = etqFit(ag, 700, 128, 740);
  const conS = etqFit('Tel 097 088 511  ·  RUT 219683210010', 500, 34, 672);
  const im = k => `<img src="${ETQ_IMG[k].src}" style="width:${_eu(ETQ_IMG[k].w)};height:${_eu(ETQ_IMG[k].h)}" alt="">`;
  const fila = (k, txt, sz) => `<div class="ag2-r" style="height:${_eu(pitch)}"><div class="ag2-ic">${im(k)}</div><div class="ag2-rt" style="font-size:${_eu(sz)}">${esc(txt)}</div></div>`;
  return `<div class="lbl ag2"><div class="ag2-in">
    <div class="ag2-c" style="top:${_eu(74)}">${im('emma')}</div>
    <div class="ag2-c" style="top:${_eu(257.3)};font-size:${_eu(98)};font-weight:500;letter-spacing:-.0462em;text-indent:${_eu(-4.5)}">INDUMENTARIA</div>
    <div class="ag2-c" style="top:${_eu(361.1)};font-size:${_eu(conS)};font-weight:500">Tel 097 088 511  ·  RUT 219683210010</div>
    <div class="ag2-hr" style="left:${_eu(72)};top:${_eu(434)};width:${_eu(347)}"></div>
    <div class="ag2-hr" style="left:${_eu(533)};top:${_eu(434)};width:${_eu(347)}"></div>
    <div class="ag2-c" style="top:${_eu(436 - ETQ_IMG.heart.h / 2)}">${im('heart')}</div>
    <div class="ag2-fl">
      <div class="ag2-lab">DESTINATARIO</div>
      <div class="ag2-nom" style="font-size:${_eu(nomS)};line-height:${_eu(nomL)}">${lineas.map(l => esc(l)).join('<br>')}</div>
      <div style="margin-top:${_eu(conDir ? 19 : 45)}">
        ${fila('person', 'C.I. ' + (d.ci || '________'), 54)}
        ${fila('phone', 'Tel  ' + (d.tel || '________'), 54)}
        ${fila('pin', ub, ubS)}
        ${conDir ? `<div class="ag2-dir">${esc(dir)}</div>` : ''}
      </div>
    </div>
    <div class="ag2-box" style="font-size:${_eu(agS)}">${esc(ag)}</div>
  </div></div>`;
}
// En hoja A4, cada etiqueta de agencia sale sola en su hoja, con el mismo tamaño y diseño que la térmica 10×15
const _hojasHTMLbase = hojasHTML;
hojasHTML = function (etiquetas) {
  if (cfg('formatoImpresion') === 'termica') return _hojasHTMLbase(etiquetas);
  const sola = e => e.includes('lbl ag2') || e.includes('lbl grs'), ag = etiquetas.filter(sola), resto = etiquetas.filter(e => !sola(e));
  return (resto.length ? _hojasHTMLbase(resto) : '') + ag.map(e => `<div class="sheet-t a4ag">${e}</div>`).join('');
};
// Etiqueta de pedido con agencia (desde Pedidos): el mismo diseño nuevo
const _etqHTMLbase = etqHTML;
etqHTML = function (p) {
  const c = cliById(p.clienteId);
  return c && c.agencia ? etqAgenciaHTML(Object.assign({}, c, { nombre: c.nombreEnvio || c.nombre })) : _etqHTMLbase(p);
};
async function imprimirPaquete(id) {
  const k = paqById(id); if (!k) return;
  // Cadetería con Grisal conectado: primero pasa la fila a la planilla (si no está) y después imprime SU etiqueta, con el QR que lee el cadete
  if (k.tipo === 'cadeteria' && grisalConectado()) {
    if (!k.grisalEnviado && !k.grisalCopiado) { const ok = await pasarAGrisal([k]); if (!ok) return; }
    if (k.grisalOrden) return imprimir(hojasHTML([etqGrisalHTML(k)]), 'etiquetas');
  }
  imprimir(hojasHTML([etqPaqueteHTML(k)]), 'etiquetas');
}
// ── GrisalExpress: filas de los paquetes de cadetería de hoy, listas para pegar ──
async function copiarGrisalHoy() {
  const ks = paquetesDeHoy().filter(k => k.tipo === 'cadeteria').reverse();
  if (!ks.length) return toast('Hoy no salió nada por cadetería');
  let usar = ks.filter(k => !k.grisalCopiado);
  if (!usar.length) { if (!confirm(`Las ${ks.length} de hoy ya se copiaron. ¿Copiarlas todas de nuevo?`)) return; usar = ks; }
  const [y, mo, d] = hoyISO().split('-'), fecha = d + '/' + mo + '/' + y.slice(2);
  const filas = usar.map(k => {
    const c = cliById(k.clienteId) || {}, e = k.envio || {};
    return ['', k.tipoEnvio === 'cambio' ? 'Cambio' : 'Común', e.nombre || c.nombreEnvio || c.nombre || '', telLegible(e.tel || c.tel), e.direccion || c.direccion || '', e.barrio || c.barrio || '', k.cobro || 0, 'Paquete chico', fecha, e.nota || c.notaCadete || ''].map(limpioTSV);
  });
  const txt = filas.map(f => f.join('\t')).join('\n');
  const ok = await copiarTexto(txt);
  if (!ok) showModal(`<h3>📋 Copiá a mano</h3><p class="small muted mb">El navegador no dejó copiar solo. Seleccioná todo y copiá:</p><textarea style="min-height:200px;font-family:var(--mono);font-size:12px" onfocus="this.select()">${esc(txt)}</textarea><div class="row mt"><span class="grow"></span><button class="b pri" data-act="closeModal">Listo</button></div>`);
  const ts = ahoraISO(); usar.forEach(k => { k.grisalCopiado = ts; });
  savePaquetes();
  if (ok) toast(`📋 ${filas.length} fila${filas.length > 1 ? 's' : ''} copiada${filas.length > 1 ? 's' : ''} · pegalas en la columna N Orden de GrisalExpress`, 5000);
  render();
}
function hojaCadeteHoy() {
  const ids = paquetesDeHoy().filter(k => k.tipo === 'cadeteria').reverse().flatMap(k => k.pedidos);
  if (!ids.length) return toast('Hoy no salió nada por cadetería');
  imprimir(hojaCadeteHTML({ escaneados: ids }, false), 'hoja');
}
function verPedidoDesp(id) {
  const p = pedById(id); if (!p) return;
  const c = cliById(p.clienteId) || { nombre: '?' }, l = liveById(p.liveId) || { nombre: '?' }, t = calc(p);
  const cuerpo = p.cambio
    ? `<div class="box small"><div>⬅️ <b>Entró:</b> ${esc(p.cambio.entra.join(', ') || '—')}</div><div style="margin-top:4px">➡️ <b>Sale:</b> ${esc(p.cambio.sale.join(', ') || '—')}</div></div>`
    : (p.prendas.length ? p.prendas.map(pr => `<div class="pr"><div class="pr-n">${esc(pr.nombre)}${pr.codigo ? '<small>' + esc(pr.codigo) + '</small>' : ''}</div><span class="mono">x${pr.qty || 1}</span><div class="pr-p">${precioHTML(pr)}</div></div>`).join('') : '<div class="small muted">Sin prendas</div>')
      + (typeof descLineasHTML === 'function' ? descLineasHTML(t) : t.descMonto ? `<div class="tot-l" style="color:var(--ac)"><span>🎉 Descuento ${t.desc}%</span><span>−${fmt(t.descMonto)}</span></div>` : '')
      + (t.saldo ? `<div class="tot-l" style="color:var(--ok)"><span>💰 Saldo a favor</span><span>−${fmt(t.saldo)}</span></div>` : '')
      + `<div class="tot-l big"><span>Total</span><span>${fmt(t.total)}</span></div>`;
  showModal(`<h3>#${p.num} · ${esc(c.nombre)}</h3>
    <div class="small muted mb">${esc(l.nombre)} · ${fechaUY(p.fechas.creado || l.fecha)} · código <span class="mono">${p.codigo}</span> · ${ESTADO_TXT[p.estado]}</div>
    ${cuerpo}
    ${p.pago ? `<div class="alert ok">✓ Pagó por ${esc(p.pago.cuenta)} el ${fechaUY(localISO(new Date(p.pago.fecha)))}</div>` : ''}
    ${p.notas ? `<div class="alert pe">📝 ${esc(p.notas)}</div>` : ''}
    <div class="row mt"><button class="b gh" data-act="irPedido" data-id="${p.id}">Abrir en Live</button><span class="grow"></span><button class="b pri" data-act="closeModal">Cerrar</button></div>`);
}

// ── Búsqueda y escaneo ──
function cerrarSug() { const s = $('#dsp-sug'); if (s) s.classList.remove('on'); UI.desp.items = []; }
function despSug() {
  const D = UI.desp, q = D.q.trim(), sug = $('#dsp-sug'); if (!sug) return;
  if (!q) return cerrarSug();
  const items = [];
  const dig = q.replace(/\D/g, '');
  if (/^\d{3,6}$/.test(q)) { const p = todosPedidos().find(x => x.codigo === dig.padStart(5, '0')); if (p) items.push({ p }); }
  if (!esGrisal(q)) {
    const cs = buscarClientas(q).map(c => ({ c, n: abiertosDe(c.id).length }));
    cs.sort((a, b) => (b.n > 0) - (a.n > 0));
    items.push(...cs);
  }
  D.items = items; D.idx = 0;
  if (!items.length) { sug.innerHTML = `<div class="si" style="cursor:default;color:var(--mu)">${esGrisal(q) ? 'Enter para buscar la etiqueta de GrisalExpress' : 'Sin resultados'}</div>`; sug.classList.add('on'); return; }
  const m = stats();
  sug.innerHTML = items.map((it, i) => it.p
    ? `<div class="si${i === 0 ? ' hi' : ''}" data-act="despPick" data-i="${i}">🏷️ Pedido <b>#${it.p.num}</b> · ${esc((cliById(it.p.clienteId) || {}).nombre || '?')} <span class="chip ${ESTADO_CHIP[it.p.estado]}">${ESTADO_TXT[it.p.estado]}</span><div class="sub">código ${it.p.codigo} · ${esc((liveById(it.p.liveId) || {}).nombre || '')}</div></div>`
    : `<div class="si${i === 0 ? ' hi' : ''}" data-act="despPick" data-i="${i}"><b>${nomAlias(it.c)}</b> ${histHTML(m[it.c.id])}<div class="sub">${it.c.tel ? esc(it.c.tel) : 'sin tel'} · ${it.n ? `<span style="color:var(--pe)">${it.n} sin salida</span>` : 'nada pendiente'}</div></div>`).join('');
  sug.classList.add('on');
}
function despPick(i) {
  const it = UI.desp.items[i]; if (!it) return;
  if (it.p) return abrirPorCodigo(it.p);
  abrirClientaDesp(it.c.id);
}
/** Escaneo o código: si es un retiro pagado y no tiene otros abiertos, se entrega directo. */
function abrirPorCodigo(p) {
  const D = UI.desp, c = cliById(p.clienteId) || { nombre: '?', id: null };
  D.q = ''; const q = $('#dsp-q'); if (q) q.value = '';
  cerrarSug();
  if (p.estado === 'enviado') {
    const k = p.paqueteId && paqById(p.paqueteId);
    const como = k ? { retiro: '🏠 se entregó', agencia: '📦 salió por agencia', cadeteria: '🚴 salió por cadetería' }[k.tipo] : '🚚 salió';
    D.res = { cls: 'mu', html: `#${p.num} ${esc(c.nombre)}: ya ${como} el ${fechaUY(p.fechas.enviado)}${k && k.nums.length > 1 ? ' (junto con ' + esc(k.nums.filter(n => n !== p.num).map(n => '#' + n).join(' · ')) + ')' : ''}`, cid: c.id };
    cerrarClientaDesp(); render(); focoBuscar(); return;
  }
  if (!esActivo(p.estado)) {
    D.res = { cls: 'li', html: `⚠️ #${p.num} ${esc(c.nombre)} está ${ESTADO_TXT[p.estado].toUpperCase()}`, cid: c.id };
    cerrarClientaDesp(); render(); focoBuscar(); return;
  }
  const ab = abiertosDe(p.clienteId);
  if (entregaEf(p) === 'retiro' && !porCobrar(p) && ab.length === 1) {
    const k = crearPaquete(c, [p], 'retiro', {}, []);
    D.res = { paqId: k.id };
    cerrarClientaDesp(); render(); focoBuscar(); return;
  }
  abrirClientaDesp(p.clienteId, [p.id]);
}
function buscarEnter() {
  const D = UI.desp, q = D.q.trim(); if (!q) return;
  if (esGrisal(q)) {
    const Q = q.trim().toUpperCase(), orden = Q.replace(/^(EMA)?EMMA/, ''), sinEma = Q.replace(/^EMA(?=EMMA)/, '');
    const k = (DB.paquetes || []).find(x => x.grisalOrden && [Q, orden, sinEma].includes(x.grisalOrden.toUpperCase()));
    D.q = ''; $('#dsp-q').value = ''; cerrarSug();
    if (k) { const p = pedById(k.principal); if (p) return abrirPorCodigo(p); }
    D.res = { cls: 'pe', html: `Etiqueta de GrisalExpress ${esc(orden)}: todavía no está vinculada a un paquete` };
    render(); focoBuscar(); return;
  }
  const dig = q.replace(/\D/g, '');
  if (/^\d{4,6}$/.test(q)) {
    const p = todosPedidos().find(x => x.codigo === dig.padStart(5, '0'));
    if (p) return abrirPorCodigo(p);
    D.q = ''; $('#dsp-q').value = ''; cerrarSug();
    D.res = { cls: 'li', html: `❌ ${esc(dig.padStart(5, '0'))}: no hay ningún pedido con ese código` };
    render(); focoBuscar(); return;
  }
  if (!D.items.length) despSug();
  if (D.items.length) despPick(Math.min(D.idx, D.items.length - 1));
}

Object.assign(ACT, {
  despPick: d => despPick(+d.i),
  despDarSalida: d => {
    const ids = String(d.ids || '').split(',').filter(Boolean); UI.desp.res = null;
    abrirClientaDesp(d.cid, ids, d.t);
    if (ENVIOS.has(d.t)) { elegirSalida(d.t); render(); }   // en el celu abre en "Solo pago": acá queremos la salida
  },
  despArmar: d => { const a = paraArmar()[d.t] || [], g = a.find(x => x.cid === d.cid); UI.desp.res = null; abrirClientaDesp(d.cid, g ? g.ps.map(p => p.id) : null, d.t); },
  despAbrir: d => { UI.desp.res = null; abrirClientaDesp(d.cid); },
  despCerrar: () => { cerrarClientaDesp(); render(); focoBuscar(); },
  despTog: (d, el, e) => {
    const D = UI.desp; D.sel.has(d.id) ? D.sel.delete(d.id) : D.sel.add(d.id);
    D.sinPago = false;
    if (D.sel.size && !D.salida) { const ts = new Set([...D.sel].map(id => entregaEf(pedById(id)))); if (ts.size === 1 && ENVIOS.has([...ts][0])) elegirSalida([...ts][0]); }
    render();
  },
  despTodos: () => { const D = UI.desp, ab = abiertosDe(D.cid); D.sel = D.sel.size === ab.length ? new Set() : new Set(ab.map(p => p.id)); D.sinPago = false; render(); },
  despVer: (d, el, e) => { if (e) e.stopPropagation(); verPedidoDesp(d.id); },
  despSal: d => {
    elegirSalida(d.k); render();
    setTimeout(() => { const el = d.k === 'agencia' ? $('#dsf-agencia') : d.k === 'cadeteria' ? $('#dsf-direccion') : $('#dsp-go'); if (el) { el.focus(); if (el.scrollIntoView) el.scrollIntoView({ block: 'center' }); } }, 30);
  },
  despFv: d => { UI.desp.f[d.f] = d.v; if (d.f === 'cobro' && d.v !== 'pago') UI.desp.f.conEnvio = false; render(); if (d.f === 'cobro' && d.v === 'monto') setTimeout(() => { const el = $('#dsf-monto'); if (el) el.focus(); }, 20); },
  despCuenta: d => {
    let cta = d.c;
    if (!cta) { cta = (prompt('¿En qué cuenta entró la transferencia?') || '').trim(); if (!cta) return; }
    const f = UI.desp.f; f.cuenta = f.cuenta === cta ? null : cta; if (f.cuenta2 === f.cuenta) f.cuenta2 = null; f.transfEdit = false; render();
  },
  despPlazo: d => { UI.desp.f.plazo = sumarDias(hoyISO(), +d.d); render(); },
  despDos: () => { const f = UI.desp.f; f.dos = !f.dos; if (!f.dos) { f.cuenta2 = null; f.monto2 = ''; } f.transfEdit = false; render(); },
  despCuenta2: d => { const f = UI.desp.f; f.cuenta2 = f.cuenta2 === d.c ? null : d.c; f.transfEdit = false; render(); setTimeout(() => { const el = $('#dsf-monto2'); if (el) el.focus(); }, 20); },
  despDeshacerPago: () => {
    const r = UI.desp.res; if (!r || !r.pagos) return;
    if (!confirm('¿Deshacer este pago?')) return;
    r.pagos.forEach(id => { const g = DB.pagos.find(x => x.id === id), p = g && pedById(g.pedidoId);
      if (p && p.pago && p.pago.conEnvio && p.estado !== 'enviado' && p.cobroEnvio === 'pago') { p.cobroEnvio = null; }
      anularPago(id); });
    savePagos(); guardar(); UI.desp.res = { cls: 'mu', html: '↩️ Pago deshecho', cid: r.cid }; render();
  },
  despConEnvio: () => {
    const f = UI.desp.f; f.conEnvio = !f.conEnvio;
    if (f.conEnvio) { f._cobroAntes = f.cobro; f.cobro = 'pago'; } else if (f.cobro === 'pago') f.cobro = f._cobroAntes === 'pago' ? 'pago' : (f._cobroAntes || null);
    f.transfEdit = false; render();
  },
  despVista: d => { UI.desp.vista = d.v; render(); },
  despFiltro: d => { UI.desp.filtro = UI.desp.filtro === d.t ? 'todos' : d.t; UI.desp.filtroHoy = null; render(); },
  despFiltroHoy: d => { UI.desp.filtroHoy = d.t; render(); },
  despGo: () => despGo(),
  despPrint: d => imprimirPaquete(d.k),
  despDeshacer: d => deshacerPaquete(d.k),
  despResX: () => { UI.desp.res = null; render(); focoBuscar(); },
  despGrisal: () => copiarGrisalHoy(),
  despGrisalPasar: () => pasarAGrisal(),
  despHoja: () => hojaCadeteHoy()
});
Object.assign(INP, {
  despQ: el => { UI.desp.q = el.value; despSug(); },
  despF: el => {
    UI.desp.f[el.dataset.f] = el.value;
    if (el.dataset.f === 'transf') UI.desp.f.transfEdit = true;
    if (el.dataset.f === 'plazo') { const b = $('#dsp-go'); if (b && el.value) b.textContent = '⏸️ Guardar sin pagar hasta el ' + fechaUY(el.value, 1); }
    if (el.dataset.f === 'monto2') {
      const D = UI.desp, f = D.f, porCob = [...D.sel].map(pedById).filter(p => p && sinSalir(p) && porCobrar(p)), v = dosV0(porCob, D.salida, f);
      const r = $('#dsf-dos-res'); if (r) r.innerHTML = dosResTxt(f, v);
      const b = $('#dsp-go'); if (b) b.disabled = !(v && v.ok);
      const tr = $('#dsf-transf'); if (tr && !f.transfEdit && v && v.ok) tr.value = String(v.tot1);
    }
    // El texto del botón de cadetería muestra el monto: se actualiza sin re-dibujar la pantalla
    if (el.dataset.f === 'monto') { const b = $('#dsp-go'); if (b && UI.desp.salida === 'cadeteria') b.textContent = '🚴 Despachar por cadetería' + (num(el.value) > 0 ? ' · cobra ' + fmt(num(el.value)) : ''); }
  }
});
document.addEventListener('keydown', e => {
  if (UI.tab !== 'despacho' || $('#modal').classList.contains('on')) return;
  const el = e.target;
  if (el.id === 'dsp-q') {
    const D = UI.desp, sug = $('#dsp-sug');
    if (e.key === 'ArrowDown' && D.items.length) { e.preventDefault(); D.idx = Math.min(D.idx + 1, D.items.length - 1); marcarSug(); }
    else if (e.key === 'ArrowUp' && D.items.length) { e.preventDefault(); D.idx = Math.max(D.idx - 1, 0); marcarSug(); }
    else if (e.key === 'Enter') { e.preventDefault(); buscarEnter(); }
    else if (e.key === 'Escape') { if (sug.classList.contains('on')) cerrarSug(); else if (D.cid) { cerrarClientaDesp(); render(); } }
    return;
  }
  if (e.key === 'Escape' && UI.desp.cid && !el.closest('.sw')) { cerrarClientaDesp(); render(); focoBuscar(); return; }
  // Lector de códigos: si el foco no está en un campo, lo que se escanea va al buscador
  const libre = el === document.body || el.tagName === 'BUTTON' || el.classList.contains('dsp-p');
  if (libre && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && /[\w]/.test(e.key) && e.key !== ' ') { const q = $('#dsp-q'); if (q) q.focus(); }
}, true);
function marcarSug() { document.querySelectorAll('#dsp-sug .si').forEach((x, i) => { x.classList.toggle('hi', i === UI.desp.idx); if (i === UI.desp.idx) x.scrollIntoView({ block: 'nearest' }); }); }
document.addEventListener('click', e => { if (!e.target.closest('#p-despacho .sw')) { const s = document.getElementById('dsp-sug'); if (s) s.classList.remove('on'); } });
window.addEventListener('afterprint', () => { if (UI.tab === 'despacho') focoBuscar(); });
// Al entrar a Despacho en la compu, el cursor queda listo para el lector (en el celular no, para no abrir el teclado)
const _actTab = ACT.tab;
ACT.tab = d => { _actTab(d); if (d.t === 'despacho' && window.matchMedia && matchMedia('(pointer:fine)').matches) focoBuscar(); };

// ── Etiqueta de agencia: logo e íconos (PNG negro con transparencia, embebidos) y precarga de fuente e imágenes ──
// Se cargan antes de imprimir para que la etiqueta salga completa (el área de impresión está oculta y no los pediría sola).
const ETQ_IMG = {"emma":{"w":678,"h":154,"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAqYAAACaCAQAAADRVULrAABgV0lEQVR42uW9ebwtR1Uv/l3Vvc+5NwljCFNEfhI0goDAT5EpKCF5zBIERcP4IAYeg0wyOjBqBJkJCoQgk0yKIIhMgohEAUEQCBEVZ5SZR8Z7z+nu9f7o2r1rWKuqeu/aF5Den+Tee87evburq1at4bu+XwIAEFYHATAAgAH+Ef50+W+DeQcB4FnvZ+/P1HvkYwDb7/S/m5z/c/AtBg0Ixrljnv4c7LlYPVd4sDfKDMpec/iZ8Kfjn+452Hk3ee+PzyCfObxCju6Ipp81IDAGmGj2+N/bg4X71cYJ3vnJm2nu0+ynJxqPa3iPy7+vnjNNdxc/P45GRBrL5VUu3+9+hzbiqedVcrjXSnZczDRDOXoKBgMGO1fHb5PnXcn6ys2V/Gfd2czOPCI0aKIn3Nl78p8wB9dMxbbDXzmkWiOK5jqU5yV8fys8rsae0jUkZvqqVpzg/hJJLeXUQvJvhwLDgbWM6RBtCtLEkK/T2GUNu3yH6d0Mgwbd7EkHxZCVfH79qT9/4aZHdTlPliZtOcKNMy+GaSlw8UbhPv9xkx63drJ/jobBYEAzPY11D95wzEhdcts/Vpu8sd/PwpgBJtgayue+NhvWm0f6qDR2/pC9p+VWOQBowHaFxd/KhbOahWcmb/6uA5F64onxaqOTNna3Gx8WOXZ6+RApYw6ayJytHn36GKKd1Yi/T01uOJuAiRacu4uSYKJXO/fofy4Nf+9899JzpWB0/AVGwgMPH77/+fTEZ9X4cMY46ROPozGgrKHzvSP2NpQBxi7vwfPapQ0kvPflfZC3CS7NqIEBTx6pQYM+a5wpa9xY+AQFBkbyYrh0eSWNF4nPhCbvOfaaONhKB3SgaVRWK4SsQzS6RIPoDYdXos1C8q6Ugs/B2zClpyDNf3I2hQEdDBiNveverjZy1iKpMa3va7vPh6INgJIbZnwfmnElJ0Yl9xriwGQZ3i7NUO+YKHIMHabdhLwlLXmz2z40/5cADNizwY4U3pJ4BgZwPG6ADgft1B7QoUMHBuNy+Cy+iBbGm8YlIYIfmlOxhwQxTEydI22cKRHuu4s5NMerOTK+OgB3woBDMOidic3o0aHDHhpchvNBaKbUiH9NoTlhe94dnASgxQG0aNCisV5Wh2PwNfyJMzN5mvpadJT3YVgM0XkNY+l+Tgt/ybl7CFuyZDDIe/+4tnp8H+40BcX7dn66T20Hf4/POakW9/s4ch9c40PCesnPPc4kj8IUDKFBh7viedgDo0GPBvtocAj3x2ewmBJqiJ4uss9TfgcljKNs9tPeuPtNRGgxoMH/jxY7WGCBHbRopjCtR4ceh3EZLsFhHMI+9iajMgSnZetNDM5XGFDgqQ4bmEpKvIO9bC5NQTpPd8KKr4HIOzXo8Kt4RuKafhj/aHf/Ab1wnvABSQvMzeF95xjTeALFxnSB1vrqr8fPZp7eJTgGBm00TiQYUwahQYvDOBEXJM75bDxxSsP0QgSFwoxaaEzlHNn2jKk0H6B4X8ufL8eScSX8Fw5kruWvcApgV6xuTONnT4rzkZp70nixkvUfN+QBAwwuxW70ni/g+tizMXIvZjVpDVOq58Q5kVRL+9vOb1sYEE7AX882cXvYxyF8DV9BB8aeNbPj/9nuhW6yHJ6J1YJ89yI5SK2PfrCZvOLQPR+m5dlMgeAV8HU8CYdAXrCTL4JRxuh/FlfGZWhBNlVenvGUjBwLIR9F+ax4qlJBOM+KAdaDpbj4El5HgxY9Ojw3a0qBXfs8WJ3c4fwwoEw2+vH4B5zrBIopk0fJMY5nAXueI4nPyD+nnzDibO6UowCWBKeBxaQAWyPEAN6eNaVAD4pSIqXlTvLuRZshUIyztB2Td09jOu5kwZQCJ+D+OMcZKVKjTy6sCJDqN7sbWmgkWQjrpTkD0GhMe6xz7GAHR+NYnIjv9ONp2JtRXiFrqtvkOVv8BW4FgoFBE2SsOJpefqaKnKBLC3kpmL6UKUGRs4u6E4QToa9kFuK6a2zMR2+hw+l4TMHoH87GFHFcEOfdw+MV+Cf8xZQZ56SvEo4DBQaPg8Db3Ubk30Hw3LRIJPZ/KPBIWXiWHGT/yJmZ412fhVsXmUieSjspz00u9ZKS+Q7zmH7VgMW5w4IRGgA8S7nyl+MNuFhJgVBxQZNF467FpVokEq5CZeM2RbCG7+6DrdGbl1TIvf8meM0UdpkjkhleLzmSu7LyK6fJKx1wCDfH7xd96oATRWhVVP/fZYmgD+IHbLZwx5peEr+JZ99nvbEtqWdz5mfLwu+4xeyAMKDDvfDEom81BSNKs+8lD7wr+bwBcCJuqr7rmU5GPP8cqHh8eVu1HLNmHvO76egnqEh6mNlLKOQH+554JDo0aNAI5kHazyXQGAuPmZK5TgnhqP2NoiJCjLYk8ZvI85lXZxuN6dVwXuHo+xhCFkqEJHg1JccFaB2spZs+YsXvJcEjYfXqSPGBwnqxdC4KYo6c8WVlLiAoDbcw6PCjeCPWg1RBGQuatdWyOBKhPwxl7DCVhoHHJ672kTgBvd1IKOEoUcEzk7dAijDm4TrWPiM6oAb/848hEwb5C2P58Ep2rrNwCnrxAXKU/Q2DJHIeDjmP1Z2qcXDB0885ej8C/0wKEzlhsNlb/uH5V8FiD4O/WWMJk3Nf0hbiLsuSebmLD9hKNWy9f7lpUlD/jpeJm23TIHIcjSqJkDoSFqLUWsFTDpadlIz/Xg7q/O4SHmdljyviUxtgXUL0L2czp+QZHRY2fvbKo5woCi2fToMGA66AByav/HfFLZCE+RobRXbGkDzzH6NK49WHyOeVSsxLl8R+3nwPmNRhFmTb2MEpG5N34PrWnG4T6kWZYtl6gHGOMmL5OMagR4d34vgZn2qs52g8P5QT92yyOdPxOAnPB2N/KqRSxrPiCmF5DO7aJI2Sq5WTh3Mg9CD8+ey5ZGbefxplrKNruLA2MYLdetw3cx2n4jbgYC7QGmmFtIeNLHpIy61+T3qmXOw5zc8f/Q2OtU2VlCh9pCuOcoqAxd4aLqjHUqLBVEOX5rt9xv93eDROWSOV5N9VaFJ5zYzWo/AIdABatCpygpXgjxJZQ07m5EgoHOreTVluNL0pkt1gBrwQN1577OMSEXuhsgS9J6Vhg9SupPxdjq5Ki+dnr/+P0WIQA2vOphHiUJ6VREoY7stzP24JCIrWRw5Y/53hm/qhGiWMSHke+e8niIrxgnffAwx7P9yX9FjDMM8PwdkxSmFYSEEPMgv9IWH4GuZz3fMvp/8IPztVrb8i0WWX9vRjA1q+yb8I97DXbpxgmJLbGgdhJ8RcqZzf9cN3CkJM/yfxZ1i5YxZwjRR02xkAp+Mha899dsJsP70VZj+lbKj2My4qzXFQIDQAblfwlC+PR9nWUpOpNPjjjSjJ5qdpIKa2oORfWUgHCCbXgL8ja9G1PdOhOCgahD0sfRyF91ggFQn+0XqVc6xZVtjO0dhQq8fxeM/sT7eZzYk2vIc/xM3QwSQMNmO97vzSFABXfkox1qFBg31c36JrtzVzaE0Og3mfMrZZ+DeKrvEsXM2mcZBpgMgX+DQMAK+Na/ieC/NNYBxJ7aFir2Oq/LiZDVgalf6FZmEttYwfKzksfXrM7xGRFx0B6NHiL9cY/6Oyvv6m5vTDOB69EmWwEnynFiAV8xPIHpC8ZGkmV5obOzQYcHBW2S/9LEmY/el/p2aqdM8cnYsdT7tLgqL84wVgNA7bgJza4gAnHuOJtWJhOcyKlIZfz2vY3KR+AIexh0vRobfdK8uaHU8tl8s91jh5Ez+AHTK0FAPctlG/94ltOECOH9Whxb/jEAaBqCSVKB8KuKb84wz8DV5hO1Q0qAWrpF8xwJm9B0eJ1lcOQjjOZGKh0OrJGVYfcPQCXHuNuXFQ7Pdaj45ROz6K6+JwwC4VAu/lMgJnPTVS+Bdkag0fmC+1qrotm1r7pdRi+gdrJrhymwhH30tROkLLV3KUKaZEBtit+j+s+B7uid/E+XZVc0ChGG9+EoFLmQ8u0fzxnMJwWylQvBcutZQiIZgDIoeQXALQCUAocTNhHbixP+8n4gdSzTQrLWlcQK/nHy/D+TgPBi1adBN1WIiEm0eCxmtTxNVrxFjxNZ2Ch651hl2nS2lbiYsr4w9xGvqpuZTXOAun/Q4xYKQZAH7O1JRJJDgxtnn7oTh5K0SDmxMy6vwD8hg0YFwJD57xza/CTQC0IOyr30GFeBdSW015DU5m78y1ClAHYbBAi9aCqNuJMqWxBq6duIaW7xhfjQVKLP90/94EPx//a53PSj8Zwc1kf2NsiDqnZ4PXMKbAh3F1DDBR3jTEhmphey5ApURn+RzYyryeJ2MhOcfhfRtk5ga1QaHWcTLOmhg+jdrEoP1Ur6xTwdNipaLMM/qNSKGTHNkHbl5Q+Z7T/yOjO0gpvCBJes3q/CIhNhtbLO496y5uhDuiswRMuep9KtbgTKKJo2JbiE3l1DOsFeZfbPmieiFHxY5fyCKsWer55SxRnjYojb2WISDw0nxQmWRib41ROA8noLOd/b0K/w3pzhTaBLG3nma2Mro9+qGPLLPSk8c2ufyvwUfWnhutmD2T/YZNPKmH4RN4nV1wxqHm88NqrbPLp7Ngxfhw0H/PibuJoeGp1AsLrLhkQ/Wr4y+qlZkoSAmFz50LYkEtlCc1HlsxVhkwWjx75j38Hr4PnUNIPo9aqJwOPhc/p+BfXKsA1QXdJ3pDpARIolnd4ZQENrFnRkuLbxRlmi5bYxSug7eiw2HrpSNZ4igPTeYEbTQLUJ7rGB/RCYwB5+AHsD4WYFDwjrXxCa/ELdFhANl+fT5ieAdsAaPRTNWGj2E73X9H/p5GsP7JGRqh+DgOD5nwxOteOSejP1KowCnTT+b8rFaY3zv4vrB/aIhwlX5zXgywDZGYSECIKcD7IZvBITVYcD9/eK1xOA2/jgEDWuG6KcukGnvRWghDSTMtt/WRGv5rPR/L/PN9cf8N5saO0hxAamV8fbaID+L70DnENiwob0mY4zzIh0Qy5BAAn8Iipvkbwvc0Nls94BW4BmqjdVzzQarbkyvhpLvZZHYBwkhhMvd4IY6xoT4Vgd3k50FRaiKlEZArXAVzwVTDcg42H+LXf2OgNAcvyaSx2PjIHoApPAdFONFBNJqlC7bDuoR/P4MOvV0OpFDbxSbO7ydnJU8qG4EQRO3DlFn4DCfMvNu+CADXwys2mhs7CVgWB5shbZx2+hR27GxcYhMpAXoJ+3r82SUnpCgA6FPUvx6Huux0jHPQzEFRi4fr5Nxvo43MQOdI0KQHWWh3kJtIWOi716BSq1V3PdxwrXt5+kQETg5VD2eaMHKcXGHffqq7y6/xR1aqlmc6TANuAm93yBDmciKVvR5oegWU4oxfpl0Pb2BMgbfgRByy5BuaCeNKBRjaMNjR68sNFiAM2MHfbniNu4XVcc74dWXHFfA2dNgDsLD5080E76hKUFx+VzypXBkwboRXY7N2C14zIOYqOAG/t29Aj25NTAjwcPyQ5WFoZuTYOZtfpbXnxJZA+0PEWuQz5fssRJztMmIRUC8FViy8b4iA+NqC1SFb+xuMxmewO0mCpQDqvNYkoCyfpBzgwFOylCj//Kk/5uxeu/HcWFThySw/7ojHYwA7mxmKEjvzNyfJq88FoFwIRwMGHMAnNhz7tsgsymxXnPD05GiLhDEhzyPex0GcufbdvBgdeoeST+JMIJEuMbexsZgakCyQ5uFXZI0aZnhLlHClOQqIWO0mImWgONA5ZS+gjCkPSJFl2cQfeL/jq5NnrrgArM5ipo6ijYVFM8pKb7hPySGHscvQs7H5unvhLhvPjR3h6WsdXcbhoF3/eBZOtgJ/yywdCT35cl92nKvXCS404RM/saJRzJCivWWm8XllIXtWjhchzYGUQixzol7BInwsdmFWYkINGD+zwd2cgpOcOSw3qcS9+HK3fZhkS5VvNdoXf5aQ2QppXE6tu0Q4pESUgAq+szyPwoLcxrrHLfA8HJ64Nk0w8DyrLl/nqczxglssABzGD+BVFa5iUXyfq9m4v+F3vh/H4xCAxVYbpnW/B7PhXqtFuWTTv2eBwlZ+7Nfx9mk2TpaSK3ypSEEAztrofn7PMtiaDNoll+DTtjSNyyzNolW9N3/wptfgtW9KTnQ6hyl5DRT5pTmxZ1IYenILIC/plj8eidMnEHksm0JZDsg0i0BqqZIii1fKB7mUJuk3gOSEOVMq6Hxzf9Nt/K2fANDbphHKSILLlGrlefoSYhwu6++2TS4drovXVxj7HQWrQWr+kAqwvyR4dciqHLQAfmwDZAIAXAe/gH0HF5BjYaBiN0K+D1Yr/PHztLmZWj7QIFT4ZVNAiXCBVZkB9qqt6XJB3G0UT39X3s4Ha1GF5fw63NiqSVKkybrq2CYxOPS5vCWxM5mtMeYb4qDCHAtHc6AAO3Y8dfgdHFPFmB7IxBjsUBjzhtAoOMjEP1VE6ihRYpKaPEjklI/HjiMkNAQ6PY4WMDtPb8T1dmg3zpbK7eKkrB4SIEJcaIg4+7OlCCPjVza+o9fgYFHnYHlbi9Z3T6Lbx1G7x/R3Y+lBaoY+61Tj077m5iHvXNk4UwXS/EkcP9VmqRKpG20JhM5OiM84hNNmdU/nevPnlGO4ErPAqXiGZWfQhGjWKwDy1mZgY9Mr+3jLxLVVw5huliCipMYYZ1THlrEO4RCOxWkV7unpjuvBR6QRgcqavkdvoK32dUPAzsRFj0mDRnOipqaZb9oYKjQuvb7KY/i8reubImVvKOEJqUW88hptCScBWc90D9fBW6pNxYVKZhe2Ew9V2kpXxxNwuqXmo0l0T/NLWB0rVgHqnBh1Ev7Pmec+AqIGPLRC2S9lTDlrLChB88wFQh9hzDEiQ86sck+PxbWtSKYkGJkirmTV+rB6F+TMAFaQAly3mt+I4T2L3UwsQuhRTNMaQ6soiwzkoIZNIgEbOXDpw1Ue/NF479TI4PpHnASSkxqa+sJ4MkO/G/BzJH3GAsZ1hTowNtP4EdQ7WoWyjoMM1FCt/Lc6zsVNplFqMj3xLIiPkAKyIydNEnfpyWiJsP0kbGMYU257uCFegnq03iYI8FMiezL1icYrQEntVVdDYsCADgs8rdJdvSSQeGQHvJ8Wf0HQ/sNJ5tpwpZFqc6oa03bi8Syro3EyyMvz6myTgGw0KpdWevC3wHOToT4VUDfzlpMcNAVjBj0O4Rwci5o8/Tz7yi6t9u0fxVUmyFGzFis+bSyUV0JR12AXBofQbtwkkdY3y8n4cUFTZXkGcmlSBwy4U7W7uj1uncVbl843UlMXJYTt3s9qdUC1mYBbr+BLcleyigsXT/b1DfFqHz9c7dE/FD+HwZIJllDBUZIBnIoy1DQ7HT+mIhp0uPtGDYySMY0Riuls13xybiTr+iaZamGxY18vT20OYCOhLGrQYMCA11dIupVCllL9eJTEiLCaJpOx4R2A51a8rzdOerQyRpSiJt4yftJ45bCKS43+biolbSnD38lKzohVMTkkVDQ5Af3XKBvC8CNH2txXfPSvwo0sNq7J7vmkZPF8FAMHoyB1eUvAfV/GL6SGM+irZkvLSmc+h8Ay5N+v9r3XdEBGJtI7J9GwUBS+U9BwgAjUTw4CgwV4n5+7c7/f2Miuw31xj60VTziL8WYx/RRzE1BGDIeCSn4D4MdwQsW7ugYeiCGK9lyaRQ7WiE6gREkcEAmmWDHOpmq1nLKkbvOCBTpidGEc5Htr18s/imPQWe+UZvRr08bVWCp6esZmS1t86gjUQilSTo3fVXMzuwceiw7dRM2HLfTZ0waaTA1aAIdwQ7wGtfXPUGmW8Sw1MXLIoEfavKdWvrOX4PIY7Lk3lUekOmvMbEFOWerDV2CuCQecksEwCb1NpMJpyfEH8t/GlZCOCFSydlT9TLkcwOqD5mz4TiJDP6ls+sud+uWVsKVlGciUEk9X9RqejZ9CP3mAqQaGFAVNjoaFChCYEEqejVWHP29L8YCm9h5zIXEB1ywpuVVNULAFcC3cufqdPXNiZsvnNKmggytsOU5vnixJPeMIUMKmaORSUhwsgGgQ9XbrXVTshXEkOPQyAdoY8NY9rofnWNZXDfQNIbSKAw12WAZSLJMUIRik/I+fyb7vTDmJuXnoWGpQhoNxdWMKvB/fh26SlaGoZ8Zl440xI5QAUEl68+yR9UEkNScPAct4JY7eMkqSk1KBklyJZI5ZXF8kjNFKK+AxW7ivB+MH0TsSnbFgYUyLqDkXLOA5wjYeViiapn/XquabSslxnt3PsClh35HImY7Hg/AAS59iRHI4rIUJ5A1SITQBqgnAiZVV2cvYEUhkHxuqG1PgM9ix/frtt4VnXkqtLNm5OtwH9zmi7sy6ITDPQom0IOzhaDxqK/f1BuyDPVWL9QpynKFpL1yfZisdRpQIhCirUU0im08KHUczGCMpG7gMWzKmwEtwC3ROUD23FY7Ea+ZCTn25Kr30jFp8dEtLuRGSF/kttL4xvQLeZFUQmgRHA80ki+GIBLKEUCNEq56IV27deOva8ikq8rRoYL74azDgQVu6pxvibug9oT1W0zJc1IuPRIGUcl2fZi1R3LyJIqV/PkexV2JWSODzJoFWjxN1fVL7H7brsXwQ10Q/EQDHqALK+HYSaJ88Yj05VcCeqB45pQ+ys+AllRoY02EmK3A4d/SHSlQn8XEXPAn7ngpCuFgoSEewwKHLXgOEXPHXZCHJaY+gaTNr8eGte8IcNSKwSlmuGyZOqDOQ0KVoMMBsyBSVOv4QrRXaM/DJNiEkleKet5T8kQTZpBSKyFSqWzdbKVZoppBnhMKsaCiWdNtu4/g4Wktx286iYqAtNCuYSUr47njA1iZ8kyz6aFmsQ1u5lt/E/8JlAqimTIOAqtAhxl13r9lC2W/T2cwzoJApiW/GHaoiZ8PjSThkQ/180oFnAvy5ELs+VfO5UjupiVLyGglwipGGlRCfPQUemXE+Jl7mAgByeb9yneNqeMuEvzOzzSgXS0uwmDTx0ZJji2uPa+NNW5zurRoocsLgXLqlq3k3rot9tEIdWBcWhKpemVbn4oxIzUioc2/cHUfy4KyehaRFkUtMhet1dYZnbvVufg3Xwp7TEJMS1UNBL57O1k8iV9sWqvlN0B/ASkDAkcxeWSvcnDR7iTSfe518hOWA74rHT4/HRLX6UFCEBPk1CNR5Mdu+H676GTK2hQ8C0ODj6rU+rmLUElfwSZFLBDZTOkgfn8OV0E14YooaGWRaPXmLIrWNMm4tcZ/fkq9hwAl4uXql78B2OqBC0T9SUk0U0QnK3WPyFtOgBeP6a8rnYQbVJVvuuxylvOzecbTxsaAO7FJkKjFMLWNqxLTupjR6VIkMjY8QPgHFshr/SwCRr9PuQBuYuKU0yQtxeWhNey+qODfyfp17vz225yn/GYyFSTXFeJaSPm0uRKCYCTKUUnl6QYUGzJQy67z1llfNCo3qqMH1hK07J7fGXXEIvQPgTwENa6IZgqjFVAKot7OxbpwIuHlWRiMFSid1Ty6rfW/reA9+BB0aNdNDUXDCYgCvqUDpCRX2vOIed1GJ0Trcu0ouzySfGx0xaNrquAleMXllxqZbjGoqOMm7q1f8KZN8IRj8jsD2Oh7/gSfg2lvYyLjQ0UmVRVkdJ7c1uQXh6viFI7Ca/hg76II8OCeSXizKcMZc/XpiiiUPuFYBqi1GQ8o9vqECNidD+NDMhD/z66yy9Emc5Tqy5vRTOAbdZNTCUDBkbmchg8URPiIEnsf67eP7zJTjvnqiE/9WGKrAyMM+NAmRwIJg9zaPe+OXHVO6Il8kkUQPancQKez0nPCHjG2oGHC3RJPEXdFVa32F0KXug9r9bK/brEDQi1iUYCUeP/fghD9ZN3PKwR2SwBJACaoaTqgV57r5eEUOXaNyvSN4iVyogDgfdjVf65uOgCL93O3nvWB0aBL94rylK2uwAGEA8L7E9PxkpWQHrWUY+y2P/7NwR7vAmqltwWRbKaF0rfEMX3EZDR6PN6rvegg+Xc3R4YJyZZrgeW67zRKsv1BlSu6A83DVihvmk3EddICHOc3rUlVmZDCVzEabKBmx2MaocwjJ/edUpBDJWS6cdJ4nd1yKk6pNgFvgOdgDBf3iJSAUEnqKIfjYOg3F2HXzOJwIDcD1XOyirTLdTQGHZPxv2Zi+vKI5/RP88MTDL10riQJqpUuUBT12OEVH4C/VK3snXoYGQxXAISf1HKhQRY2TrTjhSjSWdu/uai/ae0H4Ko6r+DTPBmOwcYbsl7OirUAZtEL6fc75anmmi0RnkR6up+qDKVZJFvXnWQhgZBZGFpVT3ekzKEN7FD6GX682AR6Jn0Un0L2lTGc6FKEAnhIT6C7JPnpcD09Xz3NaFTGbnEQIJTLlsjH9b9y14hV9GkfZKnATCKfE7OzaGMchL4mGCFPr6Hh3v41rKVe1h9NhPMX7ehsZCbSHMhRR1o+X3BJWPVqtgPZo+/3fwBnVnuUdcCsrX2kyCAQSxPLCfn4q0AiORrZ2AcooQHmuzDdUXvGfX8+njNbmWfhH1CO5vR4Ow9jaen0kYYwEHOne9mDw6US+7ivWK63DdcsbsZDBk/r9QCI4nn+8z+aQadLp5TUIIktn1LjQB3Q4LdGtfktcZMtSvAUCxJyGVZ7PC9mq9wBGj1sqeg3/gQ9hBztoQXhlxXTOm9FOpdW8RlepYkJZScszfvU7oKjA5OlVUF1Lkov7VcpgHiy0uqbAMg2GqsnzT+GK6KesXQpaTTM1NEksn4zGtMOb1U++CO9FgwE80Y5gKz4qJbvBeyUyAP5PxSv5MbzYtpdS4dbPMw2L7ye2aDDgBPwRdF2GT9iWAq5gaEhJFHHRTIq5lqjwswzGM6AJ4o0wphYtGKdUe5ZXxf3QC/BMVu4lnQahTDdm3BRgoVF9Jc/UqNlNlbYqCEkpaxZlIbxcZogicLiuQZ9ukN1Hg6/ipyou6L9CY/v1KWCClx81C13hObZTntiqCECPB6vh8j/jV6Yttk4JhBLFGlYLH71ybwaH8RMVR/+BeLjdNJb98uy1SLgsuCyy58sJGooUDpYIikWCgPuP8QrrIzO4onSOzpOg+a4k1MPlbqIwPdCgQY/rKmvkW3gbDIZpzD+YiJDmHi/10Ces3gsnAGIcUCem3MNgbOp2QGGS1OU1+bs5Ux+l6jV5zfS3SSX48/Bb1abA6Kfsow+QciUMW6mgXnpKY5X1Jvgd9T13wgCafNJmqwWoVHivd3wfg0/isahJHH2XyTs1s1JMc2ZUMxUa35CglDljKg52lYwnz9alkv01LvxsgwUaMJ6svPcxABbYxz46MHbRVlUcezYGixqmDcD5XBxtuHxz1QpQlAFVUOGtkNh26j9iKmBq5IzyUFgBJ8EDSvM0PgmfrTYF7ojftqPgS/Ouu3g1Uo2R0X0nQbZ3D/wLjPXLhq0CxGjNLHeDBgs8r6I/A7wJ1xc8fSpsHymBEC2LTwPuj7up5zgV35oIQvqtYG01RiUqFmGkTMJgvM/jFOKcw3gzFmD02Lco6wU+i/dUu78zcH1nG+IChQDdHdHTAyR46FwvZ0rKYIeSZa66NSVC2RS0ihOyA/m8j4YUILH2Lefyxil5m4qT/JG4HwCeVDRXqEcKqOEQce7HevTSPY4Va8aA10Lvcn47GvTTIqZqbGAaYE5OWaT4Xgf0MABui7pcXleczJcJ2icoEMAL20Qo4HmQDNYyxL8uXgo9V/3habxrKZGZIio+jqr2cYMFPJYHCHJ0q3P2eAg0POghm49fUYEbPLzik/w9J0KGqsDKopKC3NvFAcJYhvfTMmdaJ5QbNjDMvIFc7iY14/l9/z0YPXrs4qKqhahX42Y2uNuZOI1M4TWVhP8tFgD28LM4TTnLN/EILMDonDE9ErI2coK/UZIA4xgdwDdwB9Rt8B379Ukg59vEy2YwGixg0IHwEfV9/4Wn2vTKsAZeYD7HPm18byQW2IDDIBV090oA+47J6sHYwRfx6mrP8ca4HTj7DOclcQqFPU1VryO22aSECjzbpHIpQEHNxuamfDk+YPQgD+KjeBpqKpheBQMatI5KUQrZKGknafc5hvg9jsfr1O8/GZeixYDOKf40W6N+CxtdpWWpmVPAYIH3JLy8+ceN8PzJHzQzVBpSkRF7W8Menp9oz709Dtl5OFj/uMbqpCJEAostNbEGPYtPLYwp9lWw/gtxIYw3vzpbf/9V1BQzMWKkOUdNgBIFOo3mz35tX02hlD2VUhksK5E+U4JnkQPpLi5qJA0dcxIDSA0IMSSN6WCrrQa/hX+uOA0+PPn3zcTHbqaSnlY9lhoYyLs3Y0lN2oT+5SNx/oQqWGZMzZaEM0gseLC3xWs6rr3ju/0SvlXx+h5iUy0chPpQKARJ3IhjXgQDA0aHU1RKGeAB+GdvLMxWwvwAyuM8D9loQtR00OhzVgmKZylX82I0wqcGNPg6zq72HK+EMy37PglEgeGzSjGEpMp68fvIeKTOm3umw0zF9npVed74+0o0YQZHo2gPDeoSNpyI12OwLY7ucjKF4ZtWcRxRi/t4Ia6hfPNb8Qo0YCvqka+p12m+SKVmFmqSZemd7qDDjaua+1fjxlZ9SuJLWG9mN9gF4RCOTZRZXog32w2MKudMy9Es5dxppEaHjAEdbq6wXb0VX7QsaWH+sgdVjfFejMtZTrYalohLOZZr4UyNl5wtVQ3VHW+elTfihLHhaKpw0flziYgeHRg7+CZuX3Ea/AKehv0p50MKMnBOJZks+qDHqWrz3h4eANgQf/Ce47C13ChlKEWMupmRHXuDFv+Ke1W9uk/iytYzNIVyJpxpTDBo0KPDn6vf+Q94ovW3Q46FzZMsTRGUH6oqg25OfH4snsJ24HnKtfy6YIzIxhoGF1chIl8ez7StpbK4Xqlyq6SUQOkwwFQxpojqXchSKlCiNZRE8GwMwGeR9TumpUPEq8+BCBjPhMKMPtICH6qIOQWejAfa+zDO4zNKg0LYhEDCaBgAHa6Jd0LvA9pHI4CZ63RADcq1+mKA4WxokgxUPJXV/jBBIoi1+vXJluBajy8/5uwMESoswPYbC1D/bZVSBjgZvejQUKWWCU00iNWcbwgiChUffCA8TRt2A+AGuIV4HX+JL1iXK87L9ugx4GUVn+JDcSNbTDSRWyWtcxa0SClKDXKQ+NmSZ7rYMv/k/N57ng3mKinNhV06PXos8Ax8vuK9vgwnobfVfKNoJuYWD3uEbwOAv1I/cSa+gAY9emGi9Efg2cnedJMZ/9E7JTS4b9WZdjzejlHOz9VjJ4VNCZm+wBYDLsMp+GX1PbfF19HaasMQLOoG3y0HTQQ6T1He8ctW8UqKFEfv9KKqktDnoLNCe01QkaGCwvYGHiVXaCflmVAmnc9btv65WhyLuFRKaMyT0vvPCWNqgmR1Z89zG9SF6VzLZk5Li0Byxmtpinu8GNeERvf2Wps374Vp3mHbWu7a0zBq2LpU6OmnBMaNUFsQeuyBa6bRMKLCairEH0e+xYBj8S71u56GD2FhS5rhnddp5jWFGVRSVkapDNHoBV4L91T8/U+hmXLe8XnHJoXX4JJqT/HH8ZPoLDImr4Ula3yRglbaMjSqTU4rKEIAUINrLhDLo6TKvMzFSMWJ9qHAAAy2bGBwIU6tuqD/GrtB+YmjmiNU8IePkOhwR7WOPOB0B50Qj8tQObqgWaWzdA5wqRVl8I94BOoKQt/BgnYaJ+gLmyhYCA/dwHBMrwx4P3SSm6fZmADWMx1fZhLhrl/8YyWlJUuiU8SBEc+T1Z0PeKhyFQ+zTFIuSmRJejjY+WfQ4fSKT/EPYCy/RFNgJUiQ1uQAaUSi2OD07loQjHaC08xl2eEo95Qvt8xFqZZLTc8DMxsb6g9o8SG1GxlrwTvePKmHrmfUjJ1CHa6WyJbeCIesrN6gAJG2n7yR+etNQY1/mN57bsWWRAB4F07Eng3UV8gKUyDP7VJADziMZyT85tthgRb7Nrxn0UDh2yQDXS7zyHaT28MBPBFyie08yzcwOM9tCQFbqeUS3o4vbAEi5ct6cyY24gxIX8Xu1vVMTQbOTAW5yxj5BZU+OcdsqmlK0Qa9V+SZUjj77XMS3Onzj1Px1EJJbDkVMo7XAOBD0NGNn7PTWS41DVU8Ux2pKY2/SUYdCxHZzAB+vrJZuQCXQ2970fw7MQW9QWOCpcNJiS32x3Ehdu12LImhmK1XHGQSa4lzjJN0KKMX3SkhPvBIC5rq88B33Ac1IVIH0DnRhcRbMcelCnnAxKm7+WMzNgG9+q9Bg2b6c/m31nv5v2nsz9rpfeE5lv82E1WdpHmuMfDHkmJQGNSHBGtUrGTJFsDPuEvVHONjcFf0IFuVlAUEyaPlWy3JFT/n2fhB5fzvxqtBU5AV4ya4Gs5UbqOQ2dyH5HRulSY/wiHcpLI5/SgIgyN3SBMJScyBQALzA+Pq+Av17I/HJyZKGfZARlw5Lz1EbA6ksFRwMmqjZD/egFYBRX0L74aBsQ0hKwwtRRGXAfCRhC7Z/OM5XtIFHk5I0/NKR66rin6UFKhHwddgF7tYTP+Nr1b4m/zKvXM0r+Pfd1SJ5HXBy1ScBTZCQWIZ6l+IH666EN5kOXAaRShM9vR44u1nnKZmsYCfA6EF0DvEE5tzJsyt6GvFDpMUbvQ9gwEdCH+v0musd/wg3iio3A6KuVsmAZapAAYnzMIH8VwsYLCnbL+kJM3WK0DRmuq7chYx7mkbt5fb4AriWR7hwcw0UNKYUloAiT6x+ceDcFO7gkxRES7VSkK5lKVJtk7OM6Zm8hwl73P9l++VLn9mivF4JDBNSXuyP1Q7WfbywUFQDtYAfyFBsIa1QORXRGfVHstpLZa7/v+XYHS/FS6a+Ny3C2tbj7GeivuiVr7dKytnTu+OJ6FHM22drMwWiljJCD1+HTdQz/zTMNgFLBEdlIZqri60nW6ilkN9UlYABbjuXxO/v8PrIhy6tFmOa6jFDv4Vr6j4DN9mhbXlbDcJrPnpzCoLT5/r5kwX6G3AGNJbsUVj9tHPtZf77nCKrryDIaNIqhO/xcMWT+Ih4Zn6PhEmhOB492+vqqAJ/A0adOgng+qH+CaaEDTpei0SjKtPsLjTYerEH4IOnHodUFJShMUtIJ9yap1KsIGZfGq2/vXPVTb5v4bTrDdmbA7aJ/tY/WecUL8B41TFuADAT+AiB0wo5y2308qbkjZkpfrAglKrm5pYMuvL8MBfASsqt0ZVhHhSxSd4HM4UYZWkYodZYF4gQUwwNKfVKPgGHMbFuAz72EM3mc8OeziMfexjD/s4jD3soUPnvWN87WEPh+1rb3r38r2jie2wj87+fm8L6kT+/tMmigvGM6eDvb7B7n4PwRcrXtW18SZ02IcRQeQrcVuazM2OrZy+1sqyxcef49mThNwgypxs3xvNUbtRMswnx/SuuMpaHMKtKl/zm3A9B0IvAYqWfTY0mXjg2gkf+Un4GA4AQYjPgr9dayvjDXKxOSa3MVo0qkDgOVjAWBxpDnQ3NmIcxNdVqpR1jufj2KkbKodXoAy4n1OUhrWM6ZVxwL52gixnO6UAWjT2t6v37GAHO1hgFzvYxQEcxAEctP8/GsfgCrgyroxjcRyugWvieFwD18BVcQ1cs7AniooWtMSB0xRTHC99uN5OLVYa6tYPNh+Lzuad8rnfkd5hHw/APdR33dnC3cd8KQkUbG7/VM2GxhzOlzJKB60tCknb+Zi3/ggeX9mc/i2Otg0CsmkxjpezzKj/KXTFr9+y/nU3nVXz5I+UNixFuvA0Y1NsAVxRyXSejW/hAIyTl08hCtjmNxcJEfJ1jmfZZgFSi0ukEnz6DFoZR+wAdnDj4hD8O+XV4agIjUdB3ZWmOh5FLyPUM8npWwF+Svnmy+MADmAxYQooIGAeDdDPVL7f28HgGByw32icjPLCXsuyP/oAjoHBjybOdePJgzWQ1MTH1wIH0eK4Ctd+LhY4BovgqawC41XZZryzHRzEAp8Rz3U+dnAUDkyoEfezhB0cRAvg7yqP/qdxAAdwEDtOTLK87lVRdHQmjsJBPD9xrqMALHAQOwErgTsurX06Z1a49qviIA5EY08RQeOqNUG6JhLXyzhPLocDeJTy7ddCi2Ps9/uYB+NEeG72tcVROAqEp1V9gjdAiwNYeM9PGguJK4KChgyj2RdTtWZ75I7GC5FoC4HogWx3VDx2vQ1mWrwNv1/1fv8M349LMdgWRyNsDqMpbQEcwhUT+pcPxt/ZbOMwg7+grnRGXr2dFQq+xmm2hMCM2aHFoiqPFwDcEC9Ejw7AbpD+MZ5I+Nh9fqoa8gI3xqVY2M6ofCWdK0pdls36eQJ8I9B+H1Coft6KL4Kwp7Z+yNjmfXRY4AVVn+C5APYs48WmLc+MQtTkd88xKC0ActVSktWSaPhWO+VOkmmfp+JNKMK8xNyega+irkpRg8GpLIfVe7IB0oAOfw2dsfOcCQvRJ8TFUvJjm+uD5WXbSnCm8TMZN7MD+EpVKW4AOBP3xb7FT0vkjsPUtHxV/DF0Au6/sz1Vofqon/wYPIxIHUEhmiF/mRIU5ABdbrCHOyrZ+aeh8e41hVxmZ0Nk7OBQVQXam+En7SiYArlrnsH+SmEH1ID/KYffn84KCQorJCtU5JUNQm8QBbzkBj1Oqnpnx+IDQrPhionf2ALJgBfgh5RzfBlnOPB/DkKYEDxea2Y0GYhZ+VYJLzAMaf2WRZseO/gL/EblmXUubj7168cLcilW2CRg+h/Bi71NlxNK7EO1aNGIaIGwcYUVvoG8LzkAihf5SXwejcCmwUIFPQQf9SCcU/X5/QEWEXYhzBWH4o5UYBEcauzv1jAfhc2l6ybqKUHdMkR+rW8WRkqHFv9Wmbj41jjbslTRVJdcBfmjatIeTscj1TPcwkpo5JClLC7EzT1TLgod8ymDlHrpUnDvaRW7vGHJZ66OQxgcVMVoukfY2lixfqbCMg8APw2yIX6fLX7UW5dNAhhFG6Z0Rrfi5vh+8bePc/QCeCZGmgHs496oyXbxi4GaQRl7GRLqakFZ6rszxAf2Mhg6KiA+0eHIAFRY0RDxTsY0Xb3N+v0Jzq161w/GIxI+W4sBN0zoPN4N/4kdB1taspB4CzlTVmjYSuajERkg2PElBuwDWKCpHuoDH7PeZxMQlMPmDk9ObGSn4JsWKdwnfDJsobowFCmlxWmskq4fxsigHx/fwEdhMs3BMlKcLEiK8HZcWnEkXoKrWjFGiiTSKcs7l3LmrDv13WpMLxP0410ebA56b1kIC0MxAn9wFomwiZVmgRDMDzymcub0ubid9QfCDcNgwDH4uPrJl+JPLXg6ZrvXJvtQhTUqBKC5aQXyNIHcZ6rxma56zQfHw+JAO5Zh8CXcpfKsuwbeahtKzNREQlascB9XwrvVTz4P5yX4esOmlJrGtY34fZHgphCp5SIxxCXutgHjBKXc92j0E/MHiSuVPa4AiQKyxy9UXj1+fFNCluQTgFJKM/m70Zh+Hn+A07eemmjWyNWy0w8zoIfBgJtVvq5347rWWLQ2ZFypWb4zoTP0aLRg7E/mtOzoty6GyIrKbY43N+UxLYsYH8CLKo/+3fBUHLL+TTMJ5o1toW+FLoXyFG8rJ4HKXBqrmv1nJd35VIS0WEVCLQgPV871jpna9BCFd/4MF1R8evfBTSx1TZwxLpXt1Ocff7cY0wvxV3gK7oob42jcEPfGe7NeEAt+qR7u84wCVEoZddVauKzsfwmnoDY53I5dziuzQxjwQNxc/cxPYhDzdUjqH3ClMJ8SVf0cfD9VzZf1wZadNA0aPAX/XXn0fx13R+f0wS03tfsn1BbuZNNSYc7OZ87azlpsI/Z4iuhbyrhMQ+PYgnA5xZg+DIfRTCG1WYtoZdz2/zfq6s/6YT4y9Csx3R4FAtLOJ9pKF/ll2yLX2K6aYWJpZIfFnRyoBmxGZfWOZXvp2DR6CS7CV/Fl/Ce+gcvQTYUfwkIsoXACakJCuOKGiFLnbZMoVJGehI7YQA0+hKdUFbIF3o9bop8q+AMMGNfFi9X3/xS+gl0boEoUhaTcVV2qDQ5UKaXi32AxCdr470yzJk0Vt3zPHn4S/1DZPL0FN8T5aK3+pUGPDifgVdCZab86+fiDmKPzU0O1w/whYEfQAvzVatBKhxQlajQW2TeqaTBWzk6Cg8Iw+DQ+WDH7fUPcH6+30MBhzZZaVtpKqa0Ezn4C3uLILmgNWz7h7ZD19owjKddMwrCDJ4ybbh4tq+CzkBPZnSnQ4uMEzcQrZdDimbht1XLIzfEcPBaMFgtrsncSMP0n4y+xM6Ew0551OGmGrYT5rOzuczzTQeE1ddMsBIMv4jS8rbI5/QyOw9cALLAAYw8NzofeiX+e5fLU8ZzSZlCPgoi30JhhAOyhURhMn4DL0NhVysl2AFa2FeOszQfinys+u1fhnbgQ7WSnKMph+9sJFzXncs3e/KOAqUHOTGR5JiLSc5v/Vv9qBJq9XexiBztosUAz1UF7te4Ir5RBM+E68RCVG1NSOyPGoLoFcKfKAiCPwf3QgbBjRUfeqnrSH8RZViVzPykrQ1ukOjECH1UOON4mRl+mwuMgsbDU53pvVRFhWMwo2XwpocOb1dnyTjzPMSmDMgM5KtHV9EzdUl2xBIcY4vozvsNJyn2fA7JcCT6rak5+iLyGmPH/hP/Ac6o+u+dMjhoJ/jKLdHwslFKjmVeLaX8Pw8Ty1Dmke70lTh5s6O++w+WO6p3X+N7l+5b0dv3k8Q4J1lK37iZziXOUvZMT7qbImJLzvSHoennVPVpchh+rvJxfjZPRWUzrY3Gymmu+s02oxLqsbvWYA7G4+mAdClATfkzgbkimwDNlD/jOYsV6mHKUj6nK4wUAJ+BdtrWgw4Nwmvq+0x0fX0JSuMzvvBVwVJssKMWgqNicanEm4xlKVvliD4DH2dJt3B2PqQDKMMr3rHvcHzdzeAhkkKRWM2Blk6G6FHzrB9s6lpMtjd9I3bdvDezgAOc3V2unmbqtTfYe/QnZYd+G4Y+ovEzejx/CZdjHKfjNRELgMuxgwL7jGesMOdgSDZyeiyX1aZjM/CgliRsN2a2rG6nb42VgXIZbJKiMfxz7U7grs2ZuD92r4x8oE5uUyE4aDDhBQaq8YGL4XXHlrjdXRjvQ4lI8uHLWu3G4cfNcc5Sk55vSArWY9vdscBV2BZFD5Ct7K+QBoFeJeHb4TvexP5nSfgr2uUizNEcXrYFBTFGnOQsen89z2qGzDEdnV1W3AYBP4AAOJpgzH4ILsIsW7BFrcAEAhhzaibqgfSrqCqcCmHcOemMm/4jwnwnvEWv36z8ADT4IXeXpby3NYR+E8iV+IlU3piS2rLDS4MmJ4u6ovPp/xO97IS7yiFyGmSAvN1Yecc4GBi/HNys+uavhTMCRAtISdRp5drKddPMH10X5K/am/BAxrfvCapq3JL/8zlpdGswF75MqnytzbB6YjT8Ne3w5AJEjwTC63rGLNyVoNd6Jc6YAnz0jFWu2ctDRs/rNPmqzJ4SZJ4q+l2drE8UmYukRjYkQg7dX5iECgJcnCk+fxnOtV8oCD5QP3OMkx2YtYxoyGriOD3s5bYpSQHBA9iN5yTF4DGTuUJpiy0FBNVOipXMI+gwHC/5/EOrC96843Uu6/UaTdcnsA5uG+UMBagzF/OqkEg6ERLb5AInXLKnVqn52tlh0SWXaaOCOuK063vezPSrdRqF6vxUKvvxz2S1OzVBGombZIf5Y/GN1c/r9iTRAi9YyBXw7uS/aJCk3ZzrVJWeiRYN93A9yJv9L2BX5pszstbN0RDoMOIA/rlrTB85CP6lXSLEaFSXzvFiilmfaZ0OFeYaOskRulPAsWWyHS3OIh9XsRdYzTYGc/XEYJo3RTyj7ef3jJ3AxWtBaxpSrduGY4k4oN2FyIJmdpxnZ2RWG9TZHzISdiq9Y+Zh+g7zoUAUapSs7cbI3ihQGirEpWWbleupU1omjHzNbZJFBtputRVMZvn9/nIgejV3PrPZjsSpzGG0YtTxTzmQnOQgWJL1wygA1XG+VRcNFHmqMxX4eFtx2CgbNFMuWpLp5YplgAHgp3nEEFvODcD6WHe4cZHg1/nQ5zOdqxlSDcLOw1E1xO4l7Ryt20cELn5fP9ks49YiY0qfgzybFKI6ANHq9gIp9+nmeqVEr9hQx2MoJFfaSZANuj8sL3/UB/DtaB1vKwrbsrrVY4i62C8uUTYMP4WNVn9LvOSQ1cSKwhNwk6KSqW82vxxjOawTY8QPiGXhT91uHxCcbMbDkAt+9t/nBe+PiLS/mN+INTuaJ1jKKXN2YlormUTI3XVpmHJxXb9WWDN5fnecUgmbUM7BAgz1bScBWOA1Kjx2lQSJuqSy5ogbAYfR4IeQGhRaN12k318uWveQx1CecUfU53Rh3xB5g9SkquJOmGvRlSA6IbNN1kE5K1Z6VblrKPJ5UFZuLO52aGWzx/juXol771TGn/vEtPMiRrE7x4+QVQk21MJ8zrQ60lvmgGTQ0Y0PIU/G5LRvTk9DggM2U58wGzeJ7XTfMpyKOirxrMAbw+7gFToRUcvukTW1oQEleO9btMGCB8yv3sv0RGvSOegJFvffpiDRwCWrlTCXTRkmezLC+HNYY07AETeeaRMITP//Bqu/lKre3WT+LIjZEvUq6uocehH+rXteHh24cRKoGl+YtzW+JreRMw8wTC+zvNIthlb18eJyu8NNJy2+67VZN6Y1wqe1KG4CEeFspaXLNar5eodCJbUJxOUBTfHqsR4YIkUiFoqAeYqMIC9dlYPDoyqNzljX9jWeF9CCfPKeMpUa/BjX7XDgD4C8DIpBk+wtg5qnCEBVuBaagAEUbEH4YvAtnb2nx3BP/BiqSy8v3KtViNJ2jsrO5bypv40sgeYMLt5g5fQguwAGMHYF5ojvOIqBrhPlzPXnOVLF/RBTk+QY+4DWHUFWCxuXm9K94ZdXReSROxCHLoFE+KxUnxFTtbZnfU0yCdj0VTjCKQAyUaAijIsQiZUVRGjVgY3Vv95vXRm/v8dVlNQDghXirpdVIoTa5qCFhNMf9FvlMOUPSu2mWnaP2irGj5rzKLF7L43041/bV7CdD/DJwPLamDaspHnCyrr181y9DJoMewOgShWQq4hXT8/Xj9vSrlcfn9zGgi6r6VFhy9kL+WmF+ylRRhDvza2YybImDoBkCNzcCoLFMeCIpNsX1RAp48pusMSUhQKKAT1wXQODqPKfAp/HLaJxGviUjPwV8q6QGwiXZ5E2hURR1pc9hTh0EH5qi4J+F1NEqj9zg2QlNAqxdNbhHkAkmdSHGnAi0Fb905Zn66yQELqVZvNjpYjwOD4BGukcTgwYluB44I16jQygHGHy5Mu3JTXAvB2dAwmpgxfWKkpK1jKkRO2pKfIk6lf4Sb2teDdusQcFX1rU/2K6OL+N2lRfOKbbRj53+k00BboztMu3P9ac2/96RGPHO1c3WzbA/NUlQMc6attqZD8u3VsYFkCoCNrbq/Yvib38JezZQHrbEQsZWGbbBs1Ab+3Il7GNw2kvXlOI0a0h0pNjU0xR4rKhVEtZXXy/he+FkNkj2CXYKlzkVa22H9F0t/jIhwIY1WE6/acmT+xkmhjLhX1+VHFp+eryBMQ1p1DjzbJfNvRfhplWX5C/hfJDNVg9K+UU3YnMDY8yu5pNKQckeE6xOSdNiVH2VjpdFve5G4OOgzNqjAivT4kJFwm/940VWmcEUxgf+WPEKGoUtKCaRAhKmoFuJAuC8D5+XuvHDamjc5w0VfMyKQZYD3bYIBK2jDVhAr7qmdOyKenE1CP+TrRrkEPTZs4L0JQ+N4KZOaKvtpG6qJtZr5xkKXCxqw0Ks4IfPuwPh/Ir93u/GOU5eliNYd2yaNLRKGja+SQeUbLpIzJiylxJYHXcXv+PZ2MMOjGUobmDQWHPaCC8zvVrx963zDvfV2LrDToKnC2tqQ93ckv0Z1admYYvxR5O3kTOlLL6MZuqpYw26MlqD5IwLfKNWGV4qpBZcbg09OrTYxb2qyNl+CM/CDkxB6ygXUwjW49qfW4Aovb50Q7BcyBwm0ZsdvA6vq3Jnnc27DSJcvXQOlxcK1zWmBaGq8lsDoIdRWh7OxjE4Cg2MpXNf0cG3wWuBFjvTqxV+v8ACu97LfbdBgwO4BL9S2Zy+HbvoMdi2hHLJQdpGO2mTYbKPCzbrwQ8oQqpJyLA07JYVzZk5fKZzELdyAWXs2t7B4YQMHmYQnrQObylnwEg8K8OIrTCaIkmRaNY8ZxkSZFl1NngQvlHhnm7q0CG70sbfflO6NKYmqblEWbaJEax/UxwvfMMf4ks4CotJsbRVPM5GNK9N9uW+11iT/buVZ+VxeLjtkiNRajBVGGOf6KT+oeVO9cviiKKMBLAzF6BHQwSABJaOe4Gp0Lg0Iq6VhOuOQyeeONeHKSTcwWfwkI0X82VRLziCvvT4ekgsO4QjVTNnyuoELa9lGzGLzplcKTmGdtViSuhwq43v7xE4H8aBXg1CiocEakZJrx5b6YBKY7HD/nyJoXeEyv2a+A2/OrEP98rWO3iv/Dv6SHkjvP5D+KXK4/RsXMVR3iq1BlvBmVKCSpYLuj14BsA+7r2nSgEnFXigtHZ5IIaAdNgDsIOXb5Q5fSzOxy567GUMHxeXh2iL2MeyBL/ZWCBFKziuiPn20WMHn8fPbXQ/b8NLbeuLxKc/dwRoix1QvAGzvwHjWiKY7334PDpchEuxZwnc+8g0DpNcUYchEClaGcwlDfwe9nF4eu1jz54Tk4x3B8Krq4/USyY94TiLnYs7qwrqlYdecktpPmdGwCzddY4YaebUtCnRAUWqseFC87u877F7ewcN7rl2OP1O/K4Frewn1LHSjPokKNxs85BKHv63NjMpMWi2ER/H3qDFH2wguPffOH2aXYO41HgmvUdtJagmCdNPVal9Zn3GmeJnRmK8QzjkKGEMjp/eBWoZrgDR6nd72LPv2Lcmd3C04PbRWaM8oMc+9gAcqt7Hdk/cEp2wlbOKvmBJ6hlbYFMnIbEtK2GyF4KSGH5orW4rzXeOzuUDZlyYP2fELgDg6CJdU/Ig+vD+JFncwFsyS5Wbw7jZWjDyr+M+jnicLgVGKn1M2G1M1ZS8JJANqdGHf/VtIUSORe/BFagjFTW7Su88Aj+Na2A9UpPejtjgpFbCeU3Jdk1WhMfreaYmIrxhtU8snEMjG/0+DuDJkDmyjsLehDBdwaF8UXeejLIRUmBDgHjxC59jJb+10KtlRr2v2AS/PN7skX1zQanUWz3tVooMVPRbKi5K8FRqIoUTe2W+ODDg7s/nXP3RGUStXAflNfpmOgC7+DTOxMtnf/pWOGwNRw9sOcLYbD5wJdA+VezO6i2iuMMt8K9rfP5u+G+LoDBrlVTTHfG0BdDi/Cts0AI4pDDrA1fFt+dotnDOa+AXcQ6M52Lownoss0Zx1R5gHQm6GdV0Xv6tlGIsD9LRISVUlMZgkXtAuoNRvdSgwatnE4zdBf8Gssn/OZjMOegDVCJn1OaCvNcPG8yPsnzqaiMz2MF/4Gdm39e5eJ8V7XPVeSUuMp5lxKhyztQkZz9n02gjs/7z8L1w/A6uYucEKe0gifVsKgGzZUg4CyFeGgso9emykEniBECelSpuijeVittGKWg2iBECJIBQOAhtyDvPUi3+f+OSGWP8LLzP2SVZwMBRNCX83vyQW0DqlR+qe7cssDuVo3WNmD7gALfAAv2xj9sgTwq6xTvwoln3dCEeY/udQqJHbXNN1etlht5hS+00JJqKOIO9fFeHuyQ1uf4nHS+PSqChJWOx2sBL0P52WBUlBUzJUJbWyalgjy9LO+hEfasha2Z44OsFd252csCABpfOAOp8Er8WQZ+oUqDOG3EnzENq8FqUbbzm5+L8+TCRdj8On52VYNkXi07reJi0FYKZkmQaZ4piDRiHMGxB2fU79bgrbomhiHqGtkEose55KEkHmxbaKp9sNCOT5/o6bQVeTs5O6aUv2NuO8fNx/8L7uh32BVzjfI4D2vr0zIeV83vzaQ29ebnctVJA6GYQz9wbn0drxWjWJy7ZNv2ehIum4isdG0IJHW6JE/C9c7wdTYJxOUFeY44gM5CuWy9XfDkIjkjt8Y8ztBLTPidMcfzvZibZYJpmLWxGCPWKlkASwuvw0oKxvAW+GciP+SG8NL6kjJMM3q9JwSfR5nEEDqciP1Um7ZCE62J2+5CPwJcUbvBV3BpliMQ3OHRzHJyRAhpIKWvrM07A4UWg6nymIejdXT2+Aucq+WSsIR2v8Cx8Lx1Xst1QjdBvmfLkyVTyTZqNlh9tjUqvRINnHn7VRBydXMxXoF/h4AF1PoNcz81HLdleHwFJSsegtHbcH4GNdk6TgJnZMVVyzsEaxgYfxcOyZ/ssHoVdNBZVKfd0hXk1muVD14wbmzVGx2VP6nG9IyiR/Z1xPA9XQW9xDKV2YcKF9VsgOkEhYR4l5Exy2bV5UhgcIP9IEI9Yb4JzcVhHGfVSRoMeP5W8gnfgJZZ9BzZBMChjzcp4aS0RFDEx1V3OlFRkz5EizkNwkFqmpJjvZxopg5fjVZlvPhUDFliyK5Qyd7KKAGERLE+V3ZwY0pem/Vv9/nvLL111Q7naGFQgvmRtb1fpkQ0KKVranIRIUBaXOItwfz+MDUH5rHBepqW+0ou0gYaEpUQGFp6sn4yY5CnB8A38mArhvxg/r0DzSWgW0Ds4WEDkSjCeGhstJ8os5CGJS3Cmbupg1WgQJwlyZTRNWvBM3Ao/CD1X/SUsIq17CpoeqAgVS1vPmGq5/7JoyqDDdXA3SC3Mr8NiyvevuPhpCo5XEZP7jJdQMjOhIAb7X5zyMQ6NH01gfXKg/rBCzUfhI6jdDXUrfAwNmin2K9jY2y0qUJIIteaizvhyBaG6Kfw88Uabqc+XFUDk6+3texb4O/ySAtW5NfbQCrAZmuEL84w6JW8l0CSVyZ/WpuArRdbGxnu1OMdI7Xb4d2issR9AC8KeUPabgzXhos9RRWM6zG6bGM2XpLn0H3iBPTOLrApUsH2EIy9FnmZaicZDLbNjgA1a7OEReHFlc/pWfD8GtCDsJx2ULRSgTLKznjNZQ1IZp2LILGXNLhdS8WFWeC+pk64XrKYFsBkGDXbwUvy58I4zcAEOWGkSFsLGuD7MieCEM5OeKyI9KLFd8Zrcpyw+SUooWukbJk9UJQfwVaXv++M4CwscgC+YxwF/lR6m0wwxuVpJljaxPcYU5hywUFxTVHy6E4AD4msXCywCdlL3leIvXZ1j+Ro/sfRMx9dIyreY3n8UjsIB/A4uRm1Svvth3343ivSUYQCYKqHcoNQs/eQ8e8J4Mg+8T2Hnh2IsyK+x6qlyxHQu047N0cc0qnEi7z/KGgXKZNVOiz7zZ3iNDTwQsdRzkXQKRQmS+f1m63img6hugKCqvHqP2bBRRDJjcasCArZ/nmTbPiRqw991mula+wcnsrZxe8R8SpRaBSgS2PZZKPFJsjqvxWfRipKMKyq+1Wv109Wf7m/mv3yuqR4dgAEPrz5yL5u6oYxniViLesxWQjlZD7zuZOEE/cm64RJX7QnmBJ8/RVk7eLXlDg32cIPgk6ejtYWPlBDJOveuNVgMFVJATTH94VwWqNKEEc1qft0DYwdPx4cRduJ/DTuqjHOJbHIJbJ5mleEwk8/Ul0Wn5Ebf4wp4lPDbhzlUeB32glcXvFY/3Zt+In8yPtNoMrvAeLJH6bePw+iwgzdVUazwj+fjMBiLSZRQ7tGfnmT9Dihe08RAQLvlsqObTTZJqjkfYjWzFjgr1657gDzJaizwBdzWecedcQla9Ogi2WzOnF1G4JY1NnJlQb0ZUJMqcCua1QHPdnwJwB295t4X4d1YTOqjJeWjsNEXM1Au9ar5i8ht4oIK9Ui6JzWQPBQXWb9033KN7idf3USi1zmmdt8j5tM/N8LPOuvJjg0q/icP4zB67KDHQ6sb03vjR7FXrlpqtsIaJelyUxSKhcJvvmHjSH6NEgqkXHRFcTimm/ZFosjESiMCi6IoJEjJUZATDvvkB5s9/avJnJ6LD0zcRHEXOpId2KGGQQjiJ5HucBuBJkXKjqtUjHHC+yY7a43TP84i9IlEDQV/TFjMIw7oQdjDj0w//Tc8abo2doqNJCgukETP5jSbhFgDrmw+45xpbnP0V9/yZ7sCKOowzpnA/Cu9iNRrCP5k5d/SJ3uvuWFwPNMhONMAwhtwqProvdo+t0ZoAYGXqOSlbEnNDqh5ss04Ag11mCXeuhysA9WA1Fw8BhwE+4wG5+GquAAfxqOmn9FaTFzroSS4ytzgGexSZpIVXn8L33QkBnQY0OC/8MP4BoCv46SpiswChIyqJq3qtnrvJF0Oycwu89tSc+2jMUwi6GY2IwarJcOQKIgimh1561s9L8aeQl+9yXEj/Dz2LACL1Fy8/VttCj5CKWEDryUmktJ6mssHwCqugGGmKTPXCPGMvisdbWAsfo9A+BpugNvhsGWH54JyFs0EkVHWxG1y7BYD7U11zoh10lFjqD+alM/jONwYP4QvTRscEnGHVNpBAf2jHHgP1TSg5pGx8KSKFB9vRDMpeNIUHaRSXhTNe1LfR9n5t0RcUMSv1QN4Iy6sPk9+H8dgsNTUlM5kG8tZVJvYghS1djkUJUXHnoP0AITO4nzxhRQ6upSUA21AnMKRsB4JCAWOUiEcXOGqX58nhiKOatf+mJHCd5ATiqEi+ev1joNJdi6fhHAZ7jdr0E77LR6stG6EqRU3/CYnDbUMHhmfwYXAJMYxBHSGEFIq4VhLYC2OZh5tJTrbna5ZTm+t7pmmFEuDHjfCdQTDcpHFOJegD0gQPXSZEVjx8MiTHwwtgoyXHVXv9zfU85KPl07X1aQ3eXMEuILKhIXnVdwpaaDnqT1JY0KFI8ZbHbelkFhjp3BfWF3nbDEmzRbkLoG+omdaeuUmYUx5w2RCaWJisHpALXYn7VGe3bs0D2rGW6CHXmBuhnukk5aU6c9GazHOLtKDM4gSyq768nEdEszEDQzeg3+pviJ/Fic7xCdGcMc8dVKu3AFFs+jGKAOd0n9PhfVQSngy82UzSnuxpNCbi5EJKwydmaAqvAZbJWdCfxbfTxWlnneKvrsUM7EOaTXP2MxX/m2PwenOHpSR0kxGKTQKW/RKx9GPi5TpiLEF41q4q+D9nW+TBj61DilQLs4K9bl+PBW0vAzChubahgYQmww2Pd6B3akMlbAN5ggUdsip2bJoTjiSONNDIgQJALkBUq7ZQgytaE0cLIvhdBzwkQhYlykGKWiaWwkID174Sor5YzGEjZVHyzPZXK2hUU5yQMwim1ntmCRK5XFEhUhCiC/LO4bzZpiqybrYCiURne7858Im2Brm9YCa+IqxKMu/9yK+9Hcd8cBBSBVAuDuJblA2hAjOwR7W2R17Vt0QBuHDuKC6FTN44sQVQKIdYnBtY2oU74vWCnbyhAysgFDWn4achUvnveFNheni/FrveKU0A5JeotBOGaQpVyqBmEpk48NaOAVagylhuZC7ySPiNRj+j5xsYWmYT6Ibs/RKCYdwtNhPdO4EV5LR0TxbAH4+VoMTUVgPYIEGZ2xhFJ+Aa08F4UFLXJpKE2PIGIR1JBzm+ExxKSctn0EqFVwObWkKtghSTDPPZFelhD+do6TW0gC0FgULNsKZksDfsAmT57AhLImL+6vYQsah6OHqeXiaoWYQPy9TbJ7moXxT+hLLXHUngvW/jH8CHDQJZ4hpOCtZQyqJptYsnlJwZVtdWODjWT5gbKANdUQKUEMEzk/X7xGBdEmsrWqEuiz+n9S+fY5YTSmoZq6zOEv0NtnRcKdoFPS2AhaE4BKdwUkVghDCQ+ryyjHMbgabI6FYwbPmJTtpEJ+pnlTZQEToXFKq+xwQO7ohJycKnqxKrvmNCRRcLQUbZX2dUplQhpwV5z+XDsBzhfM8G73jlXECl0MKioREL5MAQdCPFVWCGI0apvwMzBZ6oYCTcLLdSoyY9Y144zfteKIthjJl+vRcRWClvADFKkNm2XetJ4Ct83auT1en3eOAeggFsyEL5xx4Pq/Z178uboCSM4O/jaE/R5qupAgKjfjae4jP6Y8mdGk5IXa+n71OsszdyHq0+Nvq/KYA8EYY22rcaEaDqz0wQpw2YNG9p8IFkgL5lvEAlCoAlJu/ppBOhAt1ACQKYxK4sfKd1TIZHGcA83QE+s9ottloZ7DW1+9How1gS5wIU/OsE9hC8aT0nsn6pS8T3vsufM0jaU/hU+bLIPJMl0XzwFcZ3W34psfgDOynKir1cqZLwAQn2XGoYPg12g4SdXZkGj8tNCOxuh5fQZttPDVqpoyFa2ahYh2PR2rX97u6OdA216rjqf4nTob4NRNBRp2CbmDoUtu1M8wiB+0RSJYp9KYGihQcSOzIZkEYkaK+fcmsaq4FCc+jrpkdAvYI9sJiYxntCcApOFb4/G/ZvHEMiiKhcUGjtQwpOOXGUhK1iEPiQh0XMaDB3+M9WzCnL8ZxljEsTklOrFFUsY7PGfgHZ+Eh8vDPpzYp2QO1cIUSnqmJ0LlzKSpyGkgptSsqYioq96xy0st0BJs6lwCY4Yi3k3LR/CtJNlERkoVRn1N/0xU8gvXPFn73TXzMtpDMUbtIrwoqiHR5jac62Lr+47YySueCsY/ekxxE7ZwpqdIIVHHarEvdRrM5LTmDnIWoPklFwoDrq7Dm0Y0oBqjw7PLFtrrhEPAxlYaO5bk2bSviiNUpbWipmIWBkuF+yXwYqppYk/3p6JneHCcK7zsLe4DlcBrU+58LjspTciJL4S5vfwOAz+NtWzCmd8VtbHtuE8VW1KIeOL8RE7MmmiTlCqBDoAczODyjQ/FUM/a9RoH9+kJ8NMEsco0IMY8oRSpQrCTfV9VUvTvFlYmT0wQsLE52BObiNAIFWAYOvivuIjfVjClH2Vxf34fXwAlT8NxKdaxIaQ6F2DFHChxIIviL6wgU4DnzjLJUPWM9KJGICeKzp4pneB2MzUYO0VbOyT6usKGEhAZS9toGYkVdTjSUs9gnNdaCHi9oVWx+/BGuEqANliKBqGVMRz2XYQYP/dyMz5J51awB4w7luDappFIStkOQ8IjyguW1zVFJCoGrdKubIwJLHwIcIW+BYbdMZq9ueY2SCSU6QukUcqSJKME61uF43F743YfwJRzwGkdKkSq0oWQm1E0rN896EP4Jr8V9q4/msXgMnmfjBuM5YVzPmBJaS8tRP22epmYzs5bGsKG+vVHFpsnZaV2Dllo+nJhiaXNIAoScgoCVRDwgi3lbEid/LS+Jp2iCg3xYPgBd32hTcTIjlIrm5LwglT2fBVRFWZMEbckvdSOycIsdJnNgAPRWkCQ8fgNAo7R6y2PNQUmNIqme+TOr7P2DE7kynrwFYwo8F6/Hl6ZO/eX4DSM5dK3lsuTA9jtp9dse4Hfexq/SFjP5VdLlE4O1kSHaoCyzatj5xAESVw9GWdAokHkHSAA9p6liKEMBzUr+iiu2GcfA67hqO6/bLkRKaM0TGv2e5vWHNHukEJNQUFKV0jIQ0AIatoW3gDSlwm3nCnis+L4/B01uEgcVea0qwYGqAs1sdKFEdpUU2r5QZ9bgP8Vy2ubHq2T6UFONKXwfhyb1lqXAQG//3wd/7+x73D+7wJCu+DxXf3N/NyiyCVAYG+HsJbQBCZpRIOglzFZc0EwoywbzRkwD5eTV24GNk6UP5MJwe1irCswFT5MTBb08Iz2tgXP9dupHrPAnJWXh+yh+WId20r3avOmEi0kMSSAuKpkRg6WKbkAikeDmx+1xB+kKaoX5+9YkstONTUFLAAdtgJJghWyclkUho1TcKfKDhoiblKZekCHwS0kI45pswMFCh3g6zJb5AeJ/h0FnTpyOK4RHKbBSHX5QVjzywT4j3ljsQ06MsIJMLe1togKOp/g66j2PbVXy2bK2LhWdDJ4PmRq5hcFeMI6UmOP6HbP3lOKEmJbCwlSsDVcrR0y4Sz6rsRx+IX4TT97CmL4LV8Il9tumNEpbafd8Ph6NhcUIuj5co0xNF+TP0b+WSYNu0tlmix7zhQrY0iUv1bRHcz7Yn49sP6vHcRDn4Q02vxGD1/2F1maKJVwIXEKQMUq3JUjcAhRV9dmpZFIEwyHVfyKFBoWTRBhcUYeIA/EKM82YEFfYzDD7UtGPBSQFJ8J19nrlKaDo40zzLiVQBjpVYwnmoCbRTOyorFyHHncXP/tx/BMO2vW3AqpzlCJI9S6udLOkrHT8NzkVxkLsFzsdg5OfH1f5s7ZiTIEX4QxrSya+grZa//X34zv/OA1vQDOxMebY9nVYcJMsTUhmlUXBFJrdx5wCi7Pi/8z3hWgmsRqyXPu9kLMlDF6cUGZGzAbGprZPSMmS4Gb+qKlWzG3VchhP4oVGVHwCXqDeVyphFsKd8h4rBTNWa8imDOG2G3EOIOxszTe9L16OT0xR8LDkM2V8rxxfsckHI9Z8qQj+1EdM43PCb56p+05FuTrKNlyWX0EsVVYj0MzzxK6LbqUCv5VmA8nLCKlzWcjUc2PoehC1Tb5Riz5sK/U3VZyhtyZbWObWA9KfZpF3g4o4LaTG8w5Ai4UgWF3neDdav2xr8L10XFSBtaiPRPOQYdYnBUhFUd3TryBzgl4vrAWTWNOMaQxZ0AIgr7cdhQQt65NtpKj3Vv3iKAansUDoFiY7WOSWD6vy+s84obIQssxL9H4kdP3zxqQt6+RMWeSGeJwC1r8UrSiXIysasJDiokAiO4U1kWsFFLBipKg5/b5/BtDiYjx9K+N6NJ5sv2lwa9PfKyb1ixMOQG+uJNunnIKADRuS65Haakmz9Aa2Hd4OW/WXdB3LksIoVWwgoA0F7XgL10rJ+GhdASEfhDeSQR/C1ZVeoReghXGiE65yj1SYCafsM8k9rwEdGC1esKU5/ET8sFvJ+d7yTD+f7IBypZbbbJifFj3hDGVgGuhBCvV16aTlDCv/HOq54QjR8PmbSbMWYwBlQtCSjhyq0ixQxiTAayjwrt/60oi1AUKn+KX/gs9gByYAtemwNhKNYSpvzEIz9DpRkc69sI8eO7gYT9haqN+s7sEI+b//ucfnAt1tH3ZbljPtxFouZTKVpIQtbmidRqpSVE0mlcwu7uOnIrye1O7QV1rOnOkZlza1lGmgCDAvKQT5fTs5FaG4d55U/dYQXE5R8wYLKICYYo4DLYXVO80skewyWht/rhsYdLicwv75G45yFwkEP2mBIhn7racDtH4wqEgBXx+DEvOZ8AIc2opFuRqeuVohJsOR9D/r+C8gMKeaSWwLoMdcJGLCs70zbAzWT7P+86xAtaval5/PEHIW/zxsyK6ANUeiPJznQsIWvSiznQSLCTaKcZN7rPLutwDoxc2UNxLGK0MEpEqplGFBIw/H3APY34oENAA8Bjdb5UwHcKUd8Dv/+L/CrkhBtnR8OAfUc1xuRs6Gqyj3aHXPkoo8FxHhcURKvPr3QWxDIVNaDCuhYeDy0EuDoQ4PKTpHqY2MEvR45X+nAsWCdD6WksmCOi01KZKcDruKX3o2LgawbzU506puXCgww8kQP73VsqggTNnEwFgjIbwVX96SVfkILr9kjWIwvoKzcSwMjsLCBhi9bfH0gUCuGJ1xcoj91NxJaNCi8fIz7NF3uaRV7ITVBg2aie8bExB/BeofHK+SAhVrsvsu2bOsPj9MDWYX4AuO8J8WZoxXewl6J283YB89BuxjD5+JunZ0Jp44dNPgxz7HOkWdUCQG95wsXlFA9ccBdRwlGwYGmwI6Dz+OfRyDFgvseJnjfnoeq+e3PPYwoMNhDGjxJVxa6HGsRuFz+BcMGGCmBuSxLHiBVeFB1AdD2SwmRXwM5IgwUtSnw0H2WzaVoYoCi906OhaVlCQDAByusNT3PHibmZ7YEovZ4ba4BPt25e3AYAdH4yD+zqZhWEhnhLETJQl75Ly4Bh2URNwpQmiHeO2QWMh9R2/B9T+NO6MDocUOWjQgtGjRWpvRYIEFdtBigRY7MGjQYhe72MEudtEmXM6X4RfAS6PIU+e6mVolh6CXOqR+aCaD6ncxUZRzHNSOEeMQ7HmNWbM7X9wwhhyKWA7ARmEvBgnnMxhgcNDpyeoi+jEqbOgMJwJ5E4ZEhSbZ0OnyfbHBhcibKgH5Q25KDppvV6PXTBoDSy35cDNsJ/7xwQokD0ofCwmJjVU3zrggzNRj7TcikrcVS0uZhdEjxbtBBmgfNgizUFQMjW7amIbn0wi/GxAuj6tj346lzzVhvLviiQuDJ7dnxUTxfz1fcBAg8eOTpUBIsfecF+m6SezhK20AZhGLKz1HSpS+WAAexl19xkFHDFETACtyS4TWcdkIBi2uiCvhoI21Ru2BXVyCjwOgpQPfTp6d8do6y1R9hogAK0eQVcYJtA7agDw5YD833AkFBs1gNc5k7USPJKe3KDHg5ERDWJAlztXkY2MamsS4nTJlTGUdImO3z2WzroQNNVi1iPbimMnlOndZLc8CL2NnxC2XBRpBWdtKawalYGH7Gk7ktZtubkzDLYoT6glLP38Qx3JpUmkyBawidml6bqExZevvt04kyRPkvXPeT6LnTCq4EEkkMakzX+L64khhC4lyFYniksvIaUigBtxG8WFyzsgpwrHn/IXPhVp7qk4xpibJ6xMn3IdZpjJHBb0+zmCISKEpk/4O2dDdplESNb5l46hzhLNCByz/nAMPOJToIxFArk1nniH6wkpSwa+lpxENFDXW6r3oLiuCmbYpnzB6mLKpFLG9h2NOmWxhTJXHIh0fqb/3ZwQpZT8SPDAWctN5JQESCizG24CgGFwTieDF+WKeUjouIRF7xT6O2El1Fi5OkhvqfPwx427Me0pKqqXEDx635jR+e8iWynjC5jMa36P9f5jdFcrxfNOjAAAAAElFTkSuQmCC"},"heart":{"w":63,"h":70,"src":"data:image/png;base64,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"},"person":{"w":59,"h":66,"src":"data:image/png;base64,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"},"phone":{"w":62,"h":64,"src":"data:image/png;base64,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"},"pin":{"w":58,"h":78,"src":"data:image/png;base64,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"}};
try {
  Object.values(ETQ_IMG).forEach(o => { const i = new Image(); i.src = o.src; if (i.decode) i.decode().catch(() => {}); });
  if (document.fonts && document.fonts.load) ['400', '500', '700'].forEach(w => document.fonts.load(w + ' 20px Poppins').catch(() => {}));
} catch (e) { /* si falla, imprime igual */ }

// ─── Pasar a Grisal directo a la planilla (31/10) ──────────────
// La app manda las cadeterías de hoy a un Apps Script de Yoan (app web) que escribe en la hoja "ingresos" de Grisal.
// URL y clave en config (grisalUrl, grisalClave): nunca en el código (el repo es público).
const GRISAL_LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function grisalOrdenNuevo() {
  for (;;) {
    let c = ''; const r = crypto.getRandomValues(new Uint32Array(8));
    for (let i = 0; i < 8; i++) c += GRISAL_LETRAS[r[i] % GRISAL_LETRAS.length];
    if (/\d/.test(c) && /[A-Z]/.test(c) && !(DB.paquetes || []).some(k => k.grisalOrden === c)) return c;   // 8 caracteres: el QR de Grisal es "EMMA" + N Orden
  }
}
const grisalConectado = () => !!(cfg('grisalUrl') && cfg('grisalClave'));
const grisalPendientes = () => paquetesDeHoy().filter(k => k.tipo === 'cadeteria' && !k.grisalEnviado && !k.grisalCopiado);   // las copiadas a mano ya están en la planilla
let _grisalOcupado = false;
async function pasarAGrisal(solo) {
  if (_grisalOcupado) return false;
  const ks = solo || grisalPendientes().reverse();
  if (!ks.length) return toast('Las cadeterías de hoy ya están en Grisal ✓');
  const [y, mo, d] = hoyISO().split('-'), fecha = d + '/' + mo + '/' + y.slice(2);
  ks.forEach(k => { if (!k.grisalOrden) k.grisalOrden = grisalOrdenNuevo(); });
  savePaquetes();   // el código queda guardado antes de mandar: si se reintenta, no se duplica la fila
  const filas = ks.map(k => {
    const c = cliById(k.clienteId) || {}, e = k.envio || {};
    return { orden: k.grisalOrden, tipo: k.tipoEnvio === 'cambio' ? 'Cambio' : 'Común', nombre: e.nombre || c.nombreEnvio || c.nombre || '', tel: telLegible(e.tel || c.tel), direccion: e.direccion || c.direccion || '', zona: e.barrio || c.barrio || '', cobrar: k.cobro || 0, producto: 'Paquete chico', fecha, detalles: e.nota || c.notaCadete || '' };
  });
  _grisalOcupado = true; toast('🚴 Pasando ' + filas.length + ' a Grisal…', 3000);
  try {
    const r = await fetch(cfg('grisalUrl'), { method: 'POST', body: JSON.stringify({ clave: cfg('grisalClave'), filas, marcar: !!cfg('grisalMarcar') }) });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'error');
    const ts = ahoraISO(); let n = 0;
    j.filas.forEach(f => { const k = ks.find(x => x.grisalOrden === f.orden); if (k && f.fila) { k.grisalEnviado = ts; k.grisalFila = f.fila; k.grisalCopiado = k.grisalCopiado || ts; n++; } });
    savePaquetes();
    toast(n === filas.length ? `✓ ${n} cadetería${n > 1 ? 's' : ''} en la planilla de Grisal` : `⚠️ Pasaron ${n} de ${filas.length}: probá de nuevo`, 5000);
    return n === filas.length;
  } catch (err) {
    toast('⚠️ No se pudo pasar a Grisal (' + String(err.message || err).slice(0, 60) + '). Probá de nuevo o usá "Copiar".', 7000);
    return false;
  } finally { _grisalOcupado = false; render(); }
}

// ─── Etiqueta 10×15 de GrisalExpress (31/10) ──────────────────
// Copia de la plantilla de Grisal ("Tablas ETIQUETA10X15"). El QR es "EMMA" + N Orden, igual que el que genera Grisal (verificado con una etiqueta real).
const GRISAL_LOGO = 'data:image/png;base64,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';
const GRISAL_REMITENTE = 'EMMA INDUMENTARIA', GRISAL_SUBTEXT = '097 088 511';
const _gIco = {
  casa: '<svg viewBox="0 0 24 24"><path d="M12 3 2 12h3v8h5v-6h4v6h5v-8h3z"/></svg>',
  pin: '<svg viewBox="0 0 24 24"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"/></svg>',
  tel: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11"/><path fill="#fff" d="M9.2 6.5 7.7 7.4c-.6.4-.8 1.3-.4 2.4a13 13 0 0 0 6.9 6.9c1.1.4 2 .2 2.4-.4l.9-1.5-2.4-1.6-1.1 1a7 7 0 0 1-3.2-3.2l1-1.1z"/></svg>',
  chat: '<svg viewBox="0 0 24 24"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.2 1.1 4.2 3 5.6L4 21l4.6-2.4c1.1.3 2.2.4 3.4.4 5.5 0 10-3.6 10-8s-4.5-8-10-8zM7.5 12.3a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6zm4.5 0a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6zm4.5 0a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6z" fill="#000"/></svg>'
};
(function () {
  const st = document.createElement('style');
  st.textContent = `
.lbl.grs,.sheet-t>.lbl.grs{flex:none;align-self:flex-start;box-sizing:border-box;width:92mm;height:139mm;padding:2.5mm;font-family:'Poppins',Arial,sans-serif;color:#000;background:#fff;display:flex;flex-direction:column;gap:2mm;overflow:hidden;line-height:1.15}
.grs-top{display:flex;align-items:flex-start;gap:2mm;height:22mm}
.grs-logo{width:48mm;text-align:center}.grs-logo img{width:46mm;display:block;margin:0 auto}.grs-web{font-weight:700;font-size:7.6pt;margin-top:.5mm}
.grs-der{flex:1;display:flex;flex-direction:column;align-items:center;gap:3mm;padding-top:1.5mm}.grs-fecha{font-weight:500;font-size:10pt}
.grs-tipo{background:#000;color:#fff;border-radius:6mm;font-weight:700;font-size:10.5pt;padding:1.6mm 0;width:100%;text-align:center}
.grs-box{border:.55mm solid #000;border-radius:3mm;padding:2mm 2.5mm}
.grs-lab{font-weight:700;font-size:7pt}
.grs-dest{font-weight:700;text-align:center;line-height:1.05;margin:1.5mm 0 1mm;word-break:break-word}
.grs-mid{flex:1;display:flex;gap:2mm;min-height:0}
.grs-dat{flex:1;display:flex;flex-direction:column;gap:2mm;min-width:0}
.grs-f{display:flex;align-items:center;gap:1.8mm;font-size:10.5pt;word-break:break-word}.grs-f svg{width:3.6mm;height:3.6mm;flex:none}
.grs-f.dir{font-weight:700}.grs-f.chat{font-size:8.6pt;align-items:flex-start;margin-top:auto}.grs-f.chat svg{width:4.2mm;height:4.2mm}
.grs-pago{background:#eef1f5;border-radius:1.5mm;text-align:center;font-weight:700;font-size:11pt;padding:1.6mm 1mm}
.grs-qr{width:28mm;display:flex;flex-direction:column;align-items:center;justify-content:center}.grs-qr svg{width:27mm;height:27mm;display:block}
.grs-qr .t{font-weight:700;font-size:7pt;margin-top:1mm}.grs-qr .n{font-weight:700;font-size:11pt;letter-spacing:.2mm}
.grs-rem{text-align:center}.grs-rem .grs-lab{text-align:left}.grs-rem b{display:block;font-size:17pt;line-height:1;margin-top:-.5mm}.grs-rem .s{font-size:8pt;margin-top:.8mm}.grs-rem i{display:block;font-size:8pt;margin-top:1.2mm}`;
  document.head.appendChild(st);
})();
function etqGrisalHTML(k) {
  const c = cliById(k.clienteId) || {}, e = k.envio || {};
  const nom = String(e.nombre || c.nombreEnvio || c.nombre || '').trim();
  const [y, mo, d] = localISO(new Date(k.fecha || Date.now())).split('-');
  const cobro = +k.cobro || 0, pago = cobro ? 'A cobrar ' + fmt(cobro) : 'Pagado';
  const det = String(e.nota || c.notaCadete || '').trim(), zona = String(e.barrio || c.barrio || '').trim();
  const nomS = nom.length > 26 ? 12 : nom.length > 16 ? 15 : 20;
  return `<div class="lbl grs">
    <div class="grs-top"><div class="grs-logo"><img src="${GRISAL_LOGO}" alt=""><div class="grs-web">www.GrisalExpress.com.uy</div></div>
      <div class="grs-der"><div class="grs-fecha">${d}/${mo}/${y}</div><div class="grs-tipo">${k.tipoEnvio === 'cambio' ? 'Cambio' : 'Común'}</div></div></div>
    <div class="grs-box"><div class="grs-lab">DESTINATARIO/A</div><div class="grs-dest" style="font-size:${nomS}pt">${esc(nom.toUpperCase() || '________')}</div></div>
    <div class="grs-box grs-mid">
      <div class="grs-dat">
        <div class="grs-f dir">${_gIco.casa}<span>${esc(e.direccion || c.direccion || '________')}</span></div>
        ${zona ? `<div class="grs-f">${_gIco.pin}<span>${esc(zona)}</span></div>` : ''}
        <div class="grs-f">${_gIco.tel}<span>${esc(telLegible(e.tel || c.tel) || '—')}</span></div>
        <div class="grs-pago">${pago}</div>
        ${det ? `<div class="grs-f chat">${_gIco.chat}<span>${esc(det)}</span></div>` : ''}
      </div>
      <div class="grs-qr">${barcodeSVG('EMMA' + k.grisalOrden)}<div class="t">Nro de Orden</div><div class="n">${esc(k.grisalOrden)}</div></div>
    </div>
    <div class="grs-box grs-rem"><div class="grs-lab">REMITENTE</div><b>${GRISAL_REMITENTE.replace(' ', '<br>')}</b><div class="s">${GRISAL_SUBTEXT}</div><i>¡Gracias por tu compra!</i></div>
  </div>`;
}
