'use strict';
/* ══════════════════════════════════════════════════════════════
   EMMA · LIVE SIMPLE
   Con Despacho, Live queda solo para cargar clientas y prendas durante el live
   y sacar las etiquetas generales. La entrega (retiro, agencia, cadetería),
   el pago y los estados se manejan en Despacho.
   Etiqueta general (igual para todos): número de pedido grande, nombre, teléfono y QR.
   ══════════════════════════════════════════════════════════════ */

(() => {
  const st = document.createElement('style');
  st.textContent = `
.lv .te{font-size:8pt;font-weight:700;font-family:Arial,Helvetica,sans-serif}
.lv.m50 .te{font-size:9pt}
.lv .ar{font-size:8pt;font-weight:900;border:.35mm solid #000;border-radius:1mm;padding:0 .8mm;white-space:nowrap;letter-spacing:0}
.lv.m50 .ar{font-size:9pt}.lv.a4 .nu .ar{font-size:15pt;padding:0 2mm;vertical-align:middle}
.lv .em{align-items:center}
.lv.a4{padding:4mm;gap:4mm}
.lv.a4 .em{font-size:9pt}.lv.a4 .nu{font-size:44pt}.lv.a4 .no{font-size:17pt}.lv.a4 .te{font-size:13pt}
.sheet-a4>.lbl.gen{padding:0;border:1.4px dashed #999}
.lbl.gen>.lv{flex:1;page-break-after:auto;break-after:auto}
`;
  document.head.appendChild(st);
})();

// ─── Pestañas de la lista: sin las de entrega ─────────────────
PED_TABS.splice(0, PED_TABS.length, ['todos', 'Todos'], ['abiertos', '📋 Sin salida'], ['guardado', '⏸️ Guardados'], ['cerrado', '✔️ Cerrados']);
pestanaDe = function (p) {
  if (p.estado === 'guardado') return 'guardado';
  if (p.estado === 'pendiente' || p.estado === 'listo') return 'abiertos';
  return 'cerrado';
};
if (!PED_TABS.some(t => t[0] === UI.pedTab)) UI.pedTab = 'todos';

