'use strict';
/* ══════════════════════════════════════════════════════════════
   EMMA PEDIDOS · PARTE 3: stock y etiquetas
   - Pedido pagado o enviado: sumar, sacar o cambiar prendas muestra cuánto cambia el total y pide confirmar (PLA-02).
   - El "−" que saca la última unidad de una prenda pide confirmar (USO-10).
   - Código de prenda de 4 cifras (0001): tipearlo o escanearlo (P0001) carga esa prenda directo.
   - Tarjeta 🖨️ Impresora de este equipo en Config (USO-08).
   Se carga último (reemplaza funciones sin tocar los archivos de antes).
   ══════════════════════════════════════════════════════════════ */

// ─── Pedidos ya cobrados (PLA-02, versión simple) ─────────────
const yaCobrado = p => !!p && (p.estado === 'enviado' || (typeof pagado === 'function' && pagado(p)));
/** Muestra cómo queda el total si se hace el cambio y pide confirmar. Devuelve true si se puede seguir. */
function confirmarSiCobrado(p, aplicar, que) {
  if (!yaCobrado(p)) return true;
  let antes = 0, despues = 0;
  try {
    antes = calc(p).total;
    const copia = JSON.parse(JSON.stringify(p)); aplicar(copia);
    despues = calc(copia).total;
  } catch (e) { console.warn(e); }
  const dif = despues - antes;
  return confirm(`⚠️ El pedido #${p.num} ya está ${p.estado === 'enviado' ? 'ENVIADO' : 'PAGADO'}.\n\n${que}\n\nTotal: ${fmt(antes)} → ${fmt(despues)}\n${dif > 0 ? `Hay que cobrarle ${fmt(dif)} más.` : dif < 0 ? `Le quedan ${fmt(-dif)} a favor (devolver o dejar de saldo).` : 'El total no cambia.'}\n\n¿Seguir igual?`);
}
const nomPr = pr => (pr && (pr.nombre || pr.codigo)) || 'la prenda';
const _actQty = ACT.qty, _actDelPrenda = ACT.delPrenda;
ACT.qty = d => {
  const p = pedById(d.id), i = +d.i, delta = +d.d, pr = p && p.prendas[i];
  if (!pr) return;
  const nueva = (pr.qty || 1) + delta;
  if (nueva <= 0 && !yaCobrado(p) && !confirm(`¿Sacar ${nomPr(pr)} del pedido #${p.num}?`)) return;   // USO-10
  const que = nueva <= 0 ? `Sacás ${nomPr(pr)} del pedido.` : delta > 0 ? `Sumás 1 ${nomPr(pr)} (quedan ${nueva}).` : `Sacás 1 ${nomPr(pr)} (quedan ${nueva}).`;
  if (!confirmarSiCobrado(p, c => { if (nueva <= 0) c.prendas.splice(i, 1); else c.prendas[i].qty = nueva; }, que)) return;
  _actQty(d);
};
ACT.delPrenda = d => {
  const p = pedById(d.id), i = +d.i, pr = p && p.prendas[i];
  if (!pr) return;
  if (!confirmarSiCobrado(p, c => c.prendas.splice(i, 1), `Sacás ${nomPr(pr)} del pedido.`)) return;
  _actDelPrenda(d);
};
const _agregarPrendaP3 = agregarPrenda;
agregarPrenda = function (p, pr) {
  if (!confirmarSiCobrado(p, c => c.prendas.push(Object.assign({}, pr)), `Sumás ${nomPr(pr)}${pr.qty > 1 ? ' x' + pr.qty : ''}.`)) { toast('No se sumó la prenda'); return false; }
  return _agregarPrendaP3(p, pr);
};

// ─── Código de prenda de 4 cifras ─────────────────────────────
/** "0001", "P0001" (escáner) o el código viejo ("142-M", "P142-M") → la fila de stock. */
varPorCodigo = function (txt) {
  const q = String(txt || '').trim().replace(/^P(?=\d)/i, '').toUpperCase();
  if (!q) return null;
  const ok = s => String(s.codigo || '').toUpperCase() === q || String(s.codigoViejo || '').toUpperCase() === q;
  return stockActivo().find(ok) || null;
};
// Tipear un código de prenda de 4 cifras no abre los talles del modelo con ese número
const _qlInputP3 = qlInput;
qlInput = function (px) {
  const q = ($('#' + px + '-txt') || {}).value || '';
  if (/^\d{4}$/.test(q.trim()) && varPorCodigo(q)) { QL[px].q = q.trim(); return _qlInput(px); }
  return _qlInputP3(px);
};

// ─── Config: impresora de este equipo ─────────────────────────
Object.assign(ACT, impresoraACT());
(function montarCfgImpresora() {
  const panel = document.getElementById('p-config'); if (!panel || document.getElementById('cf-impresora')) return;
  const card = document.createElement('div'); card.className = 'card'; card.id = 'cf-impresora';
  panel.insertBefore(card, panel.firstChild);
  pintarCfgImpresora();
})();
