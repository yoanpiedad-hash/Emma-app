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
  const editNom = UI.editNom.has(id) ? `<div class="box mt"><div class="grid2"><input id="en-${id}" value="${esc(c.nombre)}" placeholder="Nombre"><input id="et-${id}" value="${esc(c.tel)}" placeholder="Teléfono" inputmode="tel"></div>
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
        ${t.descMonto ? `<div class="tot-l"><span>Subtotal</span><span>${fmt(t.bruto)}</span></div><div class="tot-l" style="color:var(--ac)"><span>🎉 Descuento ${t.desc}%</span><span>−${fmt(t.descMonto)}</span></div>` : ''}
        ${saldoLinea}
        <div class="tot-l big"><span>Total</span><span>${fmt(t.total)}</span></div>
      </div>
    </div>
    <div class="small muted mt">${salida}</div>
    <div class="sec row">
      <button class="b wa" data-act="waPedido" data-id="${id}">💬 WhatsApp</button>
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
function etqGeneralHTML(p, medida) {
  const c = cliById(p.clienteId) || { nombre: '?', tel: '' }, l = liveById(p.liveId) || {};
  const tam = medida === 'a4' ? '30mm' : medida === '50x30' ? '20mm' : '17mm';
  const svg = barcodeSVG(p.codigo).replace('<svg ', `<svg style="width:${tam};height:${tam}" `);
  return `<div class="lv${medida === '50x30' ? ' m50' : medida === 'a4' ? ' a4' : ''}"><div class="qr">${svg}</div><div class="tx">
    <div class="em"><span>EMMA</span><span>${fechaUY(l.fecha || hoyISO(), 1)}</span></div>
    <div class="nu">#${p.num}</div><div class="no">${esc(c.nombre)}</div>
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