// ─── Tarjeta del pedido ───────────────────────────────────────
function chipSalidaLive(p) {
  if (p.estado === 'enviado') { const k = p.paqueteId && typeof paqById === 'function' && paqById(p.paqueteId); return `<span class="chip ok">🚚 ${k ? { retiro: 'Entregado', agencia: 'Agencia', cadeteria: 'Cadetería' }[k.tipo] : 'Salió'}</span>`; }
  if (p.estado === 'guardado') return '<span class="chip gu">⏸️ Guardado</span>';
  if (p.estado === 'liberado') return '<span class="chip li">❌ Liberado</span>';
  if (p.estado === 'abandonado') return '<span class="chip li">Abandonado</span>';
  return p.pago ? `<span class="chip ok">✓ Pagó · ${esc(p.pago.cuenta)}</span>` : '';
}
cardPedido = function (p, live, m) {
  const c = cliById(p.clienteId) || { id: '', nombre: '(sin clienta)', alias: [], tel: '' };
  const h = m[c.id] || ST0, t = calc(p), open = UI.abiertos.has(p.id);
  const marcas = [];
  if (h.deudas.length) marcas.push('<span class="chip li">⚠️ deudora</span>');
  if (h.guardados.some(x => x.id !== p.id)) marcas.push('<span class="chip gu">📦 guardado</span>');
  if (c.saldoFavor > 0) marcas.push(`<span class="chip ok">💰 ${fmt(c.saldoFavor)}</span>`);
  if (!c.tel) marcas.push('<span class="chip pe">sin tel</span>');
  if (p.cambio) marcas.unshift('<span class="chip ac">🔄 Cambio</span>');
  return `<div class="pc est-${p.estado}" id="pc-${p.id}">
    <div class="pc-h" data-act="togglePedido" data-id="${p.id}">
      <span class="num">#${p.num}</span>
      <div class="pc-main">
        <div class="pc-nom">${p.cambio ? '' : `<button class="b sm cambcli" data-act="cambiarCli" data-id="${p.id}" title="Cambiar clienta">⇄</button>`}${esc(c.nombre)}</div>
        <div class="pc-sub">${histHTML(h)} ${chipSalidaLive(p)} ${marcas.join(' ')} <span class="mono">${p.cambio ? p.cambio.art : t.art} art.</span></div>
      </div>
      <div class="pc-tot">${p.cambio ? (p.cambio.cobrar ? fmt(p.cambio.cobrar) : '🔄') : fmt(t.total)}</div>
    </div>
    ${open ? cuerpoPedido(p, c, live, t, h) : ''}
  </div>`;
};
cuerpoPedido = function (p, c, live, t, h) {
  const id = p.id;
  if (p.cambio) {
    const cb = p.cambio;
    return `<div class="pc-b">
      <div class="small muted mt">Orden de envío de un cambio · código <span class="mono">${p.codigo}</span> · ${fechaUY(p.fechas.creado)}</div>
      <div class="box mt small"><div>⬅️ <b>Entró:</b> ${esc(cb.entra.join(', ') || '—')}</div><div style="margin-top:4px">➡️ <b>Sale:</b> ${esc(cb.sale.join(', ') || '—')}</div>
        <div style="margin-top:4px">${cb.cobrar ? `💵 <b>Cobrar diferencia: ${fmt(cb.cobrar)}</b>` : cb.favor ? `💰 Quedó ${fmt(cb.favor)} a favor en la ficha` : 'Sin diferencia'}</div></div>
      <div class="small muted mt">${p.estado === 'enviado' ? '🚚 Salió el ' + fechaUY(p.fechas.enviado) : 'Sale desde 🚚 Despacho.'}</div>
      <div class="sec row"><button class="b" data-act="etqPedido" data-id="${id}">🏷️ Etiqueta</button><button class="b" data-act="verFicha" data-cid="${c.id}">👤 Ficha</button><span class="grow"></span><button class="b dan" data-act="delPedido" data-id="${id}">🗑️</button></div>
    </div>`;
  }
  const prendas = p.prendas.length ? p.prendas.map((pr, i) => `<div class="pr">
      <div class="pr-n">${esc(pr.nombre)}${pr.codigo ? '<small>' + esc(pr.codigo) + '</small>' : '<small>manual</small>'}</div>
      <span class="qty"><button class="b sm" data-act="qty" data-id="${id}" data-i="${i}" data-d="-1">−</button><span>${pr.qty}</span><button class="b sm" data-act="qty" data-id="${id}" data-i="${i}" data-d="1">+</button></span>
      <div class="pr-p">${precioHTML(pr)}</div>
      <button class="b sm dan" data-act="delPrenda" data-id="${id}" data-i="${i}" title="Quitar">✕</button>
    </div>`).join('') : '<div class="empty" style="padding:10px 0">Sin prendas todavía</div>';
  const saldoDisp = +c.saldoFavor || 0;
  let saldoLinea = '';
  if (p.saldoAplicado > 0) saldoLinea = `<div class="tot-l" style="color:var(--ok)"><span>💰 Saldo a favor <button class="b sm gh" data-act="quitarSaldo" data-id="${id}">quitar</button></span><span>−${fmt(t.saldo)}</span></div>`;
  else if (saldoDisp > 0 && p.estado === 'pendiente') saldoLinea = `<div class="tot-l"><span class="muted">💰 Tiene ${fmt(saldoDisp)} a favor</span><button class="b sm" data-act="aplicarSaldo" data-id="${id}">Aplicar</button></div>`;
  const editNom = UI.editNom.has(id) ? `<div class="box mt"><div class="grid2"><input id="en-${id}" value="${esc(c.nombre)}" placeholder="Nombre"><input id="er-${id}" value="${esc(c.ref || '')}" placeholder="Referencia (apellido, emoji…)"><input id="et-${id}" value="${esc(c.tel)}" placeholder="Teléfono" inputmode="tel"></div>
      <div class="small muted mt">Si cambia el usuario de TikTok, el nombre anterior queda como alias. Si el teléfono es de otra ficha, se fusionan.</div>
      <div class="row mt"><button class="b sm ok" data-act="guardarNomTel" data-id="${id}">✓ Guardar</button><button class="b sm gh" data-act="editNom" data-id="${id}">Cancelar</button></div></div>` : '';
  const salida = p.estado === 'enviado' ? `🚚 Salió el ${fechaUY(p.fechas.enviado)}` : p.estado === 'guardado' ? `⏸️ Guardado desde el ${fechaUY(p.fechas.guardado)}` : p.estado === 'liberado' ? '❌ Liberado (la ropa volvió al stock)' : p.estado === 'abandonado' ? 'Abandonado' : 'Pago, entrega y salida: en 🚚 Despacho';
  return `<div class="pc-b">
    <div class="small muted mt">Código <span class="mono">${p.codigo}</span> · ${c.tel ? '<span class="mono">' + esc(c.tel) + '</span>' : '⚠️ sin tel'}${c.alias.length ? ' · antes: ' + esc(c.alias.join(', ')) : ''}</div>
    ${alertasHTML(c, p, h)}
    <div class="mt">${prendas}</div>
    <button class="b sm mt" data-act="abrirCarga" data-id="${id}">➕ Cargar prendas</button>
    <div class="sec">
      <div class="row"><span class="small muted">Descuento del pedido (%)</span><input type="number" inputmode="numeric" style="width:90px" id="dp-${id}" data-chg="descPedido" data-id="${id}" value="${p.descuento ?? ''}" placeholder="${live.descuento ? 'live ' + live.descuento : '0'}"><span class="small muted">vacío = el del live · 0 = sin descuento</span></div>
      <div class="mt">
        ${typeof descLineasHTML === 'function' ? descLineasHTML(t) : (t.descMonto ? `<div class="tot-l"><span>Subtotal</span><span>${fmt(t.bruto)}</span></div><div class="tot-l" style="color:var(--ac)"><span>🎉 Descuento ${t.desc}%</span><span>−${fmt(t.descMonto)}</span></div>` : '')}
        ${saldoLinea}
        <div class="tot-l big"><span>Total</span><span>${fmt(t.total)}</span></div>
      </div>
    </div>
    <div class="small muted mt">${salida}</div>
    <div class="sec row">
      <button class="b wa" data-act="waPedido" data-id="${id}">💬 WhatsApp</button>
      <button class="b" data-act="waCli" data-cid="${c.id}" title="Abrir el chat vacío, sin mensaje">💬 Chat</button>
      ${typeof confBtnHTML === 'function' ? confBtnHTML(p) : ''}
      <button class="b" data-act="previewMsg" data-id="${id}" title="Ver el mensaje">👁️</button>
      <button class="b" data-act="etqPedido" data-id="${id}">🏷️ Etiqueta</button>
      <button class="b" data-act="verFicha" data-cid="${c.id}">👤 Ficha</button>
      <button class="b" data-act="editNom" data-id="${id}">✏️ Nombre/tel</button>
      <span class="grow"></span>
      <button class="b dan" data-act="delPedido" data-id="${id}">🗑️</button>
    </div>
    ${editNom}
    ${UI.preview.has(id) ? `<div class="msg">${esc(mensajePedido(p))}</div>` : ''}
  </div>`;
};

