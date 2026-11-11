'use strict';
/* ══════════════════════════════════════════════════════════════
   EMMA · CÁLCULO DEL PEDIDO CON PROMOCIONES Y VIP (lo usan Gestión y Pedidos)
   Orden (acordado 24/10):
   1. Precio de cada prenda: lista, precio especial de promo, o precio a mano (gana y queda fuera de promos).
   2. Combos "N por $X" y NxM sobre las prendas elegibles → una línea aparte "🎁".
   3. Descuento del live + VIP, sumados, solo sobre prendas sin promo.
   4. Saldo a favor.
   Una prenda entra en una sola promo. Funciones puras: no tocan la base.
   ══════════════════════════════════════════════════════════════ */
const PROMO_TIPOS = { especial: 'Precio especial', combo: 'Combo N por $X', nxm: 'Lleva N, paga M' };

/** ¿La promo vale hoy (y para este live, si es "solo este live")? hoy = 'AAAA-MM-DD'. */
function promoVigente(p, liveId, hoy) {
  if (!p || p.activa === false || p.borrado) return false;
  if (p.liveId && p.liveId !== liveId) return false;
  if (p.desde && hoy < p.desde) return false;
  if (p.hasta && hoy > p.hasta) return false;
  return true;
}
/** Texto corto de la promo: "20% off", "$590", "2 por $1.200", "3x2". */
function promoTxt(p) {
  const $ = n => '$' + Math.round(+n || 0).toLocaleString('es-UY');
  if (p.tipo === 'especial') return p.modo === 'pct' ? `${+p.valor}% off` : `a ${$(p.valor)}`;
  if (p.tipo === 'combo') return `${+p.n} por ${$(p.x)}`;
  if (p.tipo === 'nxm') return `${+p.n}x${+p.m}`;
  return '';
}
/** Prenda con precio cambiado a mano: no entra en promos (sí lleva el descuento del live, como hoy). */
const esManual = pr => !!pr.manual || (pr.precioLista != null && +pr.precio !== +pr.precioLista && !pr.promoId);

/**
 * pedido: { prendas: [{ stockId, precio, precioLista, qty, manual? }], descuento?, saldoAplicado? }
 * ctx: { promos, modeloDe(stockId) → modeloId, liveId, hoy, livePct, vipPct }
 * Devuelve: { lista, bruto, unidades:[{ i, precio, promoId }], promos:[{ id, nombre, txt, monto }], ahorroEspecial,
 *             baseDesc, descLive, descVip, sub, saldo, total, art }
 */
