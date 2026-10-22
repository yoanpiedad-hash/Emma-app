'use strict';
/* ══════════════════════════════════════════════════════════════
   EMMA · PAGOS (pensada para el celular)
   Marcar: buscás (nombre, teléfono o #pedido) → tocás el pedido → tocás la cuenta. Tres toques.
   Control del día: pagos por cuenta con su total, para comparar con cada banco.
   Usa marcarPago / anularPago de despacho.js (tabla pagos).
   ══════════════════════════════════════════════════════════════ */

(() => {
  const st = document.createElement('style');
  st.textContent = `
.pg-q{font-size:20px;padding:15px 14px}
.pg-r{display:flex;align-items:center;gap:10px;padding:13px 12px;border:1px solid var(--bd);border-radius:12px;background:var(--s1);margin-bottom:8px;cursor:pointer;user-select:none}
.pg-r:active,.pg-r:hover{border-color:var(--mu)}
.pg-r .nm{font-weight:700;font-size:16px;line-height:1.2}
.pg-r .tt{font-family:var(--mono);font-weight:700;font-size:17px;white-space:nowrap}
.pg-ctas{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.pg-ctas .b{padding:18px 6px;font-size:16px;border-radius:12px}
.pg-sel{border:2px solid var(--ac)}
.pg-p{display:flex;align-items:center;gap:10px;padding:10px 4px;border-bottom:1px solid var(--bd);cursor:pointer;user-select:none}
.pg-p:last-child{border-bottom:none}
.pg-p.on .dsp-chk{background:var(--ac);border-color:var(--ac)}
.pg-cta{display:flex;align-items:center;gap:10px;padding:12px;border:1px solid var(--bd);border-radius:12px;background:var(--s1);margin-bottom:8px;cursor:pointer}
.pg-cta .tt{font-family:var(--mono);font-weight:800;font-size:18px;margin-left:auto}
.pg-l{display:flex;gap:8px;align-items:center;padding:7px 2px;border-bottom:1px solid var(--bd);font-size:13px;flex-wrap:wrap}
@media (max-width:520px){.pg-ctas{grid-template-columns:repeat(2,1fr)}}
`;
  document.head.appendChild(st);
})();

UI.pag = { modo: 'marcar', q: '', elegido: null, sel: new Set(), ult: null, dia: hoyISO(), abierta: null };