// ─── Etiqueta general: igual para todos ───────────────────────
// Asterisco al lado del número si la clienta tiene OTROS pedidos sin salida (pendiente, listo o guardado): para armarlos juntos (31/10)
function otrosAbiertosMarca(p) { try { return typeof abiertosDe === 'function' && abiertosDe(p.clienteId).some(x => x.id !== p.id) ? '<b class="otros-ab">*</b>' : ''; } catch (e) { return ''; } }
function etqGeneralHTML(p, medida) {
  const c = cliById(p.clienteId) || { nombre: '?', tel: '' }, l = liveById(p.liveId) || {};
  const tam = medida === 'a4' ? '30mm' : medida === '50x30' ? '20mm' : '17mm';
  const svg = barcodeSVG(p.codigo).replace('<svg ', `<svg style="width:${tam};height:${tam}" `);
  return `<div class="lv${medida === '50x30' ? ' m50' : medida === 'a4' ? ' a4' : ''}"><div class="qr">${svg}</div><div class="tx">
    ${(() => { const ar = p.cambio ? '' : `<span class="ar">${calc(p).art} art.</span>`;
      // Rollo chico: la cantidad va arriba, así no le saca lugar al nombre. Hoja A4: al lado del número.
      return medida === 'a4'
        ? `<div class="em"><span>EMMA</span><span>${fechaUY(l.fecha || hoyISO(), 1)}</span></div><div class="nu">#${p.num}${otrosAbiertosMarca(p)} ${ar}</div>`
        : `<div class="em"><span>EMMA ${fechaUY(l.fecha || hoyISO(), 1)}</span>${ar}</div><div class="nu">#${p.num}${otrosAbiertosMarca(p)}</div>`; })()}
    <div class="no">${esc(c.nombre)}</div>
    <div class="te">${esc(c.tel || '')}</div></div></div>`;
}
/** Formato de las etiquetas generales en este equipo: A4 (10 por hoja) o rollo chico. */
function medidaGeneral() { const c = etqLiveCfg(); return c.general || 'a4'; }
function imprimirGenerales(ps) {
  if (!ps.length) return toast('No hay pedidos para imprimir');
  const m = medidaGeneral();
  if (m === 'a4') {
    $('#print-page').textContent = '@page{size:A4;margin:0}';
    $('#print-area').innerHTML = hojasHTML(ps.map(p => `<div class="lbl gen">${etqGeneralHTML(p, 'a4')}</div>`));
  } else {
    const [w, h] = m.split('x');
    $('#print-page').textContent = `@page{size:${w}mm ${h}mm;margin:0} #print-area .lv{width:${w}mm;height:${h}mm}`;
    $('#print-area').innerHTML = ps.map(p => etqGeneralHTML(p, m)).join('');
  }
  setTimeout(() => window.print(), 60);
}
etiquetasLive = function () {
  imprimirGenerales(liveActual().pedidos.filter(p => esActivo(p.estado)).sort((a, b) => a.num - b.num));
};
Object.assign(ACT, {
  etqPedido: d => { const p = pedById(d.id); if (p) imprimirGenerales([p]); },
  etqGeneralMedida: d => { const c = etqLiveCfg(); c.general = d.v; etqLiveGuardar(c); pintarCfgEtq(); }
});

// Config: la tarjeta de etiquetas de este equipo suma el formato de las generales
const _pintarCfgEtq = pintarCfgEtq;
pintarCfgEtq = function () {
  _pintarCfgEtq();
  const el = document.getElementById('cf-etqlive'); if (!el) return;
  const m = medidaGeneral();
  const div = document.createElement('div');
  div.innerHTML = `<div class="card-t" style="margin-top:16px">🏷️ Etiquetas de pedido (botón Etiquetas de Live)</div>
    <p class="small muted mb">Todas iguales: número de pedido, nombre, teléfono y QR.</p>
    <div class="row">${[['a4', 'Hoja A4 (10 por hoja)'], ['40x30', '40×30 mm'], ['50x30', '50×30 mm']].map(([v, t]) => `<button class="b sm seg${m === v ? ' on' : ''}" data-act="etqGeneralMedida" data-v="${v}">${t}</button>`).join('')}</div>`;
  el.appendChild(div);
};
pintarCfgEtq();

// La barra de Live: sin "Todos listos" (el pago se marca en Despacho)
(() => { const b = document.querySelector('[data-act=todosListos]'); if (b) b.remove(); })();

// ── Live que se mira: por equipo, no compartido (27/10) ──
// config.liveActualId = el "live de hoy", compartido por todos (lo cambian "+ Nuevo live" y "Traer un live").
// Cambiar el selector o abrir un pedido de otro live ya NO lo toca: se guarda solo en este navegador.
// Así mirar un live viejo en el celu no mueve la compu, y los pedidos nuevos de la compu no caen en un live viejo.
// Solo vale en la pestaña Live (Mostrador, cambios y respaldos siempre usan el de hoy) y se descarta cuando cambia el de hoy.
const LIVE_VER_KEY = 'emma_live_ver';
function leerLiveVer() { try { return JSON.parse(localStorage.getItem(LIVE_VER_KEY) || 'null'); } catch (e) { return null; } }
function guardarLiveVer(id) {
  try {
    if (!id || id === (DB.config.liveActualId || null)) localStorage.removeItem(LIVE_VER_KEY);
    else localStorage.setItem(LIVE_VER_KEY, JSON.stringify({ id, base: DB.config.liveActualId || null }));
  } catch (e) { /* sin espacio o bloqueado: se queda en el de hoy */ }
}
const liveDeHoy = () => liveById(cfg('liveActualId')) || DB.lives[DB.lives.length - 1];
liveActual = function () {
  if (UI.tab === 'live') {
    const v = leerLiveVer();
    if (v && v.base === (DB.config.liveActualId || null)) { const l = liveById(v.id); if (l) return l; }
  }
  return liveDeHoy();
};
CHG.cambiarLive = (d, el) => { guardarLiveVer(el.value); UI.cargaId = null; UI.abiertos.clear(); render(); };
ACT.volverLiveHoy = () => { guardarLiveVer(null); UI.cargaId = null; UI.abiertos.clear(); render(); };
irPedido = function (id) {
  const p = pedById(id); if (!p) return;
  closeModal();
  const h = liveDeHoy();
  guardarLiveVer(h && p.liveId === h.id ? null : p.liveId);
  UI.abiertos.add(id); UI.filtroLive = ''; $('#live-filtro').value = '';
  if (UI.pedTab !== 'todos' && UI.pedTab !== pestanaDe(p)) UI.pedTab = pestanaDe(p);
  setTab('live');
  setTimeout(() => { const el = $('#pc-' + id); if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1800); } }, 40);
};
const _renderLiveBase = renderLive;
renderLive = function () {
  _renderLiveBase();
  const sel = $('#live-sel'); if (!sel) return;
  const v = liveActual(), h = liveDeHoy();
  const op = h && sel.querySelector(`option[value="${CSS.escape(h.id)}"]`);
  if (op && !op.textContent.startsWith('⭐')) op.textContent = '⭐ ' + op.textContent + ' · de hoy';
  let el = document.getElementById('live-ver-aviso');
  if (!el) { el = document.createElement('div'); el.id = 'live-ver-aviso'; sel.closest('.row').after(el); }
  const html = v && h && v.id !== h.id
    ? `<div class="av am mt"><span class="grow">👀 Estás mirando <b>${esc(v.nombre)}</b> solo en este equipo; los demás siguen en <b>${esc(h.nombre)}</b>. Ojo: lo que cargues acá va a este live.</span><button class="b sm pri" data-act="volverLiveHoy">Volver al de hoy</button></div>`
    : '';
  if (el.innerHTML !== html) el.innerHTML = html;
};


