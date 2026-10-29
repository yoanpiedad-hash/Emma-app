'use strict';
/* ══════════════════════════════════════════════════════════════
   EMMA PEDIDOS · DATOS PARA MABEL (agente de WhatsApp)
   Doc "Agente de WhatsApp Emma: instrucciones". Lo que ya existía se reutiliza:
   - cobra_cadete / envio_pago  = p.cobroEnvio ('pago' transferido · 'cobrar' al cadete · 'monto' parcial) + p.cobroMonto
   - monto_transferido = pago.monto · incluye_envio = pago.envio · diferencia = pago.ajuste (+ pago.recargo de Mercado Pago)
   Lo nuevo:
   - Pago: medio, esperado, recargo, nota (despacho.js) · Clienta: notaMabel, puedeGuardarSinPagar
   - Pedido: guardadoSinPagar { desde, hasta } y pagaAlRetirar · estadoPago(p) y recibeRecordatorio(p)
   - Tabla cobros (cobro agrupado) y tabla conversaciones ("↩️ Devolver a Mabel")
   - Config: novedadesHoy { texto, vence }, diaOtrasAgencias, mpRecargo, guardarSinPagarDias
   Se carga después de pedidos4.js.
   ══════════════════════════════════════════════════════════════ */
(() => {
  const st = document.createElement('style');
  st.textContent = `
#avisos-mabel:empty{display:none}
#avisos-mabel{margin:-4px 0 10px}
.mb-av{border-radius:12px;padding:10px 12px;font-size:13.5px;font-weight:700;display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px;background:#2a1f05;border:1px solid var(--pe);color:#ffd27a}
.mb-av.az{background:#0c2238;border-color:#74b9ff;color:#bfe0ff}
.mb-av .grow{flex:1;min-width:180px}
.mb-k{border:1px solid var(--bd);border-radius:12px;padding:10px 12px;margin-bottom:8px;background:var(--s1)}
.mb-k.rojo{border-color:var(--li)}
.mb-nota{font-size:12.5px;background:var(--s2);border-radius:8px;padding:6px 8px;margin-top:6px;white-space:pre-wrap}
`;
  document.head.appendChild(st);
})();
if (!DB.cobros) DB.cobros = [];
if (!DB.conversaciones) DB.conversaciones = [];
if (typeof CLAVES_NUBE !== 'undefined') { CLAVES_NUBE.emma_cobros = () => DB.cobros; CLAVES_NUBE.emma_conversaciones = () => DB.conversaciones; }
const saveCobros = () => put('emma_cobros', DB.cobros);
const saveConvs = () => put('emma_conversaciones', DB.conversaciones);
const cfgN = (k, def) => { const v = DB.config[k]; return v === undefined || v === null || v === '' ? def : v; };
const DIAS_SEM = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

// ─── Estado de pago (para Mabel, el recordatorio y la app) ────
const pagoAlRetirar = p => !!p.pagaAlRetirar && entregaEf(p) === 'retiro';
/** 'pagado' · 'guardado_sin_pagar' · 'al_retirar' · 'pendiente' */
function estadoPago(p) {
  if (pagado(p)) return 'pagado';
  if (p.estado === 'guardado' && p.guardadoSinPagar) return 'guardado_sin_pagar';
  if (pagoAlRetirar(p)) return 'al_retirar';
  return 'pendiente';
}
/** El recordatorio de pago solo va a pedidos abiertos que esperan pago (saltea guardados sin pagar y retiros con pago al retirar). */
const recibeRecordatorio = p => !p.cambio && ['pendiente', 'listo'].includes(p.estado) && estadoPago(p) === 'pendiente';
/** envio_pago del doc, a partir de lo que ya guarda la app. */
const envioPagoDe = p => p.cobroEnvio === 'pago' ? 'transferido' : p.cobroEnvio === 'monto' ? 'parcial' : 'al_cadete';
/** Novedades de hoy, solo si no vencieron. */
function novedadesVigentes() { const n = cfgN('novedadesHoy', null); return n && n.texto && (!n.vence || n.vence >= hoyISO()) ? n : null; }

