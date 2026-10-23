'use strict';
/* ══════════════════════════════════════════════════════════════
   EMMA · ETIQUETA AL CARGAR PRENDA (Live)
   Cada vez que se le agrega una prenda a una clienta en Live, sale una etiqueta chica
   con el número de pedido y el nombre, para pegarla en la prenda y separar después.
   Se activa por equipo (la compu del live), no en el celular.
   Para que imprima sin preguntar, Chrome se abre con --kiosk-printing y la térmica
   como impresora predeterminada con la etiqueta chica.
   ══════════════════════════════════════════════════════════════ */
const EMMA_VERSION = '23/10 · pago desde el celular';

(() => {
  const st = document.createElement('style');
  st.textContent = `
.lv{width:100%;height:100%;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;color:#000;background:#fff;display:flex;gap:1.6mm;padding:1.6mm;overflow:hidden;page-break-after:always;break-after:page}
.lv:last-child{page-break-after:auto;break-after:auto}
.lv .qr{flex:none;display:flex;flex-direction:column;align-items:center;justify-content:center}
.lv .qr svg{display:block}
.lv .tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:.4mm}
.lv .em{font-size:6pt;font-weight:900;letter-spacing:.3mm;display:flex;justify-content:space-between}
.lv .nu{font-size:22pt;font-weight:900;line-height:1}
.lv .no{font-size:9.5pt;font-weight:900;line-height:1.1;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.lv .pr{margin-top:auto;font-size:6.5pt;font-weight:700;line-height:1.1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.lv.m50 .nu{font-size:26pt}.lv.m50 .no{font-size:11pt}.lv.m50 .pr{font-size:7.5pt}
`;
  document.head.appendChild(st);
})();

// Ajustes de este equipo (no van a la nube: cada equipo tiene su impresora)
const ETQ_KEY = 'emma_etq_live';
function etqLiveCfg() { try { return Object.assign({ on: false, medida: '40x30' }, JSON.parse(localStorage.getItem(ETQ_KEY) || '{}')); } catch (e) { return { on: false, medida: '40x30' }; } }
function etqLiveGuardar(c) { try { localStorage.setItem(ETQ_KEY, JSON.stringify(c)); } catch (e) {} }

function etqLiveHTML(p, pr, medida) {
  const c = cliById(p.clienteId) || { nombre: '?' }, l = liveById(p.liveId) || {};
  const qr = medida === '50x30' ? '20mm' : '17mm';
  const svg = barcodeSVG(p.codigo).replace('<svg ', `<svg style="width:${qr};height:${qr}" `);
  return `<div class="lv${medida === '50x30' ? ' m50' : ''}"><div class="qr">${svg}</div><div class="tx">
    <div class="em"><span>EMMA</span><span>${fechaUY(l.fecha || hoyISO(), 1)}</span></div>
    <div class="nu">#${p.num}</div><div class="no">${esc(c.nombre)}</div>
    ${pr ? `<div class="pr">${esc(pr.nombre)}</div>` : ''}</div></div>`;
}
// Cola: si se cargan varias prendas seguidas, salen juntas en una sola impresión
const ETQ_COLA = [];
let _etqTimer = null;
function encolarEtqLive(p, pr) {
  const n = Math.min(20, Math.max(1, +pr.qty || 1));
  for (let i = 0; i < n; i++) ETQ_COLA.push({ id: p.id, pr });
  clearTimeout(_etqTimer);
  _etqTimer = setTimeout(imprimirColaLive, 450);
}
function imprimirColaLive() {
  if (!ETQ_COLA.length) return;
  const cfgE = etqLiveCfg(), [w, h] = cfgE.medida.split('x');
  const items = ETQ_COLA.splice(0);
  const html = items.map(x => { const p = pedById(x.id); return p ? etqLiveHTML(p, x.pr, cfgE.medida) : ''; }).join('');
  if (!html) return;
  $('#print-page').textContent = `@page{size:${w}mm ${h}mm;margin:0} #print-area .lv{width:${w}mm;height:${h}mm}`;
  $('#print-area').innerHTML = html;
  setTimeout(() => window.print(), 40);
  toast(`🏷️ ${items.length > 1 ? items.length + ' etiquetas' : 'Etiqueta'} a la impresora`, 1500);
}

// Se engancha a la carga de prendas: solo en Live, con la clienta abierta, y si está activado en este equipo
const _agregarPrendaOrig = agregarPrenda;
agregarPrenda = function (p, pr) {
  _agregarPrendaOrig(p, pr);
  try { if (UI.tab === 'live' && UI.cargaId === p.id && etqLiveCfg().on) encolarEtqLive(p, pr); } catch (e) { console.warn(e); }
};