// ─── Confirmación durante el live (28/10) ─────────────────────
// Se manda cuando la clienta compra su primera prenda: SIN número de pedido ni total (puede seguir sumando). Una sola vez por clienta en el live.
const CONF_MSG_DEF = 'Hola {nombre}! De Emma Indumentaria 💛 Te anotamos en el live, ¿me confirmás con un SÍ?';
function primerNombreConf(n) { const w = String(n || '').trim().split(/\s+/)[0] || ''; return w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ''; }
function textoConfirmacion(c) { return (cfg('msgConfirmacion') || CONF_MSG_DEF).replace(/\{nombre\}/g, primerNombreConf(c.nombre)); }
/** ¿Ya se le mandó la confirmación en este live? (cualquier pedido de la clienta en el mismo live) */
function confirmacionEnviada(p) { return todosPedidos().some(x => x.clienteId === p.clienteId && x.liveId === p.liveId && x.confirmWA); }
function confBtnHTML(p) {
  if (!p.prendas || !p.prendas.length || p.cambio) return '';
  const conf = todosPedidos().find(x => x.clienteId === p.clienteId && x.liveId === p.liveId && x.confirmado);
  if (conf) return `<span class="chip ok" title="La clienta confirmó por WhatsApp${conf.confirmadoPor === 'mabel' ? ' (lo marcó Mabel)' : ''}">💛 Confirmó</span>`;
  return confirmacionEnviada(p) ? '<span class="chip ok" title="Ya se le mandó el mensaje de confirmación en este live">✓ Confirmación enviada</span>'
    : `<button class="b" data-act="waConfirm" data-id="${p.id}" title="Manda: ${esc(textoConfirmacion(cliById(p.clienteId) || { nombre: '' }))}">✅ Enviar confirmación</button>`;
}
Object.assign(ACT, {
  waConfirm: d => {
    const p = pedById(d.id), c = p && cliById(p.clienteId); if (!p || !c) return;
    if (!p.prendas.length) return toast('Agregá la primera prenda primero');
    if (confirmacionEnviada(p) && !confirm('Ya le mandaste la confirmación en este live. ¿Mandarla de nuevo?')) return;
    if (!c.tel && !pedirTel(c)) return;
    enviarConfirmacionAPI(p, c);
  }
});

// ─── Confirmación por la API de WhatsApp (4/11) ────────────────
// Sale sola desde el número de Emma con la plantilla aprobada por Meta (emma_confirmacion), sin abrir WhatsApp.
// Si la API falla, ofrece mandarla a mano como antes.
async function enviarConfirmacionAPI(p, c) {
  const manual = () => { if (abrirWA(c.tel, textoConfirmacion(c))) { p.confirmWA = ahoraISO(); guardar(); render(); } };
  if (typeof NUBE === 'undefined' || !NUBE.sb) return manual();
  toast('📤 Enviando confirmación…');
  try {
    const { data, error } = await NUBE.sb.functions.invoke('whatsapp-enviar', { body: { plantilla: 'emma_confirmacion', items: [{ ref: p.id, tel: c.tel, vars: [primerNombreConf(c.nombre) || 'bella'] }] } });
    const r = data && data.res && data.res[0];
    if (error || !r || !r.ok) throw new Error((r && r.error) || (error && error.message) || 'sin respuesta');
    p.confirmWA = ahoraISO(); p.confirmPorAPI = true; guardar(); render();
    toast('✅ Confirmación enviada a ' + (primerNombreConf(c.nombre) || 'la clienta'));
  } catch (e) {
    if (confirm('No se pudo mandar por la API (' + e.message + '). ¿Abrir WhatsApp para mandarla a mano?')) manual();
  }
}

// ─── WhatsApp en la compu: app o WhatsApp Web (30/10) ──────────
// Se elige en Config y queda guardado en ESTE navegador (cada equipo elige el suyo). En el celu siempre wa.me.
const WA_COMPU_KEY = 'emma_wa_compu';
function waCompu() { try { return localStorage.getItem(WA_COMPU_KEY) === 'app' ? 'app' : 'web'; } catch (e) { return 'web'; } }
abrirWA = function (tel, texto) {
  const k = telKey(tel);
  if (!k) { toast('Esta clienta no tiene teléfono'); return false; }
  const n = '598' + k, t = texto ? encodeURIComponent(texto) : '';
  const movil = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  if (movil) { window.open(`https://wa.me/${n}${t ? '?text=' + t : ''}`, '_blank'); return true; }
  if (waCompu() === 'app') { location.href = `whatsapp://send?phone=${n}${t ? '&text=' + t : ''}`; return true; }
  window.open(`https://web.whatsapp.com/send?phone=${n}${t ? '&text=' + t : ''}`, '_blank');
  return true;
};
(function () {
  const sel = document.getElementById('cf-formato'); if (!sel || document.getElementById('cf-wa')) return;
  const d = document.createElement('div'); d.className = 'mt';
  d.innerHTML = '<label class="lb">💬 En esta compu, WhatsApp abre en…</label><select id="cf-wa"><option value="web">WhatsApp Web (Chrome)</option><option value="app">App de WhatsApp (más rápida)</option></select><div class="small muted">Se guarda solo en este equipo. Para "App" tiene que estar instalada la app de WhatsApp. En el celu siempre abre la app.</div>';
  sel.closest('.grid2').insertAdjacentElement('afterend', d);
  const s2 = d.querySelector('select'); s2.value = waCompu();
  s2.addEventListener('change', () => { try { localStorage.setItem(WA_COMPU_KEY, s2.value); } catch (e) {} toast('✓ WhatsApp abre en ' + (s2.value === 'app' ? 'la app' : 'WhatsApp Web')); });
})();

