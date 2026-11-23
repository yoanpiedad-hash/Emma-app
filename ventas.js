'use strict';
/* ══════════════════════════════════════════════════════════════
   EMMA PEDIDOS · VENTAS FUERA DEL VIVO (catálogo web) · 24/11
   Basado en ventas.js de Distrito YF.
   - Los pedidos del catálogo web los crea Mabel (crear_pedido_web) en un registro fijo por mes:
     un "live" con tipo 'ventas' ("Ventas · noviembre 2026", id lventas-AAAA-MM). Nunca en un vivo.
     Cada pedido web trae p.web = { creado, pagarHasta, … }: paga en 2 h, o hasta las 11 si se hizo desde las 21.
   - Acá la app lo reconoce:
     · nunca lo toma como "el live de hoy" (Mostrador, cambios y respaldos siguen en el vivo);
     · en el selector sale como 🛒, sin fecha de pago ni envíos masivos (totales, R1/R2);
     · botón "🛒 Ventas web" en la pestaña Live para ver los pedidos del mes;
     · los pedidos web vencidos salen en ⏳ Para liberar (mabel.js), como los del vivo.
   - La app no crea el registro: lo crea Mabel con el primer pedido web del mes.
   Se carga al final (después de stock.js).
   ══════════════════════════════════════════════════════════════ */
const esVentas = l => !!(l && l.tipo === 'ventas');
const esWeb = p => !!(p && p.web && p.web.pagarHasta);
/** Registro de ventas del mes actual (o null si todavía no hubo pedidos web este mes). */
function ventasDelMes() {
  const ym = hoyISO().slice(0, 7);
  return DB.lives.find(l => esVentas(l) && !l.borrado && l.mes === ym) || null;
}
// El "live de hoy" nunca es el registro de ventas (salvo que en este equipo se haya elegido mirarlo en la pestaña Live)
const _liveActualV = liveActual;
liveActual = function () {
  const l = _liveActualV();
  if (!esVentas(l)) return l;
  const v = UI.tab === 'live' && leerLiveVer();
  if (v && v.id === l.id) return l;
  return [...DB.lives].reverse().find(x => !esVentas(x) && !x.borrado) || l;
};

ACT.verVentasWeb = () => {
  const v = ventasDelMes() || [...DB.lives].reverse().find(esVentas);
  if (!v) return toast('Todavía no hay pedidos del catálogo web');
  guardarLiveVer(v.id); UI.cargaId = null; UI.abiertos.clear();
  setTab('live');
};

// Pestaña Live: selector, cabecera y botón según sea un vivo o el registro de ventas
const _renderLiveV = renderLive;
renderLive = function () {
  _renderLiveV.apply(this, arguments);
  try { pintarCabeceraVentas(liveActual()); } catch (e) { console.warn('ventas', e); }
};
function pintarCabeceraVentas(l) {
  const ve = esVentas(l);
  const sel = document.getElementById('live-sel');
  if (sel) [...sel.options].forEach(op => {
    const x = liveById(op.value); if (!esVentas(x) || op.textContent.startsWith('🛒')) return;
    const sinPagar = (x.pedidos || []).filter(p => p.estado === 'pendiente' && !pagado(p)).length;
    op.textContent = `🛒 ${x.nombre} (catálogo web) · ${(x.pedidos || []).length} pedidos${sinPagar ? ' · ' + sinPagar + ' sin pagar' : ''}`;
  });
  // Botón para ir a las ventas web del mes (cuando se está en un vivo)
  const nuevo = document.querySelector('#p-live [data-act="nuevoLive"]');
  let btn = document.getElementById('btn-ventas-web');
  const v = ventasDelMes();
  if (!ve && v && nuevo) {
    if (!btn) { btn = document.createElement('button'); btn.id = 'btn-ventas-web'; btn.className = 'b'; btn.dataset.act = 'verVentasWeb'; nuevo.insertAdjacentElement('afterend', btn); }
    const n = (v.pedidos || []).filter(p => p.estado === 'pendiente' && !pagado(p)).length;
    btn.textContent = '🛒 Ventas web' + (n ? ' · ' + n + ' sin pagar' : '');
  } else if (btn) btn.remove();
  // Aviso de "estás mirando otro live": en el registro de ventas se explica qué es
  const av = document.getElementById('live-ver-aviso');
  if (av && ve) {
    const h = `<div class="av az mt"><span class="grow">🛒 <b>${esc(l.nombre)}</b>: pedidos del catálogo web (los carga Mabel). Pagan en 2 h, o hasta las 11 si los hicieron desde las 21. Los vencidos aparecen en ⏳ Para liberar.</span><button class="b sm pri" data-act="volverLiveHoy">Volver al vivo</button></div>`;
    if (av.innerHTML !== h) av.innerHTML = h;
  }
  // En el registro de ventas no hay fecha de pago del live ni envíos masivos (cada pedido web tiene su plazo)
  for (const id of ['live-tot-bar', 'live-rec-bar', 'live-fp-box']) { const x = document.getElementById(id); if (x) x.hidden = ve; }
  const fp = document.getElementById('live-fpago'), fpLb = fp && fp.previousElementSibling;
  if (fpLb) fpLb.hidden = ve;
  const desc = document.getElementById('live-desc'), dLb = desc && desc.previousElementSibling;
  if (dLb) dLb.textContent = ve ? '🎉 Descuento general del mes, pedidos web (%)' : '🎉 Descuento general del live (%)';
}
