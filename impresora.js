'use strict';
/* ══════════════════════════════════════════════════════════════
   EMMA · IMPRESORA DE ESTE EQUIPO (USO-08: una sola configuración)
   La comparten Pedidos y Gestión. Se guarda en el equipo (cada compu tiene su impresora):
   - Envíos: térmica 10×15 o hoja A4.
   - Rollo chico (etiqueta de prenda y etiqueta del live): ancho × alto en mm, o hoja A4 para recortar.
   Etiqueta de prenda: código de 4 cifras grande, código de barras (lee el escáner USB), talle y precio.
   El código de barras lleva "P" adelante (P0001): así el escáner distingue una prenda de un pedido.
   ══════════════════════════════════════════════════════════════ */
const IMP_KEY = 'emma_impresora';
const IMP_MEDIDAS = [[50, 30], [40, 30], [50, 25], [40, 20], [60, 40]];
function impresora() {
  let c = null;
  try { c = JSON.parse(localStorage.getItem(IMP_KEY) || 'null'); } catch (e) { c = null; }
  if (!c) {
    // Primera vez: se arma con lo que había en los 3 lugares viejos
    let chico = [50, 30], a4 = false, envios = 'a4';
    try {
      const r = localStorage.getItem('emma_rollo_chico');
      if (r === 'a4') a4 = true; else if (r === '40x30') chico = [40, 30];
      const l = JSON.parse(localStorage.getItem('emma_etq_live') || 'null');
      if (!r && l && l.medida === '40x30') chico = [40, 30];
    } catch (e) {}
    try { if (typeof DB !== 'undefined' && DB.config && DB.config.formatoImpresion === 'termica') envios = 'termica'; } catch (e) {}
    c = { envios, chicoW: chico[0], chicoH: chico[1], chicoA4: a4 };
  }
  c.chicoW = Math.min(110, Math.max(20, +c.chicoW || 50));
  c.chicoH = Math.min(80, Math.max(12, +c.chicoH || 30));
  c.envios = c.envios === 'termica' ? 'termica' : 'a4';
  c.chicoA4 = !!c.chicoA4;
  return c;
}
function impresoraGuardar(patch) {
  const c = Object.assign(impresora(), patch || {});
  try { localStorage.setItem(IMP_KEY, JSON.stringify(c)); } catch (e) {}
  return impresora();
}
const impEnviosTermica = () => impresora().envios === 'termica';
const impChicoTxt = () => { const c = impresora(); return c.chicoA4 ? 'Hoja A4 para recortar' : `Rollo ${c.chicoW} × ${c.chicoH} mm`; };