// ─── Fecha de pago real del live (31/10) ──────────────────────
// live.fechaPagoISO = fecha elegida en el calendario; live.fechaPago = el texto que sale en el mensaje ("el martes 3/11").
// La clienta solo ve esa fecha. "Para liberar" usa el día siguiente a las 16:00 (mabel.js, limitePagoNormal).
const DIAS_FP = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const fechaPagoTexto = iso => 'el ' + DIAS_FP[new Date(iso + 'T12:00:00').getDay()] + ' ' + fechaUY(iso, 1).replace(/^0/, '').replace('/0', '/');
function ponerFechaPago(l, iso) { if (!l || !iso) return; l.fechaPagoISO = iso; l.fechaPago = fechaPagoTexto(iso); saveLives(); }
nuevoLive = function () {
  if (!puedoAgregar()) return;
  const sug = 'Live ' + fechaUY(hoyISO());
  const nombre = prompt('Nombre del nuevo live:', sug);
  if (nombre === null) return;
  tomarRespaldo('Antes de crear "' + (nombre || sug) + '"');
  const iso = sumarDias(hoyISO(), 1);
  const l = { id: uid('l'), nombre: nombre.trim() || sug, fecha: hoyISO(), fechaPago: fechaPagoTexto(iso), fechaPagoISO: iso, descuento: 0, pedidoCounter: 0, pedidos: [] };
  DB.lives.push(l);
  saveLives();
  saveConfig({ liveActualId: l.id });
  UI.cargaId = null; UI.abiertos.clear();
  toast('✓ Live creado · pagan hasta ' + l.fechaPago + ' (cambiala en 📅 si es otra)', 5000);
  render();
  const cp = $('#cpl-in'); if (cp) cp.focus();
};
function pintarFechaPago() {
  const viejo = document.getElementById('live-fpago'); if (!viejo) return;
  let box = document.getElementById('live-fp-box');
  if (!box) {
    viejo.style.display = 'none';
    const lb = viejo.previousElementSibling; if (lb) lb.textContent = '📅 Pagan hasta (sale en el mensaje)';
    box = document.createElement('div'); box.id = 'live-fp-box';
    box.innerHTML = '<div class="row" style="gap:6px"><input type="date" id="live-fp-d" style="flex:1;min-width:0"><button class="b sm" id="live-fp-m" type="button">Mañana</button></div><div class="small muted" id="live-fp-t" style="margin-top:4px"></div>';
    viejo.insertAdjacentElement('afterend', box);
    box.querySelector('#live-fp-d').addEventListener('change', e => { if (!e.target.value) return; ponerFechaPago(liveActual(), e.target.value); toast('✓ Pagan hasta ' + liveActual().fechaPago); pintarFechaPago(); render(); });
    box.querySelector('#live-fp-m').addEventListener('click', () => { const l = liveActual(); ponerFechaPago(l, sumarDias(l.fecha || hoyISO(), 1)); toast('✓ Pagan hasta ' + l.fechaPago); pintarFechaPago(); render(); });
  }
  const l = liveActual(); if (!l) return;
  const d = box.querySelector('#live-fp-d'); if (document.activeElement !== d) d.value = l.fechaPagoISO || '';
  box.querySelector('#live-fp-t').innerHTML = l.fechaPagoISO
    ? `La clienta ve: "Podés pagarlo hasta <b>${esc(l.fechaPago)}</b>". Se libera el ${fechaPagoTexto(sumarDias(l.fechaPagoISO, 1)).slice(3)} a las 16:00.`
    : (l.fechaPago ? `Texto anterior: "${esc(l.fechaPago)}". Elegí la fecha para que "Para liberar" la use.` : 'Elegí hasta qué día pagan.');
}
const _renderLiveFP = renderLive;
renderLive = function () { _renderLiveFP.apply(this, arguments); try { pintarFechaPago(); } catch (e) { console.warn(e); } };

// ─── Totales por la API de WhatsApp (4/11) ─────────────────────
// Botón en el live: manda a cada pedido sin pagar la plantilla emma_total_2 (aprobada por Meta) desde el número de Emma.
// Prex va como variable (sale del bloque PREX de Config → mensaje de pago), así cuando cambia la cuenta no hay que tocar Meta.
function prexLinea() {
  const m = String(cfg('msgPago') || '').match(/PREX[^\n]*\n([\s\S]*?)(\n\s*\n|$)/i);
  const l = m ? m[1].split('\n').map(x => x.trim()).filter(Boolean).join(' — ') : '';
  return l || 'Lilian Altezor — CI 46344767 — Cuenta 1837669';
}
function varsTotal(p) {
  const c = cliById(p.clienteId) || { nombre: '' }, live = liveById(p.liveId), t = calc(p);
  const porPrenda = new Map(); t.unidades.forEach(u => porPrenda.set(u.i, (porPrenda.get(u.i) || 0) + u.precio));
  const partes = p.prendas.map((pr, i) => { const q = pr.qty || 1; return `${pr.nombre}${q > 1 ? ' x' + q : ''}: ${fmt(porPrenda.has(i) ? porPrenda.get(i) : pr.precio * q)}`; });
  t.promos.forEach(x => partes.push(`${x.nombre}: -${fmt(x.monto)}`));
  if (t.descLive) partes.push(`Descuento live ${t.livePct}%: -${fmt(t.descLive)}`);
  if (t.descVip) partes.push(`Descuento VIP ${t.vipPct}%: -${fmt(t.descVip)}`);
  if (t.saldo) partes.push(`Saldo a favor: -${fmt(t.saldo)}`);
  const fecha = String((live && live.fechaPago) || '').replace(/^el\s+/i, '').trim();
  return [String(c.nombre || '').trim() || 'bella', String(p.num), partes.join(' · '), fmt(t.total).replace(/^\$\s*/, ''), fecha, prexLinea()];
}
function pendientesTotal(l) {
  return (l ? l.pedidos || [] : []).filter(p => !p.borrado && !p.cambio && p.prendas && p.prendas.length && p.estado === 'pendiente' && !p.totalAPI);
}
async function enviarTotalesAPI() {
  const l = liveActual(); if (!l) return;
  if (!l.fechaPago) return toast('Primero elegí hasta qué día pagan');
  if (typeof NUBE === 'undefined' || !NUBE.sb) return toast('Sin conexión con la nube');
  const lista = pendientesTotal(l), sinTel = lista.filter(p => !(cliById(p.clienteId) || {}).tel), ok = lista.filter(p => (cliById(p.clienteId) || {}).tel);
  if (!ok.length) return toast(sinTel.length ? `Quedan ${sinTel.length} sin teléfono` : 'No hay totales para mandar');
  if (!confirm(`Se van a mandar ${ok.length} totales por WhatsApp desde el número de Emma (cuesta unos $0,45 cada uno).` + (sinTel.length ? `\n${sinTel.length} no tienen teléfono y quedan afuera.` : '') + '\n\n¿Mandar?')) return;
  const btn = document.getElementById('live-tot-api'); if (btn) btn.disabled = true;
  let bien = 0; const mal = [];
  for (let i = 0; i < ok.length; i += 15) {
    const tanda = ok.slice(i, i + 15);
    if (btn) btn.textContent = `📤 Enviando… ${i}/${ok.length}`;
    try {
      const { data, error } = await NUBE.sb.functions.invoke('whatsapp-enviar', { body: { plantilla: 'emma_total_2', items: tanda.map(p => ({ ref: p.id, tel: cliById(p.clienteId).tel, vars: varsTotal(p) })) } });
      if (error) throw error;
      (data.res || []).forEach(r => { const p = pedById(r.ref); if (r.ok && p) { p.totalAPI = ahoraISO(); bien++; } else if (p) mal.push(`#${p.num} ${(cliById(p.clienteId) || {}).nombre || ''}: ${r.error}`); });
    } catch (e) { tanda.forEach(p => mal.push(`#${p.num}: ${e.message || e}`)); }
    guardar();
  }
  if (btn) btn.disabled = false;
  render();
  alert(`✅ ${bien} totales enviados.` + (mal.length ? `\n\n⚠️ No salieron ${mal.length} (mandalos con 💬 WhatsApp):\n` + mal.slice(0, 25).join('\n') : '') + (sinTel.length ? `\n\nSin teléfono: ${sinTel.map(p => '#' + p.num).join(', ')}` : ''));
}
const _pintarFP_tot = pintarFechaPago;
pintarFechaPago = function () {
  _pintarFP_tot.apply(this, arguments);
  const box = document.getElementById('live-fp-box'); if (!box) return;
  let bar = document.getElementById('live-tot-bar');
  if (!bar) {
    bar = document.createElement('div'); bar.id = 'live-tot-bar'; bar.style.marginTop = '8px';
    bar.innerHTML = '<button class="b wa" id="live-tot-api" type="button" style="width:100%">📤 Mandar los totales por WhatsApp</button><div class="small muted" id="live-tot-t" style="margin-top:4px"></div>';
    box.insertAdjacentElement('afterend', bar);
    bar.querySelector('#live-tot-api').addEventListener('click', enviarTotalesAPI);
  }
  const l = liveActual(); if (!l) return;
  const todos = (l.pedidos || []).filter(p => !p.borrado && !p.cambio && p.prendas && p.prendas.length);
  const env = todos.filter(p => p.totalAPI).length, faltan = pendientesTotal(l).length;
  const t = bar.querySelector('#live-tot-t'); if (t) t.textContent = `${env} enviados por la API · ${faltan} sin pagar por mandar`;
};