/** Lo que falta cobrar: pedidos abiertos sin pago, y los que salieron "sin pago confirmado". */
function sinPagarTodos() {
  const salieronSinPago = new Set((DB.paquetes || []).flatMap(k => k.sinPago || []));
  return todosPedidos().filter(p => !pagado(p) && (sinSalir(p) || (p.estado === 'enviado' && salieronSinPago.has(p.id))));
}
function buscarSinPagar(q) {
  const ps = sinPagarTodos();
  const t = q.trim(), dig = t.replace(/\D/g, '');
  if (!t) return [];
  const out = new Set();
  if (/^#?\d{1,4}$/.test(t)) ps.filter(p => String(p.num) === dig).forEach(p => out.add(p));
  if (/^\d{5}$/.test(t)) ps.filter(p => p.codigo === t).forEach(p => out.add(p));
  if (!/^#/.test(t)) {
    const qn = norm(t), tk = dig.length >= 3 ? (telKey(dig) || dig) : '';
    const cs = new Set(DB.clientes.filter(c => (qn && !/^\d+$/.test(t) && (norm(c.nombre).includes(qn) || (c.alias || []).some(a => norm(a).includes(qn)))) || (tk && (c.telKey || '').includes(tk))).map(c => c.id));
    ps.filter(p => cs.has(p.clienteId)).forEach(p => out.add(p));
  }
  return [...out].sort((a, b) => (b.fechas.creado || '').localeCompare(a.fechas.creado || '') || a.num - b.num).slice(0, 40);
}
/** Sin buscar: los sin pagar del live más nuevo que tenga alguno. */
function sinPagarUltimoLive() {
  const ps = sinPagarTodos().filter(p => !p.cambio);
  if (!ps.length) return { live: null, ps: [], otros: 0 };
  const lives = [...new Set(ps.map(p => p.liveId))].map(liveById).filter(Boolean).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  const l = lives[0];
  const de = ps.filter(p => p.liveId === l.id).sort((a, b) => a.num - b.num);
  return { live: l, ps: de, otros: ps.length - de.length };
}

// ─── Pantalla ─────────────────────────────────────────────────
function renderPagos() {
  const el = $('#p-pagos'); if (!el) return;
  if (!el.dataset.ok) {
    el.innerHTML = `<div class="row mb"><button class="b seg" data-act="pagModo" data-m="marcar">💸 Marcar pago</button><button class="b seg" data-act="pagModo" data-m="control">📊 Control del día</button></div>
      <div id="pg-marcar"><div class="card"><div class="row" style="flex-wrap:nowrap"><input id="pg-q" class="pg-q" data-inp="pagQ" placeholder="🔎 Nombre, teléfono o #pedido" autocomplete="off" autocapitalize="off" enterkeyhint="search" style="flex:1"><button class="b lg" data-act="camPag" title="Escanear la etiqueta con la cámara" style="padding:15px 16px">📷</button></div></div><div id="pg-ok"></div><div id="pg-body"></div></div>
      <div id="pg-control"></div>`;
    el.dataset.ok = '1';
  }
  const P = UI.pag;
  document.querySelectorAll('[data-act=pagModo]').forEach(b => b.classList.toggle('on', b.dataset.m === P.modo));
  $('#pg-marcar').hidden = P.modo !== 'marcar';
  $('#pg-control').hidden = P.modo !== 'control';
  if (P.modo === 'control') { $('#pg-control').innerHTML = controlHTML(); return; }
  $('#pg-ok').innerHTML = okHTML();
  renderPagLista();
}
function renderPagLista() {
  const P = UI.pag, body = $('#pg-body'); if (!body) return;
  if (P.elegido && pedById(P.elegido)) { body.innerHTML = eleccionHTML(); return; }
  P.elegido = null;
  const fila = p => {
    const c = cliById(p.clienteId) || { nombre: '?' }, l = liveById(p.liveId) || { nombre: '?' };
    const marca = p.estado === 'guardado' ? ' <span class="chip gu">⏸️ guardado</span>' : p.estado === 'enviado' ? ' <span class="chip li">🚚 salió sin pago</span>' : '';
    return `<div class="pg-r" data-act="pagElegir" data-id="${p.id}"><span class="num">#${p.num}</span><div style="flex:1;min-width:0"><div class="nm">${esc(c.nombre)}</div><div class="small muted">${esc(l.nombre)} · ${fechaUY(p.fechas.creado || l.fecha, 1)}${marca}</div></div><span class="tt">${fmt(p.cambio ? p.cambio.cobrar : calc(p).total)}</span></div>`;
  };
  if (P.q.trim()) {
    const r = buscarSinPagar(P.q);
    body.innerHTML = r.length ? `<div class="list-h"><span class="t">Sin pagar · ${r.length}</span></div>${r.map(fila).join('')}`
      : `<div class="empty">No hay pedidos sin pagar con "${esc(P.q.trim())}"<div class="small mt">Si ya figura pagado, lo ves en 📊 Control del día.</div></div>`;
    return;
  }
  const u = sinPagarUltimoLive();
  body.innerHTML = u.live ? `<div class="list-h"><span class="t">Sin pagar · ${esc(u.live.nombre)} <span class="bdg">${u.ps.length}</span></span></div>${u.ps.map(fila).join('')}${u.otros ? `<div class="small muted" style="text-align:center;margin:8px 0">+ ${u.otros} sin pagar de otros lives: buscalos por nombre o número</div>` : ''}`
    : '<div class="empty">No hay pedidos sin pagar 🎉</div>';
}
function eleccionHTML() {
  const P = UI.pag, p = pedById(P.elegido), c = cliById(p.clienteId) || { nombre: '?' };
  const otros = sinPagarTodos().filter(x => x.clienteId === p.clienteId);
  const ps = otros.sort((a, b) => (a.id === p.id ? -1 : b.id === p.id ? 1 : (b.fechas.creado || '').localeCompare(a.fechas.creado || '')));
  const tot = ps.filter(x => P.sel.has(x.id)).reduce((s, x) => s + (x.cambio ? x.cambio.cobrar || 0 : calc(x).total), 0);
  const filas = ps.map(x => { const l = liveById(x.liveId) || { nombre: '?' }, on = P.sel.has(x.id);
    return `<div class="pg-p${on ? ' on' : ''}" data-act="pagTog" data-id="${x.id}"><span class="dsp-chk">${on ? '✓' : ''}</span><span class="num">#${x.num}</span><div style="flex:1;min-width:0" class="small">${esc(l.nombre)} · ${fechaUY(x.fechas.creado || l.fecha, 1)}</div><b class="mono">${fmt(x.cambio ? x.cambio.cobrar : calc(x).total)}</b></div>`; }).join('');
  return `<div class="card pg-sel">
    <div class="row" style="align-items:flex-start"><div style="flex:1;min-width:0"><div class="pc-nom" style="white-space:normal">${esc(c.nombre)}</div><div class="small muted">${c.tel ? esc(c.tel) : 'sin tel'}</div></div><button class="b sm gh" data-act="pagCancelar">✕</button></div>
    ${ps.length > 1 ? '<div class="small muted mt">Tiene más pedidos sin pagar: tildá los que entran en esta transferencia.</div>' : ''}
    <div class="mt">${filas}</div>
    <div class="tot-l big"><span>Pagó</span><span>${fmt(tot)}</span></div>
    <div class="card-t mt">¿A qué cuenta entró?</div>
    <div class="pg-ctas">${cuentasPago().map(cta => `<button class="b" data-act="pagCuenta" data-c="${esc(cta)}"${P.sel.size ? '' : ' disabled'}>${esc(cta)}</button>`).join('')}<button class="b gh" data-act="pagCuenta" data-c=""${P.sel.size ? '' : ' disabled'}>Otra…</button></div>
  </div>`;
}
function okHTML() {
  const u = UI.pag.ult; if (!u) return '';
  const vivos = u.ids.filter(id => DB.pagos.some(g => g.id === id));
  if (!vivos.length) { UI.pag.ult = null; return ''; }
  return `<div class="card"><div class="big-alert ok" style="margin-top:0">✓ ${esc(u.nombre)} pagó ${fmt(u.total)}<div style="font-size:15px;margin-top:4px">${esc(u.nums)} · ${esc(u.cuenta)}</div></div>
    <div class="row mt"><span class="grow"></span><button class="b sm gh" data-act="pagDeshacerUlt">↩️ Deshacer</button><button class="b sm gh" data-act="pagOkX">✕</button></div></div>`;
}

// ── Control del día ──
function pagosDelDia(dia) { return (DB.pagos || []).filter(g => localISO(new Date(g.fecha)) === dia).sort((a, b) => a.fecha.localeCompare(b.fecha)); }
function controlHTML() {
  const P = UI.pag, gs = pagosDelDia(P.dia);
  const por = new Map();
  gs.forEach(g => { if (!por.has(g.cuenta)) por.set(g.cuenta, []); por.get(g.cuenta).push(g); });
  const total = gs.reduce((s, g) => s + (+g.monto || 0), 0);
  const hora = iso => { const d = new Date(iso); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
  const ctas = [...por.entries()].sort((a, b) => b[1].reduce((s, g) => s + +g.monto, 0) - a[1].reduce((s, g) => s + +g.monto, 0)).map(([cta, l]) => {
    const t = l.reduce((s, g) => s + (+g.monto || 0), 0), ab = P.abierta === cta;
    return `<div class="pg-cta" data-act="pagAbrirCta" data-c="${esc(cta)}"><b style="font-size:16px">${esc(cta)}</b><span class="chip">${l.length} pago${l.length > 1 ? 's' : ''}</span><span class="tt">${fmt(t)}</span><span class="muted">${ab ? '▲' : '▼'}</span></div>
      ${ab ? `<div class="box mb">${l.map(g => { const p = pedById(g.pedidoId), c = cliById(g.clienteId || (p && p.clienteId)) || { nombre: '?' };
        return `<div class="pg-l"><span class="mono muted">${hora(g.fecha)}</span><span style="flex:1;min-width:120px"><b>${esc(c.nombre)}</b> <span class="muted">#${p ? p.num : '?'}${g.origen === 'despacho' ? ' · desde Despacho' : ''}</span></span><b class="mono">${fmt(g.monto)}</b><button class="b sm gh" data-act="pagAnular" data-id="${g.id}" title="Anular este pago">↩️</button></div>`; }).join('')}</div>` : ''}`;
  }).join('');
  return `<div class="card"><div class="row"><label class="small muted">Día</label><input type="date" id="pg-dia" data-chg="pagDia" value="${P.dia}" style="width:auto;flex:1"><button class="b sm" data-act="pagHoy">Hoy</button></div></div>
    ${gs.length ? `<div class="card"><div class="row"><span class="card-t" style="margin:0">Total del día · ${gs.length} pagos</span><span class="grow"></span><span class="mono" style="font-size:22px;font-weight:800">${fmt(total)}</span></div></div>
      ${ctas}
      <div class="row mt"><button class="b" data-act="pagCopiar">📋 Copiar resumen</button></div>
      <div class="small muted mt">Comparalo con lo que entró en cada cuenta. Solo cuentan los pagos marcados con cuenta (en Pagos o en Despacho).</div>`
    : '<div class="empty">No hay pagos marcados ese día</div>'}`;
}

// ─── Acciones ─────────────────────────────────────────────────
function pagFoco() { setTimeout(() => { const q = $('#pg-q'); if (q && UI.tab === 'pagos' && UI.pag.modo === 'marcar' && window.matchMedia && matchMedia('(pointer:fine)').matches) q.focus(); }, 30); }
Object.assign(ACT, {
  pagModo: d => { UI.pag.modo = d.m; render(); if (d.m === 'marcar') pagFoco(); },
  pagElegir: d => { const P = UI.pag; P.elegido = d.id; P.sel = new Set([d.id]); render(); window.scrollTo(0, 0); },
  pagTog: d => { const P = UI.pag; P.sel.has(d.id) ? P.sel.delete(d.id) : P.sel.add(d.id); render(); },
  pagCancelar: () => { UI.pag.elegido = null; UI.pag.sel = new Set(); render(); pagFoco(); },
  pagCuenta: d => {
    const P = UI.pag;
    let cta = d.c;
    if (!cta) { cta = (prompt('¿En qué cuenta entró la transferencia?') || '').trim(); if (!cta) return; }
    const ps = [...P.sel].map(pedById).filter(p => p && !pagado(p));
    if (!ps.length) return;
    const c = cliById(ps[0].clienteId) || { nombre: '?' };
    const gs = ps.map(p => marcarPago(p, cta, 'pagos'));
    savePagos(); guardar();
    P.ult = { ids: gs.map(g => g.id), nombre: c.nombre, cuenta: cta, total: gs.reduce((s, g) => s + (+g.monto || 0), 0), nums: ps.map(p => '#' + p.num).join(' · ') };
    P.elegido = null; P.sel = new Set(); P.q = '';
    const q = $('#pg-q'); if (q) q.value = '';
    render(); window.scrollTo(0, 0); pagFoco();
  },
  pagDeshacerUlt: () => {
    const u = UI.pag.ult; if (!u) return;
    if (!confirm(`¿Deshacer el pago de ${u.nombre} (${fmt(u.total)} · ${u.cuenta})?`)) return;
    u.ids.forEach(anularPago); savePagos(); guardar();
    UI.pag.ult = null; toast('↩️ Pago deshecho'); render();
  },
  pagOkX: () => { UI.pag.ult = null; render(); pagFoco(); },
  pagAbrirCta: d => { UI.pag.abierta = UI.pag.abierta === d.c ? null : d.c; render(); },
  pagAnular: (d, el, e) => {
    if (e) e.stopPropagation();
    const g = DB.pagos.find(x => x.id === d.id); if (!g) return;
    const p = pedById(g.pedidoId), c = cliById(g.clienteId) || { nombre: '?' };
    if (!confirm(`¿Anular el pago de ${c.nombre}${p ? ' #' + p.num : ''} (${fmt(g.monto)} · ${g.cuenta})?\n\nEl pedido vuelve a "sin pagar".`)) return;
    anularPago(d.id); savePagos(); guardar(); toast('↩️ Pago anulado'); render();
  },
  pagHoy: () => { UI.pag.dia = hoyISO(); render(); },
  pagCopiar: async () => {
    const P = UI.pag, gs = pagosDelDia(P.dia), por = new Map();
    gs.forEach(g => por.set(g.cuenta, (por.get(g.cuenta) || 0) + (+g.monto || 0)));
    const txt = `Pagos ${fechaUY(P.dia)}\n` + [...por.entries()].map(([c, t]) => `${c}: ${fmt(t)}`).join('\n') + `\nTotal: ${fmt(gs.reduce((s, g) => s + (+g.monto || 0), 0))} (${gs.length} pagos)`;
    toast(await copiarTexto(txt) ? '📋 Resumen copiado' : 'No se pudo copiar');
  }
});
Object.assign(CHG, { pagDia: (d, el) => { UI.pag.dia = el.value || hoyISO(); UI.pag.abierta = null; render(); } });
Object.assign(INP, { pagQ: el => { UI.pag.q = el.value; UI.pag.elegido = null; renderPagLista(); } });
document.addEventListener('keydown', e => {
  if (UI.tab !== 'pagos' || e.target.id !== 'pg-q' || e.key !== 'Enter') return;
  e.preventDefault();
  const r = UI.pag.q.trim() ? buscarSinPagar(UI.pag.q) : [];
  if (r.length === 1) ACT.pagElegir({ id: r[0].id });
}, true);
const _actTabPag = ACT.tab;
ACT.tab = d => { _actTabPag(d); if (d.t === 'pagos') pagFoco(); };
