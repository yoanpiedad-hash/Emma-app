// node herramientas/prueba-promos.js
const { calcularPedido } = require('../promos.js');
const A = 'mA', B = 'mB', C = 'mC';
const modeloDe = s => ({ sA: A, sB: B, sC: C }[s]);
const hoy = '2026-10-24', liveId = 'L1';
let ok = 0, mal = 0;
const t = (n, c, x) => { c ? ok++ : mal++; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(x))); };
const pr = (s, p, q, extra) => Object.assign({ stockId: s, precio: p, precioLista: p, qty: q || 1 }, extra || {});
// Especial 690 → 590 + live 10% + VIP 5% sobre el resto
let promos = [{ id: 'p1', tipo: 'especial', modo: 'precio', valor: 590, modelos: [A] }];
let r = calcularPedido({ prendas: [pr('sA', 690), pr('sB', 1000)] }, { promos, modeloDe, liveId, hoy, livePct: 10, vipPct: 5 });
t('Precio especial 690→590; live 10% + VIP 5% solo sobre la otra (100 + 50)', r.bruto === 1590 && r.descLive === 100 && r.descVip === 50 && r.total === 1440, r);
// Precio a mano gana
r = calcularPedido({ prendas: [pr('sA', 500, 1, { precioLista: 690 })] }, { promos, modeloDe, liveId, hoy, livePct: 10 });
t('Precio a mano gana: sin promo, con el 10% del live como hoy', r.total === 450 && r.descLive === 50 && !r.promos.length && !r.ahorroEspecial, r);
// Combo 2 por 1200 con 3 prendas: 900, 700, 500 → grupo 900+700 = 1600 → -400; sobrante 500 con live 10%
promos = [{ id: 'c1', tipo: 'combo', n: 2, x: 1200, modelos: [A, B, C] }];
r = calcularPedido({ prendas: [pr('sA', 900), pr('sB', 700), pr('sC', 500)] }, { promos, modeloDe, liveId, hoy, livePct: 10 });
t('Combo 2x$1200: −400 en línea aparte; sobrante con live (−50)', r.promos[0].monto === 400 && r.descLive === 50 && r.total === 1650, r);
// 3x2: 4 prendas 1000,800,600,400 → grupo de 3 (1000,800,600) gratis 600; sobra 400
promos = [{ id: 'n1', tipo: 'nxm', n: 3, m: 2, modelos: [A] }];
r = calcularPedido({ prendas: [pr('sA', 1000), pr('sA', 800), pr('sA', 600), pr('sA', 400)] }, { promos, modeloDe, liveId, hoy });
t('3x2: gratis la más barata del grupo (−600), sobrante a precio normal', r.promos[0].monto === 600 && r.total === 2200, r);
// Cantidad > 1 en una prenda cuenta como unidades
r = calcularPedido({ prendas: [pr('sA', 500, 3)] }, { promos, modeloDe, liveId, hoy });
t('3x2 con qty 3 de la misma prenda: −500', r.promos[0].monto === 500 && r.total === 1000, r);
// Vigencia
promos = [{ id: 'v1', tipo: 'especial', modo: 'pct', valor: 20, modelos: [A], hasta: '2026-10-23' }, { id: 'v2', tipo: 'especial', modo: 'pct', valor: 20, modelos: [B], liveId: 'OTRO' }, { id: 'v3', tipo: 'especial', modo: 'pct', valor: 20, modelos: [C], activa: false }];
r = calcularPedido({ prendas: [pr('sA', 1000), pr('sB', 1000), pr('sC', 1000)] }, { promos, modeloDe, liveId, hoy });
t('Vencida, de otro live o desactivada: no aplican', r.total === 3000, r);
// Una prenda en una sola promo: especial primero, combo no la toma
promos = [{ id: 'e', tipo: 'especial', modo: 'pct', valor: 10, modelos: [A] }, { id: 'c', tipo: 'combo', n: 2, x: 1000, modelos: [A, B] }];
r = calcularPedido({ prendas: [pr('sA', 800), pr('sB', 800), pr('sB', 800)] }, { promos, modeloDe, liveId, hoy });
t('Una prenda en una sola promo (especial gana, combo con las otras 2)', r.ahorroEspecial === 80 && r.promos[0].monto === 600 && r.total === 1720, r);
// Descuento propio del pedido reemplaza al del live; saldo a favor al final
r = calcularPedido({ prendas: [pr('sB', 1000)], descuento: 20, saldoAplicado: 300 }, { promos: [], modeloDe, liveId, hoy, livePct: 10, vipPct: 5 });
t('Descuento del pedido (20%) + VIP 5% y saldo a favor 300', r.descLive === 200 && r.descVip === 50 && r.saldo === 300 && r.total === 450, r);
// Prenda manual sin código
r = calcularPedido({ prendas: [{ stockId: null, nombre: 'Algo', precio: 400, precioLista: 400, qty: 1 }] }, { promos: [], modeloDe, liveId, hoy, livePct: 10 });
t('Prenda sin código: recibe descuento del live', r.descLive === 40 && r.total === 360, r);
console.log(`\n${ok} de ${ok + mal} OK`); process.exit(mal ? 1 : 0);