// ─── Atajos en el live (4/11) ──────────────────────────────────
// 1) Botón de confirmación también en el cuadro de carga (arriba), para no bajar hasta el pedido.
const _renderCarga_conf = renderCarga;
renderCarga = function () {
  _renderCarga_conf.apply(this, arguments);
  const p = UI.cargaId && pedById(UI.cargaId), head = document.getElementById('cr-head');
  if (!p || !head || p.cambio || !p.prendas || !p.prendas.length) return;
  const html = typeof confBtnHTML === 'function' ? confBtnHTML(p) : '';
  if (html) head.insertAdjacentHTML('beforeend', `<div class="row mt" style="gap:6px">${html}</div>`);
};
// 2) Aviso "📵 Sin teléfono (N)" arriba, en Nuevo pedido: pedidos de este live cuya clienta no tiene teléfono.
function pintarSinTel() {
  const card = document.getElementById('np-card'); if (!card) return;
  const t = card.querySelector('.card-t'); if (!t) return;
  const l = liveActual();
  const xs = (l ? l.pedidos || [] : []).filter(p => !p.borrado && !((cliById(p.clienteId) || {}).tel));
  let b = document.getElementById('np-sintel');
  if (!b) {
    b = document.createElement('button'); b.id = 'np-sintel'; b.type = 'button'; b.className = 'b sm'; b.style.marginLeft = '8px';
    t.appendChild(b);
    b.addEventListener('click', () => { UI.verSinTel = !UI.verSinTel; pintarSinTel(); });
  }
  b.hidden = !xs.length;
  b.textContent = `📵 Sin teléfono (${xs.length})`;
  b.className = 'b sm' + (xs.length ? ' dan' : '');
  let lista = document.getElementById('np-sintel-l');
  if (!lista) { lista = document.createElement('div'); lista.id = 'np-sintel-l'; lista.className = 'small mt'; t.insertAdjacentElement('afterend', lista); }
  lista.innerHTML = UI.verSinTel && xs.length
    ? xs.map(p => `<div class="row" style="gap:6px;margin:2px 0"><b>#${p.num}</b><span class="grow">${esc((cliById(p.clienteId) || {}).nombre || '?')}</span><button class="b sm" data-act="irPedido" data-id="${p.id}">Ir</button></div>`).join('')
    : '';
}
const _renderLive_sintel = renderLive;
renderLive = function () { _renderLive_sintel.apply(this, arguments); try { pintarSinTel(); } catch (e) { console.warn(e); } };