function calcularPedido(pedido, ctx) {
  const promos = (ctx.promos || []).filter(p => promoVigente(p, ctx.liveId, ctx.hoy));
  const de = (p) => new Set(p.modelos || []);
  const U = [];
  (pedido.prendas || []).forEach((pr, i) => {
    const q = Math.max(1, +pr.qty || 1), lista = +(pr.precioLista ?? pr.precio) || 0, manual = esManual(pr);
    const mid = pr.stockId && ctx.modeloDe ? ctx.modeloDe(pr.stockId) : null;
    for (let k = 0; k < q; k++) U.push({ i, mid, lista, precio: manual ? +pr.precio || 0 : lista, manual, promoId: null });
  });
  const res = { promos: [], ahorroEspecial: 0 };
  // 1. Precio especial
  for (const p of promos.filter(p => p.tipo === 'especial')) {
    const set = de(p);
    for (const u of U) if (!u.manual && !u.promoId && u.mid && set.has(u.mid)) {
      const nuevo = p.modo === 'pct' ? Math.round(u.lista * (1 - (+p.valor || 0) / 100)) : Math.round(+p.valor || 0);
      if (nuevo < u.lista) { res.ahorroEspecial += u.lista - nuevo; u.precio = nuevo; u.promoId = p.id; }
    }
  }
  // 2. Combos y NxM (de más cara a más barata, grupos de N; sobrantes a precio normal)
  for (const p of promos.filter(p => p.tipo === 'combo' || p.tipo === 'nxm')) {
    const set = de(p), n = Math.max(1, +p.n || 0);
    const el = U.filter(u => !u.manual && !u.promoId && u.mid && set.has(u.mid)).sort((a, b) => b.precio - a.precio);
    let monto = 0;
    for (let g = 0; g + n <= el.length; g += n) {
      const grupo = el.slice(g, g + n), suma = grupo.reduce((s, u) => s + u.precio, 0);
      let d = 0;
      if (p.tipo === 'combo') d = Math.max(0, suma - Math.round(+p.x || 0));
      else { const gratis = Math.max(0, n - Math.max(0, +p.m || 0)); d = grupo.slice(n - gratis).reduce((s, u) => s + u.precio, 0); }
      if (d > 0) { monto += d; grupo.forEach(u => { u.promoId = p.id; }); }
    }
    if (monto > 0) res.promos.push({ id: p.id, nombre: p.nombre || PROMO_TIPOS[p.tipo], txt: promoTxt(p), monto });
  }
  // 3. Live + VIP, solo sobre prendas sin promo
  const livePct = (pedido.descuento !== null && pedido.descuento !== undefined && pedido.descuento !== '') ? +pedido.descuento : (+ctx.livePct || 0);
  const vipPct = +ctx.vipPct || 0;
  res.lista = U.reduce((s, u) => s + u.lista, 0);
  res.bruto = U.reduce((s, u) => s + u.precio, 0);
  res.baseDesc = U.filter(u => !u.promoId).reduce((s, u) => s + u.precio, 0);   // el precio a mano sí lleva descuento del live (como hoy)
  res.livePct = livePct; res.vipPct = vipPct;
  res.descLive = Math.round(res.baseDesc * livePct / 100);
  res.descVip = Math.round(res.baseDesc * vipPct / 100);
  const descPromos = res.promos.reduce((s, x) => s + x.monto, 0);
  res.sub = Math.max(0, res.bruto - descPromos - res.descLive - res.descVip);
  // 4. Saldo a favor
  res.saldo = Math.min(+pedido.saldoAplicado || 0, res.sub);
  res.total = res.sub - res.saldo;
  res.art = U.length;
  res.unidades = U.map(u => ({ i: u.i, precio: u.precio, promoId: u.promoId }));
  res.descPromos = descPromos;
  return res;
}
/**
 * Desglose para explicarle el total a la clienta: las prendas agrupadas por combo (con lo que queda el grupo) y las que van sueltas.
 * res = calcularPedido(pedido, ctx). Devuelve { grupos:[{ id, txt, veces, items:[{ i, q }], antes, queda }], sueltas:[{ i, q, tot, lista }] }.
 */
function desglosePedido(pedido, res) {
  const prendas = pedido.prendas || [], G = new Map(), S = new Map();
  (res.promos || []).forEach(x => G.set(x.id, { id: x.id, txt: x.txt, monto: x.monto, n: 0, items: new Map(), antes: 0 }));
  for (const u of res.unidades || []) {
    const g = u.promoId && G.get(u.promoId);
    if (g) { g.n++; g.antes += u.precio; g.items.set(u.i, (g.items.get(u.i) || 0) + 1); }
    else { const s = S.get(u.i) || { i: u.i, q: 0, tot: 0 }; s.q++; s.tot += u.precio; S.set(u.i, s); }
  }
  const nDe = id => { const m = /^(\d+)/.exec(String((G.get(id) || {}).txt || '')); return m ? +m[1] : 0; };
  const grupos = [...G.values()].filter(g => g.n > 0).map(g => ({ id: g.id, txt: g.txt, veces: nDe(g.id) ? Math.max(1, Math.round(g.n / nDe(g.id))) : 1,
    items: [...g.items].map(([i, q]) => ({ i, q })).sort((a, b) => a.i - b.i), antes: g.antes, queda: g.antes - g.monto }));
  const sueltas = [...S.values()].sort((a, b) => a.i - b.i).map(s => { const pr = prendas[s.i] || {}; return { ...s, lista: (+(pr.precioLista ?? pr.precio) || 0) * s.q }; });
  return { grupos, sueltas };
}
if (typeof module !== 'undefined') module.exports = { calcularPedido, desglosePedido, promoVigente, promoTxt, esManual, PROMO_TIPOS };