/* ── Code 128-B en SVG (sin internet) ── */
const IMP_C128 = ['212222','222122','222221','121223','121322','131222','122213','122312','132212','221213','221312','231212','112232','122132','122231','113222','123122','123221','223211','221132','221231','213212','223112','312131','311222','321122','321221','312212','322112','322211','212123','212321','232121','111323','131123','131321','112313','132113','132311','211313','231113','231311','112133','112331','132131','113123','113321','133121','313121','211331','231131','213113','213311','213131','311123','311321','331121','312113','312311','332111','314111','221411','431111','111224','111422','121124','121421','141122','141221','112214','112412','122114','122411','142112','142211','241211','221114','413111','241112','134111','111242','121142','121241','114212','124112','124211','411212','421112','421211','212141','214121','412121','111143','111341','131141','114113','114311','411113','411311','113141','114131','311141','411131','211412','211214','211232','2331112'];
function code128SVG(text) {
  const vals = [104];
  for (const ch of String(text)) { const v = ch.charCodeAt(0) - 32; vals.push(v >= 0 && v < 96 ? v : 0); }
  let sum = 104;
  for (let i = 1; i < vals.length; i++) sum += vals[i] * i;
  vals.push(sum % 103, 106);
  const pat = vals.map(v => IMP_C128[v]).join(''), q = 10;
  let x = q, rects = '';
  for (let i = 0; i < pat.length; i++) { const w = +pat[i]; if (i % 2 === 0) rects += `<rect x="${x}" y="0" width="${w}" height="40"/>`; x += w; }
  return `<svg viewBox="0 0 ${x + q} 40" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" data-c128="${String(text).replace(/"/g, '')}"><rect width="100%" height="100%" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
}

/* ── Etiqueta chica de prenda ── */
(() => {
  const st = document.createElement('style');
  st.textContent = `
.pch{box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;color:#000;background:#fff;display:flex;flex-direction:column;padding:1.2mm 1.6mm;overflow:hidden;page-break-after:always;break-after:page;line-height:1}
.pch:last-child{page-break-after:auto;break-after:auto}
.pch .r1{display:flex;align-items:center;justify-content:space-between;gap:1mm}
.pch .cd{font-weight:900;letter-spacing:.2mm}
.pch .ta{font-weight:900;border:.45mm solid #000;border-radius:1mm;padding:.2mm 1mm}
.pch .ta.u{font-size:.55em !important;padding:.6mm 1mm}
.pch .bc{flex:1;min-height:0;display:flex;align-items:stretch;margin:.8mm 0}
.pch .bc svg{width:100%;height:100%;display:block}
.pch .pr{font-weight:900;text-align:right}
`;
  document.head.appendChild(st);
})();
/** p: { codigo, talle, precio } → HTML de una etiqueta, del tamaño del rollo de este equipo. */
function etqPrendaChicaHTML(p, c) {
  c = c || impresora();
  const w = c.chicoA4 ? 50 : c.chicoW, h = c.chicoA4 ? 30 : c.chicoH;
  const k = Math.min(w / 50, h / 30);   // todo escala con la etiqueta
  const pt = n => (n * k).toFixed(1) + 'pt';
  const t = String(p.talle || 'U'), u = t === 'U';
  return `<div class="pch" style="width:${w}mm;height:${h}mm">
    <div class="r1"><span class="cd" style="font-size:${pt(17)}">${esc(p.codigo || '')}</span><span class="ta${u ? ' u' : ''}" style="font-size:${pt(16)}">${u ? 'ÚNICO' : esc(t)}</span></div>
    <div class="bc">${code128SVG('P' + (p.codigo || ''))}</div>
    <div class="pr" style="font-size:${pt(13)}">${+p.precio ? fmt(p.precio) : ''}</div>
  </div>`;
}
/** Imprime etiquetas chicas (HTML ya armado) con el tamaño de este equipo. */
function imprimirChicas(html, clase) {
  const c = impresora(), sel = '#print-area .' + (clase || 'pch');
  $('#print-page').textContent = c.chicoA4
    ? `@page{size:A4;margin:8mm} @media print{#print-area{display:grid!important;grid-template-columns:repeat(3,50mm);grid-auto-rows:30mm;gap:2mm}} ${sel}{width:50mm;height:30mm;outline:.2mm dashed #999;page-break-after:auto;break-after:auto;page-break-inside:avoid}`
    : `@page{size:${c.chicoW}mm ${c.chicoH}mm;margin:0} ${sel}{width:${c.chicoW}mm;height:${c.chicoH}mm}`;
  $('#print-area').innerHTML = html;
  setTimeout(() => window.print(), 60);
}

/* ── Tarjeta de Config (la misma en Pedidos y Gestión) ── */
function cfgImpresoraHTML() {
  const c = impresora(), med = `${c.chicoW}x${c.chicoH}`;
  return `<div class="card-t">🖨️ Impresora de este equipo</div>
    <p class="small muted mb">Una sola configuración para todas las etiquetas. Se guarda en este equipo: hacelo en la compu donde está la térmica. Vale para Pedidos y Gestión.</p>
    <div class="small" style="font-weight:700;margin:6px 0 4px">Envíos (etiquetas de pedido, cadetería y agencia)</div>
    <div class="row"><button class="b sm seg${c.envios === 'termica' ? ' on' : ''}" data-act="impEnv" data-v="termica">Térmica 10 × 15</button><button class="b sm seg${c.envios === 'a4' ? ' on' : ''}" data-act="impEnv" data-v="a4">Hoja A4</button></div>
    <div class="small" style="font-weight:700;margin:12px 0 4px">Rollo chico (prendas y etiqueta del live)</div>
    <div class="row">${IMP_MEDIDAS.map(([w, h]) => `<button class="b sm seg${!c.chicoA4 && med === w + 'x' + h ? ' on' : ''}" data-act="impChico" data-w="${w}" data-h="${h}">${w} × ${h}</button>`).join('')}<button class="b sm seg${c.chicoA4 ? ' on' : ''}" data-act="impChicoA4">Hoja A4</button></div>
    <div class="row mt"><span class="small muted">Otra medida (mm):</span><input id="imp-w" class="in-xs" type="number" inputmode="numeric" min="20" max="110" value="${c.chicoW}" style="width:64px"><span>×</span><input id="imp-h" class="in-xs" type="number" inputmode="numeric" min="12" max="80" value="${c.chicoH}" style="width:64px"><button class="b sm" data-act="impChicoOtra">Usar</button></div>
    <div class="row mt"><button class="b" data-act="impProbar">🖨️ Imprimir una de prueba (prenda)</button></div>
    <p class="small muted mt">Ahora: ${esc(impChicoTxt())}. Para que salga sola, sin la ventana de imprimir: abrí Chrome con <span class="mono">--kiosk-printing</span> y dejá la térmica como impresora predeterminada. En la ventana de imprimir: márgenes "Ninguno" y escala 100 %.</p>`;
}
function pintarCfgImpresora() { const el = document.getElementById('cf-impresora'); if (el) el.innerHTML = cfgImpresoraHTML(); }
function impresoraACT() {
  return {
    impEnv: d => { impresoraGuardar({ envios: d.v }); pintarCfgImpresora(); toast(d.v === 'termica' ? '✓ Envíos en térmica 10 × 15' : '✓ Envíos en hoja A4'); },
    impChico: d => { impresoraGuardar({ chicoW: +d.w, chicoH: +d.h, chicoA4: false }); pintarCfgImpresora(); toast('✓ Rollo chico ' + d.w + ' × ' + d.h + ' mm'); },
    impChicoA4: () => { impresoraGuardar({ chicoA4: true }); pintarCfgImpresora(); toast('✓ Etiquetas chicas en hoja A4'); },
    impChicoOtra: () => {
      const w = parseInt(($('#imp-w') || {}).value, 10), h = parseInt(($('#imp-h') || {}).value, 10);
      if (!(w >= 20 && w <= 110 && h >= 12 && h <= 80)) return toast('Medida entre 20 y 110 de ancho y 12 y 80 de alto');
      impresoraGuardar({ chicoW: w, chicoH: h, chicoA4: false }); pintarCfgImpresora(); toast(`✓ Rollo chico ${w} × ${h} mm`);
    },
    impProbar: () => imprimirChicas(etqPrendaChicaHTML({ codigo: '0001', talle: 'M', precio: 990 }))
  };
}