// ─── Config: tarjeta de este equipo ───────────────────────────
function montarCfgEtq() {
  const panel = document.getElementById('p-config'); if (!panel || document.getElementById('cf-etqlive')) return;
  const card = document.createElement('div'); card.className = 'card'; card.id = 'cf-etqlive';
  panel.insertBefore(card, panel.firstChild);
  pintarCfgEtq();
}
function pintarCfgEtq() {
  const el = document.getElementById('cf-etqlive'); if (!el) return;
  const c = etqLiveCfg();
  el.innerHTML = `<div class="card-t">🏷️ Etiqueta al cargar prenda (este equipo)</div>
    <p class="small muted mb">En Live, cada prenda que le agregás a una clienta imprime una etiqueta chica con el número de pedido y el nombre, para pegarla en la prenda. Se guarda solo en este equipo: activalo en la compu del live, no en el celular.</p>
    <div class="row"><button class="b seg${c.on ? ' on' : ''}" data-act="etqLiveOn" data-v="1">✓ Activada</button><button class="b seg${c.on ? '' : ' on'}" data-act="etqLiveOn" data-v="0">Apagada</button>
      <span class="small muted" style="margin-left:8px">Medida</span>${['40x30', '50x30'].map(m => `<button class="b sm seg${c.medida === m ? ' on' : ''}" data-act="etqLiveMedida" data-v="${m}">${m.replace('x', '×')} mm</button>`).join('')}</div>
    <div class="row mt"><button class="b" data-act="etqLiveProbar">🖨️ Imprimir una de prueba</button></div>
    <p class="small muted mt">Para que salga sola, sin la ventana de imprimir: abrí Chrome con un acceso directo que tenga <span class="mono">--kiosk-printing</span> al final y dejá la térmica como impresora predeterminada, con la etiqueta chica. Si no, cada etiqueta te pide confirmar.</p>`;
}
Object.assign(ACT, {
  etqLiveOn: d => { const c = etqLiveCfg(); c.on = d.v === '1'; etqLiveGuardar(c); pintarCfgEtq(); toast(c.on ? '🏷️ Etiqueta al cargar: activada en este equipo' : 'Etiqueta al cargar: apagada'); },
  etqLiveMedida: d => { const c = etqLiveCfg(); c.medida = d.v; etqLiveGuardar(c); pintarCfgEtq(); },
  etqLiveProbar: () => {
    const p = todosPedidos().filter(x => esActivo(x.estado)).slice(-1)[0] || { id: '_', num: 14, codigo: '04225', clienteId: null, liveId: null };
    const pr = { nombre: 'Buzo oversize negro', qty: 1 };
    if (p.id === '_') { const cfgE = etqLiveCfg(), [w, h] = cfgE.medida.split('x'); $('#print-page').textContent = `@page{size:${w}mm ${h}mm;margin:0} #print-area .lv{width:${w}mm;height:${h}mm}`; $('#print-area').innerHTML = etqLiveHTML(p, pr, cfgE.medida).replace('>?<', '>María Fernández<'); setTimeout(() => window.print(), 40); return; }
    ETQ_COLA.push({ id: p.id, pr }); imprimirColaLive();
  }
});
// Versión visible en Config, para saber si el equipo tiene la última
function montarVersion() {
  const cf = document.getElementById('p-config'); if (!cf || document.getElementById('cf-version')) return;
  const d = document.createElement('div'); d.id = 'cf-version'; d.className = 'small muted'; d.style.cssText = 'text-align:center;margin:8px 0 20px';
  d.textContent = 'Versión ' + EMMA_VERSION;
  cf.appendChild(d);
}
montarCfgEtq(); montarVersion();

// ─── Actualizaciones: cuando se publica una versión nueva, el equipo se recarga solo ───
if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
  let _rec = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (_rec) return; _rec = true;
    const intentar = () => { if (typeof pendientes === 'function' && pendientes()) return setTimeout(intentar, 2000); location.reload(); };
    intentar();
  });
}
// Revisa si hay versión nueva al volver a la app y cada 30 minutos
function buscarVersionNueva() { if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistration().then(r => r && r.update()).catch(() => {}); }
document.addEventListener('visibilitychange', () => { if (!document.hidden) buscarVersionNueva(); });
setInterval(buscarVersionNueva, 30 * 60 * 1000);