// ─── Guardado sin pagar ───────────────────────────────────────
const plazoGsp = () => Math.max(1, +cfgN('guardarSinPagarDias', 30) || 30);
const _setEstado = setEstado;
setEstado = function (p, nuevo, fechaISO) {
  _setEstado(p, nuevo, fechaISO);
  if (nuevo === 'guardado') {
    const c = cliById(p.clienteId);
    if (c && c.puedeGuardarSinPagar && !pagado(p) && !p.guardadoSinPagar) p.guardadoSinPagar = { desde: hoyISO(), hasta: sumarDias(hoyISO(), plazoGsp()) };
  } else if (p.guardadoSinPagar) delete p.guardadoSinPagar;
};
const gspDe = () => todosPedidos().filter(p => p.estado === 'guardado' && p.guardadoSinPagar && !pagado(p));
const gspVencidos = () => gspDe().filter(p => p.guardadoSinPagar.hasta <= hoyISO());
function extenderGsp(cid, dias, fecha) {
  const ps = gspDe().filter(p => p.clienteId === cid);
  ps.forEach(p => { p.guardadoSinPagar.hasta = fecha || sumarDias(p.guardadoSinPagar.hasta > hoyISO() ? p.guardadoSinPagar.hasta : hoyISO(), dias); });
  saveLives();
}