// ─── Recordatorios R1 / R2 por la API (5/11) ───────────────────
// Cola de quienes siguen sin pagar, con vista previa y confirmación. Igual que "Mandar los totales": plantilla aprobada de Meta por whatsapp-enviar.
//  R1 = el día de la fecha de pago del live (desde las 20:00) · plantilla emma_recordatorio_1 [nombre, pedido, total]
//  R2 = el día siguiente (desde las 10:00, el plazo llega hasta las 16:00) · plantilla emma_recordatorio_2 [nombre, pedido]
// Entran: pedidos sin pagar (pendiente/listo) de los lives cuya fecha de pago es la de la cola (R1: hoy · R2: ayer).
// Quedan afuera: guardados sin pagar, retiros que pagan al llegar (recibeRecordatorio), clientas sin teléfono, conversaciones donde
// Yanaina está atendiendo y números del equipo (esto último lo decide la función del servidor, que conoce MABEL_EQUIPO).
// Una clienta con varios pedidos en la cola recibe UN solo mensaje: "pedido #12 y #15 por $X" (suma).
const REC = {
  1: { plantilla: 'emma_recordatorio_1', campo: 'recR1', nombre: 'R1', desde: 20, titulo: 'Último día para pagar' },
  2: { plantilla: 'emma_recordatorio_2', campo: 'recR2', nombre: 'R2', desde: 10, titulo: 'Pagan hasta hoy 16:00' },
};
const recFecha = t => t === 1 ? hoyISO() : sumarDias(hoyISO(), -1);
/** ¿Se puede mandar ahora? Devuelve { ok, aviso, motivo }. Fuera de fecha no se manda; antes de la hora pedimos una confirmación extra. */
function recVentana(t) {
  const h = new Date().getHours(), r = REC[t];
  if (t === 2 && h >= (typeof HORA_LIBERAR === 'number' ? HORA_LIBERAR : 16)) return { ok: false, motivo: 'Pasaron las 16:00: el plazo ya venció, el R2 sería engañoso' };
  return { ok: true, aviso: h < r.desde ? `Todavía no son las ${r.desde}:00 (el horario previsto del ${r.nombre})` : '' };
}
function nombresPedidos(ps) {
  const n = ps.map(p => p.num).sort((a, b) => a - b).map((x, i) => i === 0 ? String(x) : '#' + x);
  return n.length < 2 ? n[0] : n.slice(0, -1).join(', ') + ' y ' + n[n.length - 1];
}
function convYanainaDe(c) {
  const k = c.telKey || '';
  return (typeof convActivas === 'function' ? convActivas() : []).some(v => v.clienteId === c.id || (k && (v.id === k || (typeof telKey === 'function' && telKey(v.tel) === k))));
}
/** La cola de un recordatorio: { grupos:[{c, ps, total}], afuera:{...} } */
function colaRecordatorio(t) {
  const fecha = recFecha(t), r = REC[t];
  const lives = DB.lives.filter(l => !l.borrado && l.fechaPagoISO === fecha);
  const ids = new Set(lives.map(l => l.id));
  const abiertos = todosPedidos().filter(p => ids.has(p.liveId) && !p.borrado && !p.cambio && p.prendas && p.prendas.length && ['pendiente', 'listo', 'guardado'].includes(p.estado) && !pagado(p));
  const afuera = { guardados: 0, alRetirar: 0, sinTel: 0, yanaina: 0, yaMandado: 0 };
  const porCli = new Map();
  abiertos.forEach(p => {
    const ep = estadoPago(p);
    if (ep === 'guardado_sin_pagar') { afuera.guardados++; return; }
    if (ep === 'al_retirar') { afuera.alRetirar++; return; }
    if (!recibeRecordatorio(p)) return;
    if (p[r.campo]) { afuera.yaMandado++; return; }
    if (!porCli.has(p.clienteId)) porCli.set(p.clienteId, []);
    porCli.get(p.clienteId).push(p);
  });
  const grupos = [];
  porCli.forEach((ps, cid) => {
    const c = cliById(cid) || { id: cid, nombre: '' };
    if (!c.tel || !telKey(c.tel)) { afuera.sinTel += ps.length; return; }
    if (convYanainaDe(c)) { afuera.yanaina += ps.length; return; }
    grupos.push({ c, ps, total: ps.reduce((s, p) => s + calc(p).total, 0) });
  });
  grupos.sort((a, b) => Math.min(...a.ps.map(p => p.num)) - Math.min(...b.ps.map(p => p.num)));
  return { fecha, lives, grupos, afuera };
}
const recVars = (t, g) => {
  const nom = String(g.c.nombre || '').trim() || 'bella', n = nombresPedidos(g.ps);
  return t === 1 ? [nom, n, fmt(g.total).replace(/^\$\s*/, '')] : [nom, n];
};
function recResumenAfuera(a, extra) {
  const x = [];
  if (a.guardados) x.push(`${a.guardados} guardado${a.guardados > 1 ? 's' : ''} sin pagar`);
  if (a.alRetirar) x.push(`${a.alRetirar} retiro${a.alRetirar > 1 ? 's' : ''} que pagan al llegar`);
  if (a.yanaina) x.push(`${a.yanaina} con Yanaina atendiendo`);
  if (a.equipo) x.push(`${a.equipo} del equipo`);
  if (a.sinTel) x.push(`${a.sinTel} sin teléfono`);
  if (a.yaMandado) x.push(`${a.yaMandado} ya recibieron este recordatorio`);
  (extra || []).forEach(e => x.push(e));
  return x;
}
/** Paso 1: vista previa. Le pregunta a la función del servidor quiénes no salen (equipo / Yanaina) SIN mandar nada. */
async function recordatorioVer(t) {
  const r = REC[t], v = recVentana(t);
  if (!v.ok) return toast(v.motivo, 5000);
  if (typeof NUBE === 'undefined' || !NUBE.sb) return toast('Sin conexión con la nube');
  const q = colaRecordatorio(t);
  if (!q.lives.length) return toast(`No hay ningún live con fecha de pago ${t === 1 ? 'hoy' : 'ayer'} (${fechaUY(q.fecha, 1)})`, 4500);
  if (!q.grupos.length) return showModal(`<h3>🔔 ${r.nombre} · nadie para avisar</h3><p class="small muted">${recResumenAfuera(q.afuera).join(' · ') || 'Todos los pedidos de esos lives figuran pagados.'}</p><div class="row mt"><button class="b pri" data-act="closeModal">Cerrar</button></div>`);
  toast('Revisando la cola…', 1500);
  let excl = new Map();
  try {
    const { data, error } = await NUBE.sb.functions.invoke('whatsapp-enviar', { body: { accion: 'revisar', items: q.grupos.map(g => ({ ref: g.c.id, tel: g.c.tel })) } });
    // Si la función todavía es la versión vieja contesta "plantilla desconocida": NO se manda nada hasta que esté publicada la nueva.
    if (error || !data || !data.revisar) return showModal(`<h3>🔔 ${r.nombre} · falta publicar la función</h3><p class="small">La función <b>whatsapp-enviar</b> todavía no tiene el filtro de números del equipo y de Yanaina. Por seguridad no se manda nada hasta publicarla.</p><div class="row mt"><button class="b pri" data-act="closeModal">Cerrar</button></div>`);
    (data.res || []).forEach(x => { if (!x.ok) excl.set(x.ref, x); });
  } catch (e) { return toast('No se pudo revisar la cola: ' + (e.message || e), 5000); }
  const grupos = q.grupos.filter(g => !excl.has(g.c.id));
  q.grupos.forEach(g => { const x = excl.get(g.c.id); if (!x) return; if (x.skip === 'yanaina') q.afuera.yanaina += g.ps.length; else q.afuera.equipo = (q.afuera.equipo || 0) + g.ps.length; });
  UI.recCola = { t, ids: grupos.map(g => ({ cid: g.c.id, pids: g.ps.map(p => p.id) })), fecha: q.fecha };
  const afuera = recResumenAfuera(q.afuera);
  if (!grupos.length) return showModal(`<h3>🔔 ${r.nombre} · nadie para avisar</h3><p class="small muted">Quedan afuera: ${esc(afuera.join(' · '))}</p><div class="row mt"><button class="b pri" data-act="closeModal">Cerrar</button></div>`);
  const costo = (grupos.length * 0.45).toFixed(2).replace('.', ',');
  const msg = t === 1 ? 'Hola {nombre}! … Hoy es el último día para abonar tu pedido #{n} por ${total}. Si ya pagaste, ignorá este mensaje.' : 'Hola {nombre}! … Tu pedido #{n} era para abonar hasta ayer. Podés pagarlo hasta hoy a las 16:00; después se libera.';
  showModal(`<h3>🔔 ${r.nombre} · ${r.titulo}</h3>
    <p class="small muted">Lives con pago ${t === 1 ? 'hoy' : 'ayer'} (${fechaUY(q.fecha, 1)}): ${q.lives.map(l => esc(l.nombre)).join(' · ')}</p>
    ${v.aviso ? `<div class="av am mb"><span class="grow">⏰ ${esc(v.aviso)}</span></div>` : ''}
    <div class="small muted mb" style="font-style:italic">${esc(msg)}</div>
    <div style="max-height:42vh;overflow:auto;border:1px solid var(--bd);border-radius:10px;padding:6px 10px">${grupos.map(g => `<div class="row" style="gap:6px;padding:3px 0;border-bottom:1px solid var(--bd)"><b>#${esc(nombresPedidos(g.ps))}</b><span class="grow" style="flex:1">${esc(g.c.nombre || '?')}</span><b class="mono">${fmt(g.total)}</b></div>`).join('')}</div>
    <p class="mt"><b>${grupos.length} mensaje${grupos.length > 1 ? 's' : ''}</b> · unos $${costo} de Meta${grupos.some(g => g.ps.length > 1) ? ' · las que tienen más de un pedido reciben un solo mensaje con todos' : ''}</p>
    ${afuera.length ? `<p class="small muted">Quedan afuera: ${esc(afuera.join(' · '))}</p>` : ''}
    <div class="row mt"><button class="b wa" data-act="recEnviar">📤 Mandar ${grupos.length} ${r.nombre} ahora</button><button class="b gh" data-act="closeModal">Cancelar</button></div>`);
}
/** Paso 2: manda lo que se vio en la vista previa (de a 15). Se vuelve a calcular la cola por si algo cambió (pagó, la agarró Yanaina). */
async function recordatorioEnviar() {
  const sel = UI.recCola; if (!sel) return;
  const t = sel.t, r = REC[t], v = recVentana(t);
  if (!v.ok) return toast(v.motivo, 5000);
  if (v.aviso && !confirm(`${v.aviso}.\n\n¿Mandar igual?`)) return;
  const vivos = new Map(colaRecordatorio(t).grupos.map(g => [g.c.id, g]));
  const lista = sel.ids.map(x => vivos.get(x.cid)).filter(Boolean);
  UI.recCola = null; closeModal();
  if (!lista.length) return toast('Ya no queda nadie para avisar');
  let bien = 0; const mal = [], saltados = [];
  for (let i = 0; i < lista.length; i += 15) {
    const tanda = lista.slice(i, i + 15);
    toast(`📤 Enviando ${r.nombre}… ${i}/${lista.length}`, 4000);
    try {
      const { data, error } = await NUBE.sb.functions.invoke('whatsapp-enviar', { body: { plantilla: r.plantilla, items: tanda.map(g => ({ ref: g.c.id, tel: g.c.tel, vars: recVars(t, g) })) } });
      if (error) throw error;
      (data.res || []).forEach(x => {
        const g = tanda.find(y => y.c.id === x.ref); if (!g) return;
        if (x.ok) { g.ps.forEach(p => { p[r.campo] = ahoraISO(); }); bien++; }
        else if (x.skip) saltados.push(`${g.c.nombre || '?'}: ${x.error}`);
        else mal.push(`#${nombresPedidos(g.ps)} ${g.c.nombre || ''}: ${x.error}`);
      });
    } catch (e) { tanda.forEach(g => mal.push(`#${nombresPedidos(g.ps)} ${g.c.nombre || ''}: ${e.message || e}`)); }
    guardar();
  }
  render();
  alert(`✅ ${bien} ${r.nombre} enviados.` + (saltados.length ? `\n\nNo salieron (a propósito) ${saltados.length}:\n` + saltados.slice(0, 15).join('\n') : '') + (mal.length ? `\n\n⚠️ Fallaron ${mal.length} (mandalos con 💬 WhatsApp):\n` + mal.slice(0, 25).join('\n') : ''));
}
Object.assign(ACT, { recVer: d => recordatorioVer(+d.t), recEnviar: () => recordatorioEnviar() });
function pintarRecordatorios() {
  const tot = document.getElementById('live-tot-bar'); if (!tot) return;
  let bar = document.getElementById('live-rec-bar');
  if (!bar) {
    bar = document.createElement('div'); bar.id = 'live-rec-bar'; bar.style.marginTop = '8px';
    bar.innerHTML = '<div class="row" style="gap:6px"><button class="b" data-act="recVer" data-t="1" id="live-rec-1" type="button" style="flex:1">🔔 Recordatorio R1</button><button class="b" data-act="recVer" data-t="2" id="live-rec-2" type="button" style="flex:1">🔔 Recordatorio R2</button></div><div class="small muted" id="live-rec-t" style="margin-top:4px"></div>';
    tot.insertAdjacentElement('afterend', bar);
  }
  const t = bar.querySelector('#live-rec-t'); if (!t) return;
  const n1 = colaRecordatorio(1), n2 = colaRecordatorio(2);
  t.textContent = `R1 (día de pago, 20:00): ${n1.lives.length ? '~' + n1.grupos.length + ' por avisar' : 'ningún live paga hoy'} · R2 (día siguiente, 10:00): ${n2.lives.length ? '~' + n2.grupos.length + ' por avisar' : 'ningún live pagó ayer'}`;
}
const _pintarFP_rec = pintarFechaPago;
pintarFechaPago = function () { _pintarFP_rec.apply(this, arguments); try { pintarRecordatorios(); } catch (e) { console.warn(e); } };
