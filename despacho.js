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
.dsp-ag-h{font-weight:800;font-size:13px;letter-spacing:.5px;color:var(--ac);padding:10px 2px 2px;text-transform:uppercase}
.lbl.ag2{border:2.5px solid #000}
.ag2-rem{border-bottom:2px solid #000;padding-bottom:1mm}
.ag2-emma{font-size:1.5em;font-weight:900;letter-spacing:.4px;line-height:1.05}
.ag2-rem-d{font-size:.95em;font-weight:700;margin-top:.4mm}
.ag2-dest{margin-top:1.5mm;font-size:1.05em;line-height:1.3}
.ag2-dest small{display:block;font-size:.7em;font-weight:800;letter-spacing:1px;color:#444}
.ag2-nom{font-size:1.65em;font-weight:900;line-height:1.1;margin:.3mm 0 .8mm}
.ag2-box{margin-top:auto;border:3px solid #000;border-radius:1.5mm;padding:1mm 2mm;text-align:center;font-size:1.6em;font-weight:900;letter-spacing:.3px}
.ag2-rem-d{white-space:nowrap}
.sheet-t .ag2-emma{font-size:1.45em}.sheet-t .ag2-rem-d{font-size:.82em}
.sheet-t .ag2-dest{font-size:1.2em;margin-top:5mm;line-height:1.5}
.sheet-t .ag2-nom{font-size:1.85em;margin:1mm 0 3mm}
.sheet-t .ag2-box{font-size:1.7em;padding:4mm 2mm}
@media (max-width:520px){.dsp-segs{grid-template-columns:repeat(3,1fr)}.dsp-p{gap:8px;padding:10px}}
`;
  document.head.appendChild(st);
})();

UI.desp = { filtro: 'todos', q: '', idx: 0, items: [], cid: null, sel: new Set(), salida: null, f: {}, sinPago: false, aviso: '', res: null };

const CUENTAS_DEF = ['BROU', 'Prex', 'Mi Dinero', 'OCA', 'Mercado Pago', 'Efectivo'];
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
const esGrisal = q => /^emma(?=[a-z]*\d)[a-z0-9]{6,12}$/i.test(String(q).trim());
/** Pedidos de una clienta que todavía no salieron, del más viejo al más nuevo. */
function abiertosDe(cid) {
  return todosPedidos().filter(p => p.clienteId === cid && sinSalir(p))
    .sort((a, b) => (a.fechas.creado || '').localeCompare(b.fechas.creado || '') || a.num - b.num);
}
/** El pedido "principal" del paquete: el más nuevo (su número y código van en la etiqueta). */
const principal = ps => [...ps].sort((a, b) => (b.fechas.creado || '').localeCompare(a.fechas.creado || '') || b.num - a.num)[0];
const numsTxt = ps => ps.map(p => '#' + p.num).join(' · ');

/** Medio del pago según la cuenta: Mercado Pago lleva recargo; Efectivo es al retirar; el resto, transferencia. */
const medioDe = cuenta => /mercado\s*pago/i.test(cuenta || '') ? 'mercadopago' : /efectivo|d[eé]bito|cr[eé]dito/i.test(cuenta || '') ? 'efectivo' : 'transferencia';
const recargoMP = () => { const v = DB.config.mpRecargo; return v === undefined || v === null || v === '' ? 10 : Math.max(0, +v || 0); };
/** Lo que tiene que transferir: pedidos + envío (si lo transfiere) + recargo de Mercado Pago. */
function esperadoDe(base, env, cuenta) { const rec = medioDe(cuenta) === 'mercadopago' ? Math.round((base + env) * recargoMP() / 100) : 0; return { base, env, rec, total: base + env + rec }; }
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
  DB.pagos = DB.pagos.filter(x => x.id !== id);
  if (p && p.pago && p.pago.id === id) {
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
      <div class="row mt">${k.tipo !== 'retiro' ? `<button class="b pri" id="dsp-print" data-act="despPrint" data-k="${k.id}">🖨️ Imprimir etiqueta</button>` : ''}<span class="grow"></span><button class="b sm gh" data-act="despDeshacer" data-k="${k.id}">↩️ Deshacer</button><button class="b sm gh" data-act="despResX">✕</button></div></div>`;
  }
  return `<div class="card"><div class="big-alert ${r.cls || 'mu'}" style="margin-top:0">${r.html}</div><div class="row mt"><span class="grow"></span>${r.pagos && r.pagos.some(id => DB.pagos.some(g => g.id === id)) ? '<button class="b sm gh" data-act="despDeshacerPago">↩️ Deshacer</button>' : ''}${r.cid ? `<button class="b sm" data-act="despAbrir" data-cid="${r.cid}">Ver clienta</button>` : ''}<button class="b sm gh" data-act="despResX">✕</button></div></div>`;
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
  return h + hoyHTML();
}
function paquetesDeHoy() {
  const hoy = hoyISO();
  return (DB.paquetes || []).filter(k => localISO(new Date(k.fecha)) === hoy).sort((a, b) => b.fecha.localeCompare(a.fecha));
}
function hoyHTML() {
  const F = UI.desp.filtro || 'todos', ks = paquetesDeHoy().filter(k => F === 'todos' || k.tipo === F); if (!ks.length) return '';
  const n = t => ks.filter(k => k.tipo === t).length, cad = n('cadeteria');
  const hora = iso => { const d = new Date(iso); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
  const ico = { retiro: '🏠', agencia: '📦', cadeteria: '🚴' };
  return `<div class="card"><div class="card-t">Salió hoy · ${cad} cadetería · ${n('agencia')} agencia · ${n('retiro')} retiro</div>
    ${cad ? `<div class="row mb"><button class="b sm" data-act="despGrisal">📋 Copiar para GrisalExpress</button><button class="b sm" data-act="despHoja">🖨️ Hoja del cadete</button></div>` : ''}
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
  const ultimos = !ab.length ? (DB.paquetes || []).filter(k => k.clienteId === c.id).sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 3) : [];
  return `<div class="card">
      <div class="row" style="align-items:flex-start"><div class="grow" style="flex:1;min-width:0"><div class="pc-nom" style="white-space:normal">${nomAlias(c)}</div><div class="pc-sub">${histHTML(h)} ${c.tel ? '<span class="mono">' + esc(c.tel) + '</span>' : '<span class="chip pe">⚠️ sin tel</span>'}</div></div><button class="b sm gh" data-act="despCerrar" title="Volver (Esc)">✕</button></div>
      <div class="row mt"><button class="b sm" data-act="verFicha" data-cid="${c.id}">👤 Ficha</button>${(() => { const u = ultimoPedidoDe(c.id); return u ? `<button class="b sm" data-act="irPedido" data-id="${u.id}">🛍️ Último pedido #${u.num} · ${esc((liveById(u.liveId) || {}).nombre || '')}</button>` : ''; })()}</div>
      ${alertas.join('')}
    </div>
    <div class="list-h"><span class="t">Sin salida <span class="bdg">${ab.length}</span></span>${todos}</div>
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
  if (t === 'guardado') form = '<div class="small muted mt">Quedan guardados: el plazo de 30 días corre desde hoy (pestaña Guardados).</div>';
  if (t === 'liberado') form = '<div class="alert li">La ropa vuelve al stock y el pedido cuenta como ❌ (queda como deuda en la ficha).</div>';
  if (t === 'pago') form = '<div class="small muted mt">Marca el pago sin despachar (para hacerlo desde el celular cuando llega el comprobante). Al despachar en la compu ya figura pagado.</div>';
  // Pago: se marca acá mismo, junto con la salida
  const porCob = conPago(t) ? ps.filter(porCobrar) : [];
  const yaPag = conPago(t) ? ps.filter(p => p.pago) : [];
  let pago = '';
  if (yaPag.length) pago += `<div class="small mt" style="color:var(--ok)">✓ Ya pagó: ${yaPag.map(p => '#' + p.num + ' (' + esc(p.pago.cuenta) + (p.pago.conEnvio ? ', con envío' : '') + ')').join(' · ')}</div>`;
  if (porCob.length) {
    const tar = +cfg('tarifaEnvio') || 0, base = porCob.reduce((s2, p) => s2 + calc(p).total, 0), env = (t === 'cadeteria' || t === 'pago') && f.conEnvio ? tar : 0, esp = esperadoDe(base, env, f.cuenta), auto = esp.total;
    const ctas = cuentasPago(), extra = f.cuenta && f.cuenta !== 'sin' && !ctas.includes(f.cuenta) ? [f.cuenta] : [];
    pago += `<label class="lb mt">¿Cómo pagó${porCob.length < ps.length ? ' ' + numsTxt(porCob) : ''}? *</label>
      <div class="row">${ctas.concat(extra).map(cta => `<button class="b sm seg${f.cuenta === cta ? ' on' : ''}" data-act="despCuenta" data-c="${esc(cta)}">${esc(cta)}</button>`).join('')}<button class="b sm gh" data-act="despCuenta" data-c="">Otra…</button>${t === 'pago' ? '' : `<button class="b sm seg${f.cuenta === 'sin' ? ' on' : ''}" data-act="despCuenta" data-c="sin">Sin confirmar</button>`}</div>`;
    if (t === 'cadeteria' || t === 'pago') pago += `<div class="row mt"><button class="b sm seg${f.conEnvio ? ' on' : ''}" data-act="despConEnvio">${f.conEnvio ? '✓' : '＋'} La transferencia incluye el envío de cadetería (${fmt(tar)})</button></div>`;
    if (f.cuenta && f.cuenta !== 'sin') pago += `<div class="row mt"><label class="small muted" for="dsf-transf">Monto transferido</label><input id="dsf-transf" type="number" inputmode="numeric" data-inp="despF" data-f="transf" value="${esc(f.transfEdit ? f.transf : String(auto))}" style="width:130px"><span class="small muted">pedido ${fmt(base)}${env ? ' + envío ' + fmt(env) : ''}${esp.rec ? ' + Mercado Pago ' + recargoMP() + '% ' + fmt(esp.rec) : ''}</span></div>`;
    if (f.cuenta === 'sin') pago += '<div class="small muted mt">Sale sin pago marcado: queda anotado en el paquete.</div>';
  }
  if (t === 'pago' && !porCob.length) pago += '<div class="small muted mt">Los pedidos tildados ya tienen el pago marcado.</div>';
  const bloqueado = !t || (porCob.length && !f.cuenta) || (t === 'pago' && (!porCob.length || f.cuenta === 'sin'));
  const cobro = t === 'cadeteria' ? (f.cobro === 'pago' ? ' · envío pago' : f.cobro === 'monto' ? (num(f.monto) > 0 ? ' · cobra ' + fmt(num(f.monto)) : '') : f.cobro === 'cobrar' ? ' · cobra ' + fmt(cfg('tarifaEnvio')) : '') : '';
  const txt = !t ? 'Elegí cómo sale' : { retiro: `✓ Entregar ${n > 1 ? n + ' pedidos' : 'el pedido'}`, agencia: `📦 Despachar por agencia${n > 1 ? ' · ' + n + ' pedidos, 1 etiqueta' : ''}`, cadeteria: `🚴 Despachar por cadetería${cobro}`, guardado: `⏸️ Guardar ${n > 1 ? n + ' pedidos' : 'el pedido'}`, liberado: `❌ Liberar ${n > 1 ? n + ' pedidos' : 'el pedido'}`, pago: '💸 Marcar pago' }[t];
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
    cuenta: (D.f && D.f.cuenta) || null, conEnvio: false, transf: '', transfEdit: false };
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
  const base = ps.reduce((s2, p) => s2 + calc(p).total, 0), esp = esperadoDe(base, env, f.cuenta);
  const transf = f.transfEdit || f.transf !== undefined && f.transf !== '' && f.origen === 'mabel' ? num(f.transf) : esp.total;
  const orden = [...ps].sort((a, b) => (a.fechas.creado || '').localeCompare(b.fechas.creado || '') || a.num - b.num);
  const gs = orden.map(p => marcarPago(p, f.cuenta, f.origen || (paquete ? 'despacho' : 'pago')));
  const g0 = gs[gs.length - 1];
  // envio = lo que incluye de cadetería · recargo = Mercado Pago · ajuste = diferencia contra lo esperado · monto = lo realmente transferido (sumando las filas)
  g0.envio = env; g0.recargo = esp.rec; g0.esperado = esp.total; g0.ajuste = transf - esp.total; g0.monto = (+g0.monto || 0) + env + esp.rec + g0.ajuste;
  if (f.nota) g0.nota = String(f.nota).slice(0, 200);
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
    ps.forEach(p => setEstado(p, t));
    guardar();
    D.res = t === 'guardado' ? { cls: 'mu', html: `⏸️ Guardado${ps.length > 1 ? 's' : ''} ${numsTxt(ps)} · ${esc(c.nombre)}`, cid: c.id } : { cls: 'li', html: `❌ Liberado${ps.length > 1 ? 's' : ''} ${numsTxt(ps)} · ${esc(c.nombre)}`, cid: c.id };
    cerrarClientaDesp(); render(); focoBuscar(); return;
  }
  const porCob = ps.filter(porCobrar);
  if (t === 'pago') {
    if (!porCob.length || !f.cuenta || f.cuenta === 'sin') return toast('Elegí la cuenta');
    const gs = registrarPagos(porCob, f, f.conEnvio);
    const tot = gs.reduce((s2, g) => s2 + (+g.monto || 0), 0);
    D.res = { cls: 'ok', html: `💸 ${esc(c.nombre)} pagó ${fmt(tot)}<div style="font-size:15px;margin-top:4px">${numsTxt(porCob)} · ${esc(f.cuenta)}${f.conEnvio ? ' · con envío' : ''}</div>`, cid: c.id, pagos: gs.map(g => g.id) };
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
    k.pagos = gs.map(g => g.id); k.transferido = gs.reduce((s2, g) => s2 + (+g.monto || 0), 0); k.cuenta = f.cuenta;
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
/** Etiqueta 10×15 de agencia: remitente arriba, destinatario grande al centro, agencia abajo. Sin QR, sin número ni artículos. */
function etqAgenciaHTML(d) {
  const lugar = [d.ciudad, d.depto].filter(Boolean).join(', ');
  return `<div class="lbl ag2">
    <div class="ag2-rem"><div class="ag2-emma">EMMA INDUMENTARIA</div><div class="ag2-rem-d">RUT 219683210010 · Tel 097 088 511</div></div>
    <div class="ag2-dest"><small>DESTINATARIO</small>
      <div class="ag2-nom">${esc(d.nombre || d.nombreEnvio || '')}</div>
      <div>C.I. <b>${esc(d.ci || '________')}</b></div>
      <div>Tel <b>${esc(d.tel || '________')}</b></div>
      ${d.direccion ? `<div>${esc(d.direccion)}</div>` : ''}
      <div><b>${esc(lugar || '________')}</b></div>
    </div>
    <div class="ag2-box">AGENCIA: ${esc((d.agencia || '________').toUpperCase())}</div>
  </div>`;
}
// Etiqueta de pedido con agencia (desde Pedidos): el mismo diseño nuevo
const _etqHTMLbase = etqHTML;
etqHTML = function (p) {
  const c = cliById(p.clienteId);
  return c && c.agencia ? etqAgenciaHTML(Object.assign({}, c, { nombre: c.nombreEnvio || c.nombre })) : _etqHTMLbase(p);
};
function imprimirPaquete(id) {
  const k = paqById(id); if (!k) return;
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
    const orden = q.replace(/^emma/i, '').trim().toUpperCase();
    const k = (DB.paquetes || []).find(x => x.grisalOrden && x.grisalOrden.toUpperCase() === orden);
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
    const f = UI.desp.f; f.cuenta = f.cuenta === cta ? null : cta; render();
  },
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
  despFiltro: d => { UI.desp.filtro = UI.desp.filtro === d.t ? 'todos' : d.t; render(); },
  despGo: () => despGo(),
  despPrint: d => imprimirPaquete(d.k),
  despDeshacer: d => deshacerPaquete(d.k),
  despResX: () => { UI.desp.res = null; render(); focoBuscar(); },
  despGrisal: () => copiarGrisalHoy(),
  despHoja: () => hojaCadeteHoy()
});
Object.assign(INP, {
  despQ: el => { UI.desp.q = el.value; despSug(); },
  despF: el => {
    UI.desp.f[el.dataset.f] = el.value;
    if (el.dataset.f === 'transf') UI.desp.f.transfEdit = true;
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