// ─── Cobro agrupado ───────────────────────────────────────────
const cobrosAbiertos = cid => DB.cobros.filter(k => k.estado === 'abierto' && (!cid || k.clienteId === cid));
const sinPagarDe = cid => todosPedidos().filter(p => p.clienteId === cid && sinSalir(p) && !pagado(p) && !p.cambio);
function totalCobro(k) { const ps = k.pedidos.map(pedById).filter(Boolean); return { ps, base: ps.reduce((s, p) => s + calc(p).total, 0) }; }
function crearCobro(cid, ids, envio) {
  const k = { id: uid('cb'), clienteId: cid, pedidos: ids, envio: envio ? (+cfg('tarifaEnvio') || 0) : 0, estado: 'abierto', creado: ahoraISO() };
  k.total = totalCobro(k).base + k.envio;
  DB.cobros.push(k); saveCobros();
  return k;
}
/** Marca pagados todos los pedidos del cobro con un solo pago (lo usa la app y lo va a usar Mabel). */
function pagarCobro(k, cuenta, transf, origen) {
  const { ps } = totalCobro(k), pend = ps.filter(p => !pagado(p));
  if (!pend.length) { k.estado = 'pagado'; saveCobros(); return []; }
  const f = { cuenta, cobroId: k.id, origen: origen || 'cobro' };
  if (transf !== undefined && transf !== null && transf !== '') { f.transf = transf; f.transfEdit = true; }
  const gs = registrarPagos(pend, f, k.envio > 0, null);
  k.estado = 'pagado'; k.pagos = gs.map(g => g.id); k.pagado = ahoraISO(); saveCobros();
  return gs;
}
function textoCobro(k) {
  const c = cliById(k.clienteId) || { nombre: '' }, { ps, base } = totalCobro(k);
  return `¡Hola ${c.nombre}! ¿Cómo estás? 😊\nTe paso el total de tus pedidos guardados:\n\n${ps.map(p => `- Pedido #${p.num}: ${fmt(calc(p).total)}`).join('\n')}${k.envio ? `\n- Envío por cadetería: ${fmt(k.envio)}` : ''}\n\n*Total: ${fmt(base + k.envio)}* ✅` + (cfg('msgPago') ? '\n\n' + cfg('msgPago') : '') + '\n\n¡Gracias por elegir Emma Indumentaria! 💕';
}
function modalCobro(cid) {
  const c = cliById(cid), ps = sinPagarDe(cid); if (!c) return;
  if (!ps.length) return toast('No tiene pedidos sin pagar');
  UI.cobroSel = new Set(ps.map(p => p.id)); UI.cobroEnv = false; UI.cobroCid = cid;
  pintarModalCobro();
}
function pintarModalCobro() {
  const cid = UI.cobroCid, c = cliById(cid), ps = sinPagarDe(cid);
  const sel = ps.filter(p => UI.cobroSel.has(p.id)), base = sel.reduce((s, p) => s + calc(p).total, 0), env = UI.cobroEnv ? (+cfg('tarifaEnvio') || 0) : 0;
  showModal(`<h3>🧾 Cobro agrupado · ${esc(c.nombre)}</h3><p class="small muted mb">Un solo total y un solo envío. Con un comprobante se marcan pagados todos juntos (Mabel también lo valida contra este total).</p>
    ${ps.map(p => `<label class="row" style="padding:6px 0;border-bottom:1px solid var(--bd)"><input type="checkbox" data-chg="cobroTog" data-id="${p.id}"${UI.cobroSel.has(p.id) ? ' checked' : ''}> <span class="grow" style="flex:1">#${p.num} · ${esc((liveById(p.liveId) || {}).nombre || '')}${p.guardadoSinPagar ? ' · 💤 guardado' : ''}</span><b class="mono">${fmt(calc(p).total)}</b></label>`).join('')}
    <label class="row mt"><input type="checkbox" data-chg="cobroEnv"${UI.cobroEnv ? ' checked' : ''}> Sumar el envío por cadetería (${fmt(+cfg('tarifaEnvio') || 0)})</label>
    <div class="tot-l big mt"><span>Total</span><span>${fmt(base + env)}</span></div>
    <div class="row mt"><button class="b ok" data-act="cobroCrear"${sel.length ? '' : ' disabled'}>✓ Armar cobro</button><button class="b gh" data-act="closeModal">Cancelar</button></div>`);
}

// ─── Conversaciones con Mabel ─────────────────────────────────
const convActivas = () => DB.conversaciones.filter(v => v.estado === 'yanaina' && (!v.hasta || v.hasta > ahoraISO()));
function devolverAMabel(id) {
  const v = DB.conversaciones.find(x => x.id === id); if (!v) return;
  v.estado = 'agente'; v.devuelta = ahoraISO(); delete v.hasta; saveConvs();
}

// ─── Pantallas ────────────────────────────────────────────────
function avisosMabelHTML() {
  let h = '';
  const venc = gspVencidos(), porCli = new Map();
  venc.forEach(p => { if (!porCli.has(p.clienteId)) porCli.set(p.clienteId, []); porCli.get(p.clienteId).push(p); });
  for (const [cid, ps] of porCli) { const c = cliById(cid) || { nombre: '?' }; h += `<div class="mb-av"><span class="grow">⏰ ${ps[0].guardadoSinPagar.hasta < hoyISO() ? 'Venció' : 'Vence hoy'} el guardado sin pagar de <b>${esc(c.nombre)}</b> (${ps.map(p => '#' + p.num).join(' · ')}): contactala vos</span><button class="b sm" data-act="tab" data-t="guardados">Ver</button></div>`; }
  const cv = convActivas();
  if (cv.length) h += `<div class="mb-av az"><span class="grow">🤖 ${cv.length} conversación${cv.length > 1 ? 'es' : ''} de Mabel para Yanaina</span><button class="b sm" data-act="tab" data-t="clientes">Ver</button></div>`;
  return h;
}
function pintarAvisosMabel() {
  let el = document.getElementById('avisos-mabel');
  if (!el) { const a = document.getElementById('avisos'); if (!a) return; el = document.createElement('div'); el.id = 'avisos-mabel'; a.after(el); }
  const h = avisosMabelHTML(); if (el.innerHTML !== h) el.innerHTML = h;
}
function convsHTML() {
  const cv = convActivas(); if (!cv.length) return '';
  return `<div class="card mb"><div class="card-t">🤖 Para Yanaina (${cv.length})</div>${cv.map(v => { const c = v.clienteId && cliById(v.clienteId);
    return `<div class="mb-k"><div class="row"><b class="grow" style="flex:1">${esc(c ? c.nombre : v.tel || v.id)}</b><span class="small muted">${fechaHoraCorta(v.desde)}</span></div>
      <div class="small mt">${esc(v.motivo || 'Sin motivo')}</div>
      <div class="row mt"><button class="b sm" data-act="convWA" data-id="${esc(v.id)}">💬 Abrir chat</button><button class="b sm ok" data-act="convDevolver" data-id="${esc(v.id)}">↩️ Devolver a Mabel</button><span class="small muted">vuelve sola a las 12 h</span></div></div>`; }).join('')}</div>`;
}
const fechaHoraCorta = iso => { const d = new Date(iso); return isNaN(d) ? '' : fechaUY(localISO(d), 1) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
function gspHTML() {
  const ps = gspDe(), cobros = cobrosAbiertos();
  const porCli = new Map(); ps.forEach(p => { if (!porCli.has(p.clienteId)) porCli.set(p.clienteId, []); porCli.get(p.clienteId).push(p); });
  let h = '';
  if (cobros.length) h += `<div class="card mb"><div class="card-t">🧾 Cobros agrupados abiertos (${cobros.length})</div>${cobros.map(k => { const c = cliById(k.clienteId) || { nombre: '?' }, { ps: kp, base } = totalCobro(k);
    return `<div class="mb-k"><div class="row"><b class="grow" style="flex:1">${esc(c.nombre)}</b><b class="mono">${fmt(base + k.envio)}</b></div>
      <div class="small muted">${kp.map(p => '#' + p.num).join(' · ')}${k.envio ? ' · con envío ' + fmt(k.envio) : ''} · armado el ${fechaUY(k.creado, 1)}</div>
      <div class="row mt"><button class="b sm" data-act="cobroWA" data-id="${k.id}">💬 Mandar total</button><button class="b sm ok" data-act="cobroPagar" data-id="${k.id}">💸 Pagó</button><button class="b sm gh" data-act="cobroAnular" data-id="${k.id}">Anular</button></div></div>`; }).join('')}</div>`;
  if (porCli.size) h += `<div class="card mb"><div class="card-t">💤 Guardados sin pagar (clientas autorizadas)</div><p class="small muted mb">No se les manda recordatorio ni avisos: el día límite te avisa a vos.</p>${[...porCli].map(([cid, gp]) => {
    const c = cliById(cid) || { nombre: '?' }, hasta = gp.map(p => p.guardadoSinPagar.hasta).sort()[0], venc = hasta <= hoyISO(), tot = gp.reduce((s, p) => s + calc(p).total, 0);
    return `<div class="mb-k${venc ? ' rojo' : ''}"><div class="row"><b class="grow" style="flex:1">${esc(c.nombre)}</b><b class="mono">${fmt(tot)}</b></div>
      <div class="small">${gp.map(p => '#' + p.num).join(' · ')} · <span class="${venc ? 'c-li' : 'muted'}">hasta el ${fechaUY(hasta)}${venc ? ' (¡hoy o vencido!)' : ''}</span></div>
      <div class="row mt"><button class="b sm" data-act="gspMas" data-cid="${cid}" data-d="7">+7 días</button><button class="b sm" data-act="gspFecha" data-cid="${cid}">📅 Cambiar fecha</button>${cobrosAbiertos(cid).length ? '' : `<button class="b sm" data-act="cobroArmar" data-cid="${cid}">🧾 Armar cobro</button>`}</div></div>`; }).join('')}</div>`;
  return h;
}
const _renderGuardados = renderGuardados;
renderGuardados = function () {
  _renderGuardados();
  // Los guardados sin pagar de clientas autorizadas no siguen el plazo de 30 días con avisos a la clienta
  const ids = new Set(gspDe().map(p => p.id));
  document.querySelectorAll('#lista-guardados [data-act=irPedido]').forEach(b => { if (ids.has(b.dataset.id)) { const r = b.closest('.gd'); if (r) r.remove(); } });
  const l = $('#lista-guardados');
  if (l && !l.querySelector('.gd') && ids.size) l.innerHTML = '';
  l.insertAdjacentHTML('afterbegin', gspHTML());
};
const _renderClientes2 = renderClientes;
renderClientes = function () { _renderClientes2(); const el = $('#cl-deshacer'); if (el) el.insertAdjacentHTML('afterbegin', convsHTML()); };
const _itemClienta2 = itemClienta;
itemClienta = function (c, h) {
  let html = _itemClienta2(c, h);
  const extra = (c.puedeGuardarSinPagar ? '<span class="chip gu">💤 guarda sin pagar</span> ' : '') + (c.notaMabel ? `<div class="mb-nota">🤖 ${esc(c.notaMabel)}</div>` : '');
  if (extra) html = html.replace('<div class="row mt">', `<div class="mt">${extra}</div><div class="row mt">`);
  const nSin = sinPagarDe(c.id).length;
  html = html.replace('<button class="b sm" data-act="clEdit"', `<button class="b sm" data-act="mbNota" data-cid="${c.id}" title="Nota para Mabel">🤖 Nota</button><button class="b sm${c.puedeGuardarSinPagar ? ' seg on' : ''}" data-act="mbGsp" data-cid="${c.id}" title="Puede guardar pedidos sin pagar">💤 ${c.puedeGuardarSinPagar ? 'Guarda sin pagar ✓' : 'Guardar sin pagar'}</button>${nSin >= 1 ? `<button class="b sm" data-act="cobroArmar" data-cid="${c.id}">🧾 Cobro (${nSin})</button>` : ''}<button class="b sm" data-act="clEdit"`);
  return html;
};
// Config: Mabel
function montarCfgMabel() {
  const cf = document.getElementById('p-config'); if (!cf || document.getElementById('cf-mabel')) return;
  const d = document.createElement('div'); d.className = 'card'; d.id = 'cf-mabel';
  d.innerHTML = `<div class="card-t">🤖 Mabel (agente de WhatsApp)</div>
    <label class="lb">📣 Novedades de hoy (horario de retiro, avisos). Mabel solo usa esto para horarios.</label>
    <textarea id="mb-nov" rows="3" data-chg="mbNov" placeholder="ej: Hoy retiro de 16 a 20 hs"></textarea>
    <div class="row mt"><label class="small muted">Vale hasta</label><input id="mb-vence" type="date" data-chg="mbNov" style="width:auto"><span class="small" id="mb-nov-est"></span></div>
    <div class="grid2 mt">
      <div><label class="lb">Día de otras agencias (no DAC, Núñez ni Correo)</label><select id="mb-dia" data-chg="mbCfg" data-k="diaOtrasAgencias">${DIAS_SEM.slice(1).map(x => `<option>${x}</option>`).join('')}</select></div>
      <div><label class="lb">Recargo Mercado Pago (%)</label><input id="mb-mp" type="number" inputmode="numeric" data-chg="mbCfg" data-k="mpRecargo"></div>
      <div><label class="lb">Plazo de guardado sin pagar (días)</label><input id="mb-gsp" type="number" inputmode="numeric" data-chg="mbCfg" data-k="guardarSinPagarDias"></div>
    </div>`;
  const v = document.getElementById('cf-version'); if (v) cf.insertBefore(d, v); else cf.appendChild(d);
}
function pintarCfgMabel() {
  montarCfgMabel();
  const n = cfgN('novedadesHoy', null) || {}, a = document.activeElement;
  if (a !== $('#mb-nov')) $('#mb-nov').value = n.texto || '';
  if (a !== $('#mb-vence')) $('#mb-vence').value = n.vence || hoyISO();
  $('#mb-nov-est').innerHTML = n.texto ? (novedadesVigentes() ? '<span class="c-ok">✓ vigente</span>' : '<span class="c-li">vencida: Mabel no la usa</span>') : '';
  $('#mb-dia').value = cfgN('diaOtrasAgencias', 'viernes');
  if (a !== $('#mb-mp')) $('#mb-mp').value = cfgN('mpRecargo', 10);
  if (a !== $('#mb-gsp')) $('#mb-gsp').value = cfgN('guardarSinPagarDias', 30);
}
const _renderConfig = renderConfig;
renderConfig = function () { _renderConfig(); pintarCfgMabel(); };
const _render = render;
render = function () { _render(); pintarAvisosMabel(); };
const _renderBadges = renderBadges;
renderBadges = function () { _renderBadges(); const v = gspVencidos().length, b = $('#bdg-guard'); if (v && b) b.insertAdjacentHTML('beforeend', ` <span class="bdg red">⏰${v}</span>`); };

Object.assign(ACT, {
  mbNota: d => { const c = cliById(d.cid); if (!c) return; const v = prompt(`Nota para Mabel sobre ${c.nombre} (máx. 3 líneas, solo hechos):`, c.notaMabel || ''); if (v === null) return; c.notaMabel = v.trim().slice(0, 300); if (!c.notaMabel) delete c.notaMabel; saveClientes(); render(); },
  mbGsp: d => {
    const c = cliById(d.cid); if (!c) return;
    c.puedeGuardarSinPagar = !c.puedeGuardarSinPagar;
    if (c.puedeGuardarSinPagar) todosPedidos().filter(p => p.clienteId === c.id && p.estado === 'guardado' && !pagado(p) && !p.guardadoSinPagar).forEach(p => { p.guardadoSinPagar = { desde: hoyISO(), hasta: sumarDias(hoyISO(), plazoGsp()) }; });
    else todosPedidos().filter(p => p.clienteId === c.id && p.guardadoSinPagar).forEach(p => { delete p.guardadoSinPagar; });
    saveClientes(); saveLives(); toast(c.puedeGuardarSinPagar ? `💤 ${c.nombre} puede guardar sin pagar` : `${c.nombre} ya no guarda sin pagar`); render();
  },
  gspMas: d => { extenderGsp(d.cid, +d.d || 7); toast('✓ Plazo extendido'); render(); },
  gspFecha: d => { const v = prompt('¿Hasta qué fecha? (dd/mm/aaaa)'); if (!v) return; const f = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : (() => { const m = v.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/); if (!m) return ''; const y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : new Date().getFullYear(); return y + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0'); })(); if (!f) return toast('Fecha no válida'); extenderGsp(d.cid, 0, f); toast('✓ Hasta el ' + fechaUY(f)); render(); },
  cobroArmar: d => modalCobro(d.cid),
  cobroCrear: () => { const ids = sinPagarDe(UI.cobroCid).filter(p => UI.cobroSel.has(p.id)).map(p => p.id); if (!ids.length) return; const k = crearCobro(UI.cobroCid, ids, UI.cobroEnv); closeModal(); toast(`🧾 Cobro armado: ${fmt(k.total)}`); render(); },
  cobroWA: d => { const k = DB.cobros.find(x => x.id === d.id), c = k && cliById(k.clienteId); if (!c) return; if (!c.tel && !pedirTel(c)) return; abrirWA(c.tel, textoCobro(k)); },
  cobroPagar: d => {
    const k = DB.cobros.find(x => x.id === d.id); if (!k) return;
    const { base } = totalCobro(k), ctas = (typeof cuentasPago === 'function' ? cuentasPago() : ['BROU']);
    showModal(`<h3>💸 ¿Cómo pagó?</h3><p class="small muted mb">Se marcan pagados todos los pedidos del cobro (${fmt(base + k.envio)}${k.envio ? ', con envío' : ''}).</p><div class="row">${ctas.map(c => `<button class="b" data-act="cobroCuenta" data-id="${k.id}" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div><div class="row mt"><button class="b gh" data-act="closeModal">Cancelar</button></div>`);
  },
  cobroCuenta: d => { const k = DB.cobros.find(x => x.id === d.id); if (!k) return; const gs = pagarCobro(k, d.c); closeModal(); toast(`✓ Pagado por ${d.c}: ${gs.length} pedido(s)`); render(); },
  cobroAnular: d => { const k = DB.cobros.find(x => x.id === d.id); if (!k || !confirm('¿Anular este cobro agrupado? Los pedidos quedan como estaban.')) return; k.estado = 'anulado'; saveCobros(); render(); },
  convWA: d => { const v = DB.conversaciones.find(x => x.id === d.id); if (v) abrirWA(v.tel || (cliById(v.clienteId) || {}).tel, ''); },
  convDevolver: d => { devolverAMabel(d.id); toast('↩️ Mabel vuelve a atender esa conversación'); render(); }
});
Object.assign(CHG, {
  cobroTog: (d, el) => { el.checked ? UI.cobroSel.add(d.id) : UI.cobroSel.delete(d.id); pintarModalCobro(); },
  cobroEnv: (d, el) => { UI.cobroEnv = el.checked; pintarModalCobro(); },
  mbNov: () => { const t = $('#mb-nov').value.trim(); saveConfig({ novedadesHoy: t ? { texto: t, vence: $('#mb-vence').value || hoyISO() } : null }); toast('✓ Novedades guardadas'); pintarCfgMabel(); },
  mbCfg: (d, el) => { const v = d.k === 'diaOtrasAgencias' ? el.value : Math.max(0, num(el.value)); saveConfig({ [d.k]: v }); toast('✓ Guardado'); pintarCfgMabel(); }
});
// ─── Plazos: "Más plazo" y "Para liberar" (28/10) ─────────────
// Más plazo = pasar el pedido a Guardado sin pagar con fecha límite (sirve también para clientas NO autorizadas: excepción puntual).
// Para liberar = pedidos sin pagar con el plazo vencido. La app solo los marca: liberar es siempre con un toque de Yoan o Yanaina.
const HORA_LIBERAR = 16;
const plazoPagoDias = () => Math.max(1, +cfgN('plazoPagoDias', 2) || 2);   // el pago es el día siguiente al live; se libera a las 16:00 del día después
const limiteDe = p => p.estado === 'guardado' ? (p.guardadoSinPagar && p.guardadoSinPagar.hasta) : sumarDias(p.fechas.creado || hoyISO(), plazoPagoDias());
const limiteVencido = f => !!f && (f < hoyISO() || (f === hoyISO() && new Date().getHours() >= HORA_LIBERAR));
function paraLiberar() {
  return todosPedidos().filter(p => !p.cambio && !pagado(p) && !pagoAlRetirar(p)
    && (p.estado === 'pendiente' || (p.estado === 'guardado' && p.guardadoSinPagar)) && limiteVencido(limiteDe(p)));
}
function liberadosRecientes() {
  const desde = sumarDias(hoyISO(), -7);
  return todosPedidos().filter(p => !p.cambio && p.estado === 'liberado' && (p.fechas.liberado || '') >= desde)
    .sort((a, b) => (b.fechas.liberado || '').localeCompare(a.fechas.liberado || '') || b.num - a.num);
}
function aplicarPlazo(ids, hasta) {
  const ps = ids.map(pedById).filter(Boolean);
  ps.forEach(p => {
    const c = cliById(p.clienteId) || {}, desde = (p.guardadoSinPagar && p.guardadoSinPagar.desde) || hoyISO();
    if (p.estado !== 'guardado') setEstado(p, 'guardado');
    p.guardadoSinPagar = { desde, hasta, ...(c.puedeGuardarSinPagar ? {} : { excepcion: true }) };
  });
  guardar();
  return ps;
}
function plazoBtnHTML(p) {
  if (p.cambio || pagado(p) || !['pendiente', 'guardado'].includes(p.estado)) return '';
  if (p.estado === 'guardado' && !p.guardadoSinPagar) return '';
  return `<button class="b" data-act="masPlazo" data-ids="${p.id}" title="Pasa el pedido a Guardado sin pagar con fecha límite">📅 ${p.guardadoSinPagar ? 'Cambiar plazo' : 'Más plazo'}</button>`;
}
function plazoModal(ids) {
  const ps = ids.map(pedById).filter(Boolean); if (!ps.length) return;
  UI.plazoIds = ids;
  const c = cliById(ps[0].clienteId) || { nombre: '?' }, act = ps.map(p => p.guardadoSinPagar && p.guardadoSinPagar.hasta).filter(Boolean).sort()[0];
  showModal(`<h3>📅 Más plazo · ${esc(c.nombre)}</h3>
    <p class="small muted mb">${ps.map(p => '#' + p.num).join(' · ')} pasa a <b>Guardado sin pagar</b> hasta la fecha que elijas. No recibe recordatorios y, al vencer, aparece en "Para liberar".${c.puedeGuardarSinPagar ? '' : ' Es una excepción: la clienta no queda autorizada para siempre.'}${act ? '<br>Ahora vence el ' + fechaUY(act) + '.' : ''}</p>
    <div class="row"><button class="b" data-act="plazoDias" data-d="3">+3 días</button><button class="b" data-act="plazoDias" data-d="7">+7 días</button></div>
    <div class="row mt"><input type="date" id="plazo-f" min="${hoyISO()}" style="flex:1"><button class="b ok" data-act="plazoFecha">✓ Guardar fecha</button></div>
    <div class="row mt"><span class="grow"></span><button class="b gh" data-act="closeModal">Cancelar</button></div>`);
}
function plazoListo(hasta) {
  const ps = aplicarPlazo(UI.plazoIds || [], hasta); closeModal();
  toast('✓ ' + ps.map(p => '#' + p.num).join(' · ') + ' guardado hasta el ' + fechaUY(hasta)); render();
}
function liberarHTML() {
  const ps = paraLiberar(), lib = liberadosRecientes();
  if (!ps.length && !lib.length) return '';
  const porCli = new Map(); ps.forEach(p => { if (!porCli.has(p.clienteId)) porCli.set(p.clienteId, []); porCli.get(p.clienteId).push(p); });
  let h = `<div class="card mb"><div class="card-t" style="margin:0">⏳ Para liberar <span class="bdg">${ps.length}</span></div>`;
  if (!ps.length) h += '<div class="small muted mt">No hay pedidos vencidos 🎉</div>';
  else {
    h += `<p class="small muted mt">Sin pagar y con el plazo vencido (después de las ${HORA_LIBERAR}:00). La app no libera sola: confirmás vos.</p>`;
    h += [...porCli].map(([cid, gp]) => { const c = cliById(cid) || { nombre: '?' }, ids = gp.map(p => p.id).join(','), tot = gp.reduce((s2, p) => s2 + calc(p).total, 0);
      return `<div class="mb-k rojo"><div class="row"><b class="grow" style="flex:1">${nomAlias(c)}</b><b class="mono">${fmt(tot)}</b></div>
        <div class="small muted">${gp.map(p => '#' + p.num + ' (venció el ' + fechaUY(limiteDe(p), 1) + (p.guardadoSinPagar ? ', con plazo extra' : '') + ')').join(' · ')}</div>
        <div class="row mt">${c.tel ? `<button class="b sm" data-act="waCli" data-cid="${cid}">💬 Chat</button>` : ''}<button class="b sm ok" data-act="despDarSalida" data-cid="${cid}" data-ids="${ids}" data-t="${entregaEf(gp[0])}" title="Si ya salió o se entregó y quedó sin marcar: abre la clienta para darle salida">🚚 Dar salida</button><button class="b sm" data-act="masPlazo" data-ids="${ids}">📅 Aplazar</button><button class="b sm dan" data-act="liberarPeds" data-ids="${ids}">❌ Liberar</button></div></div>`; }).join('');
  }
  if (lib.length) h += `<div class="row mt" data-act="libRecTog" style="cursor:pointer"><span class="small muted">Liberados en los últimos 7 días (${lib.length})</span><span class="grow"></span><span class="muted">${UI.libRec ? '▲' : '▼'}</span></div>`
    + (UI.libRec ? lib.map(p => { const c = cliById(p.clienteId) || { nombre: '?' }; return `<div class="small" style="padding:3px 0">${fechaUY(p.fechas.liberado, 1)} · #${p.num} · ${nomAlias(c)} · ${fmt(calc(p).total)}</div>`; }).join('') : '');
  return h + '</div>';
}
Object.assign(ACT, {
  masPlazo: d => plazoModal(String(d.ids || '').split(',').filter(Boolean)),
  plazoDias: d => { const ps = (UI.plazoIds || []).map(pedById).filter(Boolean), act = ps.map(p => p.guardadoSinPagar && p.guardadoSinPagar.hasta).filter(Boolean).sort().pop(); plazoListo(sumarDias(act && act > hoyISO() ? act : hoyISO(), +d.d)); },
  plazoFecha: () => { const f = ($('#plazo-f') || {}).value; if (!f) return toast('Elegí una fecha'); if (f < hoyISO()) return toast('La fecha ya pasó'); plazoListo(f); },
  verLiberar: () => { UI.desp.vista = 'liberar'; ACT.tab({ t: 'despacho' }); },
  libRecTog: () => { UI.libRec = !UI.libRec; render(); },
  liberarPeds: d => {
    const ps = String(d.ids || '').split(',').map(pedById).filter(p => p && !pagado(p)); if (!ps.length) return;
    const c = cliById(ps[0].clienteId) || { nombre: '?' };
    if (!confirm(`¿Liberar ${ps.map(p => '#' + p.num).join(' · ')} de ${c.nombre}?\n\nLa ropa vuelve al stock y queda como deuda en la ficha.`)) return;
    ps.forEach(p => setEstado(p, 'liberado')); guardar(); toast('❌ Liberado' + (ps.length > 1 ? 's ' : ' ') + ps.map(p => '#' + p.num).join(' · ')); render();
  }
});
// Aviso al equipo cuando hay pedidos para liberar
const _avisosMabelHTML = avisosMabelHTML;
avisosMabelHTML = function () {
  let h = _avisosMabelHTML(); const n = paraLiberar().length;
  if (n) h += `<div class="mb-av"><span class="grow">⏳ ${n} pedido${n > 1 ? 's' : ''} sin pagar con el plazo vencido: para liberar o aplazar</span><button class="b sm" data-act="verLiberar">Ver</button></div>`;
  return h;
};
pintarAvisosMabel();
