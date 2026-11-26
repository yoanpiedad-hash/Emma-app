import { AsyncLocalStorage } from 'node:async_hooks';
// Herramientas de Mabel. Replican la lógica de la app (despacho.js, mabel.js, index.html) sobre la base.
// Regla de seguridad: ninguna herramienta recibe teléfono ni id de clienta del modelo. Siempre usan ctx (el número que escribió).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { BARRIOS_GRISAL } from './barrios.ts';
import { fechaVivo } from './vivo.ts';

export const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

const TZ = 'America/Montevideo';
export const hoyUY = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
export const ahoraTxtUY = () => new Intl.DateTimeFormat('es-UY', { timeZone: TZ, weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date());
let _n = 0;
export const uid = (p: string) => p + Date.now().toString(36) + (_n++).toString(36) + Math.random().toString(36).slice(2, 5);
export const telKeyDe = (s: string) => String(s || '').replace(/\D/g, '').slice(-8);
const normB = (t: string) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const BARRIOS = (() => { const m = new Map<string, string>(); BARRIOS_GRISAL.forEach((b) => { if (!m.has(normB(b))) m.set(normB(b), b); }); return m; })();
const barrioCanon = (v: string) => BARRIOS.get(normB(v)) || '';
/** Barrios de la lista que contienen lo que escribió la clienta (ej. "Jardines" → Jardines del Hipódromo, Jardines de Carrasco). */
const barrioOpciones = (v: string) => {
  const n = normB(v); if (n.length < 3) return [] as string[];
  const vistos = new Set<string>(), out: string[] = [];
  const todos = [...BARRIOS.values()].sort((a, b) => a.length - b.length);
  for (const b of todos) {
    const parte = b.split('/').map((x) => x.trim()).find((x) => normB(x).includes(n));
    if (!parte) continue;
    const clave = normB(parte).replace(/s$/, '');
    if (!vistos.has(clave)) { vistos.add(clave); out.push(parte); }
  }
  return out.slice(0, 6);
};
const CUENTAS_DEF = ['BROU', 'Mi Dinero', 'OCA', 'Mercado Pago', 'Efectivo'];
// 20/11 (Tanda E, decisión del 13/11): cuentas que se aceptan para marcar pagos pero nunca se ofrecen (no están en el mensaje de totales).
const CUENTAS_SOLO_MARCAR = ['PREX YOAN'];
// 26/11 (caso #24): cuentas que ya no se usan para cobrar. config.cuentasRetiradas = [{ nombre, claves: [número de cuenta, apellido], frase? }]
// (los números viven SOLO en la base: el repo es público). Sin la clave en Config vale "Prex vieja": cualquier destino Prex que no sea PREX YOAN.
const CUENTAS_RETIRADAS_DEF = [{ nombre: 'Prex vieja', claves: [] as string[], prex: true }];
export const FRASE_PREX_VIEJA = 'Bella, esa cuenta Prex ya no la estamos usando para cobrar. Le paso tu comprobante a Yanaina para que se fije si llegó 🫶';
export function cuentaRetirada(cfg: any, a: any): { nombre: string; frase: string } | null {
  const lista: any[] = Array.isArray(cfg?.cuentasRetiradas) && cfg.cuentasRetiradas.length ? [...cfg.cuentasRetiradas, ...CUENTAS_RETIRADAS_DEF] : CUENTAS_RETIRADAS_DEF;
  const txt = normB([a?.destino, a?.titular_destino, a?.banco, a?.cuenta].filter(Boolean).join(' ')), dig = txt.replace(/\D/g, '');
  for (const r of lista) {
    const claves = (Array.isArray(r?.claves) ? r.claves : []).map((k: any) => String(k || '').trim()).filter(Boolean);
    const hit = claves.some((k: string) => { const kd = k.replace(/\D/g, ''); return kd.length >= 4 && kd.length >= k.replace(/[\s.\-]/g, '').length - 1 ? dig.includes(kd) : normB(k).length >= 3 && txt.includes(normB(k)); })
      || (r?.prex === true && /\bprex\b/.test(txt) && !/yoan/.test(txt));
    if (hit) { const nombre = String(r.nombre || 'Cuenta vieja'); return { nombre, frase: String(r.frase || '') || (/prex/i.test(nombre) ? FRASE_PREX_VIEJA : 'Bella, esa cuenta ya no la estamos usando para cobrar. Le paso tu comprobante a Yanaina para que se fije si llegó 🫶') }; }
  }
  return null;
}
const medioDe = (c: string) => /mercado\s*pago/i.test(c || '') ? 'mercadopago' : /efectivo|d[eé]bito|cr[eé]dito/i.test(c || '') ? 'efectivo' : 'transferencia';
const esHabitual = (a: string) => /^(dac|nu[nñ]ez|correo)/.test(normB(a));

export type Ctx = { telKey: string; wa: string; clienta: any | null; clientas: any[]; media: { path: string; sha256: string; mime: string } | null; llamadas: string[]; derivado?: boolean; inicio?: string; repaso?: boolean; anteriores?: boolean; ausente?: boolean; vivo?: boolean; sinPase?: boolean; paseSinAviso?: boolean };

// ─── Config ───────────────────────────────────────────────────────
// 19/11 (banco de casos): solo el modo prueba (x-mabel-test) pone cfgPrueba, para simular Config sin tocar la real.
// Va por pedido (AsyncLocalStorage): dos pruebas al mismo tiempo no se pisan y la atención real nunca la ve.
const ALS_PRUEBA = new AsyncLocalStorage<Record<string, any> | null>();
export const conCfgPrueba = <T>(c: Record<string, any> | null, f: () => Promise<T>) => ALS_PRUEBA.run(c, f);
export async function leerConfig(): Promise<Record<string, any>> {
  const { data } = await sb.from('config').select('clave,valor');
  const o: Record<string, any> = {};
  for (const r of data || []) o[r.clave] = r.valor;
  const cfgPrueba = ALS_PRUEBA.getStore();
  if (cfgPrueba) for (const k in cfgPrueba) { if (cfgPrueba[k] === null) delete o[k]; else o[k] = cfgPrueba[k]; }
  return o;
}
const num = (v: any, d = 0) => { const n = +v; return Number.isFinite(n) ? n : d; };
export const tarifaDe = (c: any) => num(c.tarifaEnvio, 250) || 250;
export const mpDe = (c: any) => (c.mpRecargo === undefined || c.mpRecargo === null || c.mpRecargo === '') ? 10 : Math.max(0, num(c.mpRecargo, 10));
const cuentasDe = (c: any): string[] => Array.isArray(c.cuentasPago) && c.cuentasPago.length ? c.cuentasPago : CUENTAS_DEF;
export const novedadesVigentes = (c: any) => { const n = c.novedadesHoy; return n && n.texto && (!n.vence || n.vence >= hoyUY()) ? n : null; };

// ─── Reglas de la app ───────────────────────────────────────────
const pagado = (p: any) => !!p.cambio || !!p.pago || p.estado === 'listo';
// 21/11 (MAI-08): la fecha desde la que atiende Mabel ya no está fija en el código. Sale de Config (clave mabelInicio, AAAA-MM-DD).
// Sin la clave vale el 4/11 (activación). Con mabelInicio = "" (o null) la regla de pedidos anteriores se apaga (por ejemplo, después del reinicio).
const INICIO_MABEL_DEF = '2026-11-04';
const inicioMabel = (cfg: Record<string, any>) => { const v = cfg?.mabelInicio; if (v === '' || v === null || v === false) return ''; return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : INICIO_MABEL_DEF; };
const esAnteriorAMabel = (r: any, live: any, cfg: Record<string, any>) => { const ini = inicioMabel(cfg); return !!ini && !!live?.fecha && String(live.fecha).slice(0, 10) < ini && !pagado(r.datos) && r.datos.estado === 'pendiente'; };
const entregaEf = (p: any, cli: any) => (p.entrega && p.entrega !== 'sin_definir') ? p.entrega : (cli && cli.datos?.agencia ? 'agencia' : (p.entrega || 'sin_definir'));
// Stock → modelo, para las promos del pedido. Se llena con cargarModelos(filas) antes de calcular (10/11).
const MODELO_DE = new Map<string, string>();
async function cargarModelos(filas: any[]) {
  const ids = new Set<string>();
  for (const r of filas || []) { const p = r?.datos; if (!p || !(p.promoCalc?.promos || []).length) continue; for (const pr of p.prendas || []) if (pr.stockId && !MODELO_DE.has(pr.stockId)) ids.add(pr.stockId); }
  if (!ids.size) return;
  const { data } = await sb.from('stock').select('id,datos').in('id', [...ids]);
  for (const s of data || []) MODELO_DE.set(s.id, s.datos?.modeloId || '');
}
// 10/11: mismo cálculo que la app (promos.js calcularPedido): precio especial, combos N por $X y NxM con las promos guardadas en el pedido
// (promoCalc), descuento del live + VIP solo sobre prendas sin promo, y saldo a favor. Antes no contaba las promos y el total salía de más.
export function calcPedido(p: any, live: any, modeloDe: (id: string) => string | null | undefined = (id) => MODELO_DE.get(id)): { total: number; detalle: string[] } {
  const s = p.promoCalc || {}, hoy = s.fecha || hoyUY();
  const promos = (s.promos || []).filter((x: any) => x && x.activa !== false && !x.borrado && !(x.liveId && x.liveId !== p.liveId) && !(x.desde && hoy < x.desde) && !(x.hasta && hoy > x.hasta));
  const U: any[] = [];
  for (const pr of p.prendas || []) {
    const q = Math.max(1, +pr.qty || 1), lista = +(pr.precioLista ?? pr.precio) || 0;
    const manual = !!pr.manual || (pr.precioLista != null && +pr.precio !== +pr.precioLista && !pr.promoId);
    const mid = pr.stockId ? (modeloDe(pr.stockId) || null) : null;
    for (let k = 0; k < q; k++) U.push({ i: (p.prendas || []).indexOf(pr), mid, lista, precio: manual ? +pr.precio || 0 : lista, manual, promoId: null });
  }
  let descPromos = 0;
  const combos: { id: string; txt: string; monto: number }[] = [];
  for (const x of promos.filter((x: any) => x.tipo === 'especial')) {
    const set = new Set(x.modelos || []);
    for (const u of U) if (!u.manual && !u.promoId && u.mid && set.has(u.mid)) {
      const nuevo = x.modo === 'pct' ? Math.round(u.lista * (1 - (+x.valor || 0) / 100)) : Math.round(+x.valor || 0);
      if (nuevo < u.lista) { u.precio = nuevo; u.promoId = x.id; }
    }
  }
  for (const x of promos.filter((x: any) => x.tipo === 'combo' || x.tipo === 'nxm')) {
    const set = new Set(x.modelos || []), n = Math.max(1, +x.n || 0);
    const el = U.filter((u) => !u.manual && !u.promoId && u.mid && set.has(u.mid)).sort((a, b) => b.precio - a.precio);
    let monto = 0;
    for (let g = 0; g + n <= el.length; g += n) {
      const grupo = el.slice(g, g + n), suma = grupo.reduce((t, u) => t + u.precio, 0);
      let d = 0;
      if (x.tipo === 'combo') d = Math.max(0, suma - Math.round(+x.x || 0));
      else { const gratis = Math.max(0, n - Math.max(0, +x.m || 0)); d = grupo.slice(n - gratis).reduce((t, u) => t + u.precio, 0); }
      if (d > 0) { descPromos += d; monto += d; grupo.forEach((u) => { u.promoId = x.id; }); }
    }
    if (monto > 0) combos.push({ id: x.id, txt: x.tipo === 'combo' ? `${+x.n} por ${plata(x.x)}` : `${+x.n}x${+x.m}`, monto });
  }
  const livePct = (p.descuento !== null && p.descuento !== undefined && p.descuento !== '') ? +p.descuento : (+(live?.datos?.descuento) || 0);
  const vipPct = +s.vipPct || 0;
  const bruto = U.reduce((t, u) => t + u.precio, 0), baseDesc = U.filter((u) => !u.promoId).reduce((t, u) => t + u.precio, 0);
  const sub = Math.max(0, bruto - descPromos - Math.round(baseDesc * livePct / 100) - Math.round(baseDesc * vipPct / 100));
  // Desglose en palabras, para explicarle el total a la clienta (11/11)
  const nom = (i: number, q: number) => `${(p.prendas || [])[i]?.nombre || 'prenda'}${q > 1 ? ' x' + q : ''}`;
  const cuenta = (us: any[]) => { const m = new Map<number, number>(); us.forEach((u) => m.set(u.i, (m.get(u.i) || 0) + 1)); return [...m].sort((a, b) => a[0] - b[0]); };
  const detalle: string[] = [];
  for (const k of combos) { const us = U.filter((u) => u.promoId === k.id), antes = us.reduce((t, u) => t + u.precio, 0); detalle.push(`Promo ${k.txt}: ${cuenta(us).map(([i, q]) => nom(i, q)).join(' + ')} → le queda en ${plata(antes - k.monto)} (sin promo serían ${plata(antes)})`); }
  const ids = new Set(combos.map((k) => k.id)), fuera = U.filter((u) => !u.promoId || !ids.has(u.promoId));
  for (const [i, q] of cuenta(fuera)) detalle.push(`${combos.length ? 'Fuera de promo: ' : ''}${nom(i, q)}: ${plata(fuera.filter((u) => u.i === i).reduce((t, u) => t + u.precio, 0))}`);
  if (livePct && baseDesc) detalle.push(`Descuento del live ${livePct}%: -${plata(Math.round(baseDesc * livePct / 100))}`);
  if (vipPct && baseDesc) detalle.push(`Descuento VIP ${vipPct}%: -${plata(Math.round(baseDesc * vipPct / 100))}`);
  const saldo = Math.min(+p.saldoAplicado || 0, sub);
  if (saldo) detalle.push(`Saldo a favor: -${plata(saldo)}`);
  return { total: sub - saldo, detalle };
}
const plata = (n: any) => '$' + Math.round(+n || 0).toLocaleString('es-UY');
export function calcTotal(p: any, live: any, modeloDe: (id: string) => string | null | undefined = (id) => MODELO_DE.get(id)): number { return calcPedido(p, live, modeloDe).total; }
function esperadoDe(base: number, env: number, cuenta: string, mp: number) {
  const rec = medioDe(cuenta) === 'mercadopago' ? Math.round((base + env) * mp / 100) : 0;
  return { base, env, rec, total: base + env + rec };
}
function estadoPago(p: any, cli: any): string {
  if (pagado(p)) return 'pagado';
  if (p.estado === 'guardado' && p.guardadoSinPagar) return 'guardado_sin_pagar';
  if (p.pagaAlRetirar && entregaEf(p, cli) === 'retiro') return 'al_retirar';
  return 'pendiente';
}
const porCreado = (a: any, b: any) => (a.datos.fechas?.creado || '').localeCompare(b.datos.fechas?.creado || '') || (a.datos.num - b.datos.num);

// ─── Lectura ──────────────────────────────────────────────────────
export async function cargarClienta(ctx: Ctx) {
  const { data } = await sb.from('clientas').select('*').eq('tel_key', ctx.telKey).eq('borrado', false).order('actualizado', { ascending: false });
  ctx.clientas = data || [];
  ctx.clienta = ctx.clientas[0] || null;
}
async function abiertos(ctx: Ctx) {
  const ids = ctx.clientas.map((c) => c.id);
  if (!ids.length) return { filas: [] as any[], lives: new Map<string, any>(), cobros: [] as any[] };
  const { data } = await sb.from('pedidos').select('*').in('clienta_id', ids).eq('borrado', false).in('estado', ['pendiente', 'listo', 'guardado']);
  const filas = (data || []).filter((r) => !r.datos?.cambio).sort(porCreado);
  await cargarModelos(filas);
  const lids = [...new Set(filas.map((r) => r.live_id))];
  const lives = new Map<string, any>();
  if (lids.length) { const { data: ls } = await sb.from('lives').select('id,nombre,fecha,datos').in('id', lids); (ls || []).forEach((l) => lives.set(l.id, l)); }
  const { data: cb } = await sb.from('cobros').select('*').eq('borrado', false).filter('datos->>estado', 'eq', 'abierto');
  const cobros = (cb || []).filter((k) => ids.includes(k.datos?.clienteId));
  return { filas, lives, cobros };
}

export async function buscarPedido(ctx: Ctx) {
  const cfg = await leerConfig();
  await cargarClienta(ctx);
  const c = ctx.clienta;
  const { filas, lives, cobros } = await abiertos(ctx);
  const tar = tarifaDe(cfg), mp = mpDe(cfg);
  // 5/11: pedidos de lives anteriores a la activación de Mabel (Config mabelInicio, por defecto 4/11) que figuran sin pagar: puede ser que estén pagados y no marcados. No se piden comprobantes: se busca en el historial y, si no se puede confirmar, queda para Yanaina en silencio.
  const anteriores = new Set<string>();
  const evidencia: Record<string, any> = {};
  for (const r of filas) {
    const live0 = lives.get(r.live_id);
    if (esAnteriorAMabel(r, live0, cfg)) {
      anteriores.add(r.id);
      try {
        const { data: tot } = await sb.from('mabel_historial').select('fecha').eq('tel_key', ctx.telKey).eq('de', 'equipo').ilike('texto', `%pedido #${r.datos.num}%`).gte('fecha', String(live0.fecha)).order('fecha', { ascending: false }).limit(1);
        const f0 = tot?.[0]?.fecha || String(live0.fecha);
        const { data: cp } = await sb.from('mabel_historial').select('fecha,tipo').eq('tel_key', ctx.telKey).eq('de', 'clienta').in('tipo', ['media_placeholder', 'image', 'document']).gt('fecha', f0).order('fecha').limit(5);
        evidencia[r.id] = { total_enviado_el: tot?.[0]?.fecha || null, archivos_de_la_clienta_despues_del_total: (cp || []).map((x: any) => x.fecha) };
      } catch (_) { /* sin indicio */ }
    }
  }
  const pedidos = filas.map((r) => {
    const p = r.datos, live = lives.get(r.live_id);
    const { total, detalle } = calcPedido(p, live);
    return {
      ...(anteriores.has(r.id) ? { anterior_a_mabel_sin_marcar_pago: true, indicio_en_historial: evidencia[r.id] || null, aviso: 'NO le pidas comprobante de este pedido y no le digas que lo debe: puede estar pagado y sin marcar. Si hace falta, pasalo a Yanaina en silencio.' } : {}),
      numero: p.num, live: live?.nombre || '', fecha_live: live?.fecha || null, plazo_para_pagar_hasta: live?.datos?.fechaPagoISO || null, ...(pagado(p) && p.estado !== 'enviado' && p.pago?.fecha ? { pagado_el: p.pago.fecha, salida_prevista: salidaPrevista(entregaEf(p, c), c?.datos?.agencia || '', p.pago.fecha, cfg) } : {}), total, detalle_del_total: detalle, estado: p.estado, estado_pago: estadoPago(p, c),
      entrega: (p.entrega && p.entrega !== 'sin_definir') ? p.entrega : 'sin_definir', confirmado: !!p.confirmado, // 26/11 (caso #17): sin suponer agencia por la ficha guardado_sin_pagar_hasta: p.guardadoSinPagar?.hasta || null, paga_al_retirar: !!p.pagaAlRetirar, ...(p.horarioEnvio ? { horario_de_este_envio: p.horarioEnvio } : {}),
      cadeteria_cobra_el_cadete: p.entrega === 'cadeteria' ? (p.cobroEnvio === 'pago' ? 0 : p.cobroEnvio === 'monto' ? (+p.cobroMonto || 0) : tar) : null,
      en_cobro_agrupado: cobros.find((k) => (k.datos.pedidos || []).includes(r.id))?.id || null,
    };
  });
  const sinPagar = filas.filter((r) => !pagado(r.datos) && r.datos.estado === 'pendiente' && !anteriores.has(r.id));
  let a_transferir: any = null;
  const kab = cobros[0];
  const baseDe = (rs: any[]) => rs.reduce((s, r) => s + calcTotal(r.datos, lives.get(r.live_id)), 0);
  if (kab) {
    const rs = filas.filter((r) => (kab.datos.pedidos || []).includes(r.id) && !pagado(r.datos)); const env = +kab.datos.envio || 0;
    a_transferir = { cobro_agrupado: true, pedidos: rs.map((r) => r.datos.num), transferencia: esperadoDe(baseDe(rs), env, 'BROU', mp).total, mercado_pago: esperadoDe(baseDe(rs), env, 'Mercado Pago', mp).total, incluye_envio_cadeteria: env };
  } else if (sinPagar.length === 1) {
    const b = baseDe(sinPagar);
    a_transferir = { pedidos: [sinPagar[0].datos.num], transferencia: b, transferencia_con_cadeteria: b + tar, mercado_pago: esperadoDe(b, 0, 'Mercado Pago', mp).total, mercado_pago_con_cadeteria: esperadoDe(b, tar, 'Mercado Pago', mp).total };
  }
  // 5/11: para cambios — pedidos ya enviados/entregados en los últimos 21 días, con los días que pasaron desde que salieron
  let enviados_recientes: any[] = [];
  let como_la_otra_vez: any = null, como_la_otra_vez_no: string | null = null;
  if (ctx.clientas.length) {
    const { data: en } = await sb.from('pedidos').select('*').in('clienta_id', ctx.clientas.map((k) => k.id)).eq('borrado', false).eq('estado', 'enviado');
    // 26/11 (caso #17): "como la otra vez" = la entrega de los últimos pedidos que salieron, no los campos sueltos de la ficha.
    ({ como_la_otra_vez, como_la_otra_vez_no } = comoLaOtraVez((en || []).map((r: any) => r.datos), c));
    const hoyMs = Date.now(), hoyF = hoyUY(), horaUY = +new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(new Date());
    // 5/11: "enviado" en la app = etiqueta impresa, NO que salió. Salida real = el equipo ya le mandó la foto del comprobante de envío (o pasaron más de 5 días).
    const minF = (en || []).map((r) => r.datos.fechas?.enviado || r.datos.fechas?.listo).filter(Boolean).sort()[0];
    let fotosEquipo: string[] = [];
    if (minF) {
      const desde = new Date(minF + 'T00:00:00-03:00').toISOString();
      const [{ data: e1 }, { data: e2 }] = await Promise.all([
        sb.from('mabel_mensajes').select('creado').eq('tel_key', ctx.telKey).eq('direccion', 'echo').in('tipo', ['image', 'document', 'video']).gte('creado', desde).limit(50),
        sb.from('mabel_historial').select('fecha').eq('tel_key', ctx.telKey).eq('de', 'equipo').in('tipo', ['image', 'media_placeholder', 'document', 'video']).gte('fecha', desde).limit(50),
      ]);
      fotosEquipo = [...(e1 || []).map((x: any) => x.creado), ...(e2 || []).map((x: any) => x.fecha)].map((x) => new Date(x).toISOString());
    }
    // 7/11: domingo no sale nada; sábado sale todo menos Correo.
    const sumarDia = (f: string, ent?: string) => { let d = new Date(new Date(f + 'T12:00:00Z').getTime() + 864e5); while (d.getUTCDay() === 0) d = new Date(d.getTime() + 864e5); return d.toISOString().slice(0, 10); };
    enviados_recientes = (en || []).map((r) => {
      const p = r.datos, f = p.fechas?.enviado || p.fechas?.listo || null;
      const dias = f ? Math.floor((hoyMs - new Date(f + 'T12:00:00-03:00').getTime()) / 864e5) : null;
      const desdeMs = f ? new Date(f + 'T00:00:00-03:00').getTime() : 0;
      const hayFoto = fotosEquipo.some((x) => new Date(x).getTime() >= desdeMs);
      const confirmada = hayFoto || (dias !== null && dias > 5);
      const ent = entregaEf(p, c), esperada = p.fechas?.listo ? sumarDia(p.fechas.listo, ent) : (f ? sumarDia(f, ent) : null);
      const vencida = !!esperada && (hoyF > esperada || (hoyF === esperada && horaUY >= 12));
      return { numero: p.num, etiqueta_impresa_el: f, dias_desde_la_etiqueta: dias, entrega: entregaEf(p, c), prendas: (p.prendas || []).map((x: any) => x.nombre).filter(Boolean), salida_confirmada: confirmada, ...(confirmada ? {} : { fecha_esperada_de_salida: esperada, fecha_esperada_vencida: vencida, que_decir: vencida ? 'SOLO si pregunta dónde está o cuándo sale este pedido (no si habla de un cambio: si ya tiene la prenda, le llegó): decile "Tu pedido ya está pronto para despachar, te paso con Yanaina para que te diga con exactitud" y pasá a Yanaina (entrega, con_frase_propia). NO digas que ya salió.' : 'SOLO si pregunta dónde está o cuándo sale: NO digas que ya salió; decile que sale en la fecha esperada.' }) };
    }).filter((x) => x.dias_desde_la_etiqueta !== null && (x.dias_desde_la_etiqueta as number) <= 21).sort((a, b) => (a.dias_desde_la_etiqueta as number) - (b.dias_desde_la_etiqueta as number));
  }
  return {
    enviados_recientes,
    como_la_otra_vez,
    ...(como_la_otra_vez_no ? { como_la_otra_vez_no } : {}),
    clienta_encontrada: !!c,
    nota_de_la_clienta: c?.datos?.notaMabel || '',
    datos_guardados: c ? { direccion: c.datos.direccion || '', barrio: c.datos.barrio || '', agencia: c.datos.agencia || '', ciudad: c.datos.ciudad || '', departamento: c.datos.depto || '', nombre_envio: c.datos.nombreEnvio || '', ci: c.datos.ci || '', nota_cadete: c.datos.notaCadete || '', horario_preferencia: c.datos.horarioPref || '', otras_direcciones: (c.datos.direcciones || []).filter((x: any) => normD(x.direccion) !== normD(c.datos.direccion)).map((x: any) => ({ direccion: x.direccion, barrio: x.barrio || '', etiqueta: x.etiqueta || '' })), puede_guardar_sin_pagar: !!c.datos.puedeGuardarSinPagar } : null,
    ...(c && num(c.datos.saldoFavor) > 0 ? { saldo_a_favor: num(c.datos.saldoFavor), ...(c.datos.saldoVence ? { saldo_vence: c.datos.saldoVence } : {}) } : {}), // 20/11 (D-10)
    pedidos_abiertos: pedidos,
    a_transferir,
    sin_pagar_para_marcar: sinPagar.length,
    config: { tarifa_cadeteria: tar, recargo_mercado_pago_pct: mp, cuentas: cuentasDe(cfg) },
  };
}

// 26/11 (caso #17): la entrega para ofrecer "como la otra vez". Sale del último pedido enviado y tiene que coincidir con el anterior
// y con la ficha; si no, no se ofrece (se pregunta "¿cadete a tu casa, agencia o retiro?"). Sin pedidos enviados vale la ficha
// solo si no está mezclada (agencia o dirección de cadete, no las dos).
const NO_OTRA_VEZ = 'No ofrezcas "como la otra vez": preguntá "¿Cadete a tu casa, agencia o retiro?".';
export function comoLaOtraVez(enviados: any[], c: any): { como_la_otra_vez: any; como_la_otra_vez_no: string | null } {
  const d = c?.datos || {}, s = (v: any) => String(v ?? '').trim();
  const cad = s(d.direccion) ? { tipo: 'cadeteria', direccion: s(d.direccion), barrio: s(d.barrio) } : null;
  const ag = s(d.agencia) && s(d.ciudad) ? { tipo: 'agencia', agencia: s(d.agencia), ciudad: s(d.ciudad), departamento: s(d.depto), nombre_envio: s(d.nombreEnvio) } : null;
  const fecha = (p: any) => String(p?.fechas?.enviado || p?.fechas?.listo || p?.fechas?.creado || '');
  const ult = (enviados || []).filter((p) => p && ['cadeteria', 'agencia', 'retiro'].includes(p.entrega)).sort((x, y) => fecha(y).localeCompare(fecha(x))).slice(0, 2);
  if (!c) return { como_la_otra_vez: null, como_la_otra_vez_no: null };
  if (!ult.length) {
    const mvd = cad && barrioCanon(cad.barrio);
    if (ag && !mvd) return { como_la_otra_vez: ag, como_la_otra_vez_no: null };
    if (cad && !ag) return { como_la_otra_vez: cad, como_la_otra_vez_no: null };
    return { como_la_otra_vez: null, como_la_otra_vez_no: ag || cad ? 'La ficha tiene datos mezclados (agencia y dirección de cadete). ' + NO_OTRA_VEZ : null };
  }
  if (ult.length === 2 && ult[0].entrega !== ult[1].entrega) return { como_la_otra_vez: null, como_la_otra_vez_no: `Los últimos dos pedidos salieron distinto (${ult[0].entrega} y ${ult[1].entrega}). ` + NO_OTRA_VEZ };
  const tipo = ult[0].entrega;
  if (tipo === 'retiro') return { como_la_otra_vez: { tipo: 'retiro' }, como_la_otra_vez_no: null };
  const x = tipo === 'cadeteria' ? cad : ag;
  if (!x) return { como_la_otra_vez: null, como_la_otra_vez_no: `El último pedido salió por ${tipo} y la ficha no tiene esos datos. ` + NO_OTRA_VEZ };
  return { como_la_otra_vez: x, como_la_otra_vez_no: null };
}

// ─── Pedido nuevo → el pagado sin salir espera (26/11, Parte A, reglas de Yoan del 25/11) ───
// 1) Si una clienta tiene un pedido pagado esperando salir (listo) y en OTRO vivo hace un pedido nuevo que todavía no pagó
//    (creado el día del pago o después), el viejo sale de Despacho: pasa a guardado con esperaPedido = id del nuevo.
// 2) Si el nuevo se paga, el viejo vuelve a Despacho (listo) para salir junto. Si vence sin pagar (o se libera o se borra),
//    el viejo sigue guardado y queda UNA alerta para Yanaina en la bandeja.
// 3) Si la clienta tiene un paquete armado hoy (etiqueta impresa, todavía no salió) y suma un pedido, no se toca: alerta.
// Lo corre el repaso de cada hora y marcar_pagado (para la clienta de ese turno).
const diaUY = (iso: string) => { try { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(iso)); } catch (_) { return ''; } };
const ddmm = (f: string) => /^\d{4}-\d{2}-\d{2}/.test(f) ? (+f.slice(8, 10)) + '/' + (+f.slice(5, 7)) : '';
const sumar1 = (f: string) => new Date(new Date(f + 'T12:00:00Z').getTime() + 864e5).toISOString().slice(0, 10);
const HORA_LIBERAR_UY = 16; // como la app (negocio.js CORTES.horaLiberar): se libera a las 16 del día siguiente a la fecha de pago
const fechaNuevo = (r: any, live: any) => String(r.datos?.fechas?.creado || live?.fecha || '').slice(0, 10);
export function nuevoVencido(r: any, live: any) {
  const p = r?.datos;
  if (!r || r.borrado || !p || p.estado === 'liberado') return true;
  if (pagado(p) || p.estado !== 'pendiente') return false;
  if (p.web?.pagarHasta) return Date.now() >= Date.parse(p.web.pagarHasta);
  const fp = String(live?.datos?.fechaPagoISO || ''); if (!/^\d{4}-\d{2}-\d{2}$/.test(fp)) return false;
  const lim = sumar1(fp), hoy = hoyUY(), h = +new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(new Date());
  return hoy > lim || (hoy === lim && h >= HORA_LIBERAR_UY);
}
const notaMas = (p: any, n: string) => { if (!String(p.notas || '').includes(n)) p.notas = p.notas ? String(p.notas) + '\n' + n : n; };
export async function revisarEsperas(clientaIds: string[] | null = null, ctxNombre = '') {
  const hechos: any[] = [];
  let q = sb.from('pedidos').select('*').eq('borrado', false).in('estado', ['listo', 'pendiente', 'guardado']);
  if (clientaIds) { if (!clientaIds.length) return hechos; q = q.in('clienta_id', clientaIds); }
  const { data: filas0, error } = await q.limit(4000);
  if (error) return [{ esperas: 'error ' + error.message }];
  const filas = (filas0 || []).filter((r: any) => r.datos && !r.datos.cambio);
  const porCli = new Map<string, any[]>();
  for (const r of filas) { const k = String(r.clienta_id || ''); if (!k || (!clientaIds && /^cb99000\d{3}$/.test(k))) continue; /* el repaso real no toca las fichas del banco */ if (!porCli.has(k)) porCli.set(k, []); porCli.get(k)!.push(r); }
  // Paquetes armados hoy (etiqueta impresa, todavía no salieron), por clienta
  const inicioHoy = new Date(hoyUY() + 'T00:00:00-03:00').toISOString();
  const { data: kHoy } = await sb.from('paquetes').select('id,fecha,pedidos,datos').eq('borrado', false).gte('fecha', inicioHoy).limit(500);
  const paqDe = new Map<string, any>();
  for (const k of kHoy || []) { const c = String(k.datos?.clienteId || ''); if (c && (!paqDe.has(c) || String(k.fecha) > String(paqDe.get(c).fecha))) paqDe.set(c, k); }
  // Solo las clientas que pueden necesitar algo: con un pagado sin salir y otro abierto, con un guardado que espera, o con paquete de hoy y un pedido abierto
  const abierto = (rs: any[]) => rs.some((r) => r.datos.estado === 'pendiente' && !pagado(r.datos));
  const cand = [...porCli.entries()].filter(([cid, rs]) => rs.some((r) => r.datos.esperaPedido) || (abierto(rs) && (paqDe.has(cid) || rs.some((r) => r.datos.estado === 'listo' && pagado(r.datos)))));
  if (!cand.length) return hechos;
  // Pedidos a los que se espera y no están en la lista (pagados y enviados, liberados, borrados)
  const ids = new Set(filas.map((r: any) => r.id)), faltan = [...new Set(cand.flatMap(([, rs]) => rs.map((r) => r.datos.esperaPedido).filter((x: any) => x && !ids.has(x))))];
  const extra = new Map<string, any>();
  if (faltan.length) { const { data: ex } = await sb.from('pedidos').select('*').in('id', faltan); (ex || []).forEach((r: any) => extra.set(r.id, r)); }
  const lids = [...new Set([...filas, ...extra.values()].map((r: any) => r.live_id).filter(Boolean))];
  const lives = new Map<string, any>();
  if (lids.length) { const { data: ls } = await sb.from('lives').select('id,nombre,fecha,datos').in('id', lids); (ls || []).forEach((l: any) => lives.set(l.id, l)); }
  for (const [cid, rs] of cand) {
    try {
      const { data: cl } = await sb.from('clientas').select('id,tel_key,datos').eq('id', cid).maybeSingle();
      const nombre = String(cl?.datos?.nombre || ctxNombre || 'La clienta'), tk = String(cl?.tel_key || cl?.datos?.telKey || '');
      const lv = (r: any) => lives.get(r.live_id);
      const nuevos = rs.filter((r) => r.datos.estado === 'pendiente' && !pagado(r.datos) && Array.isArray(r.datos.prendas) && r.datos.prendas.length && !nuevoVencido(r, lv(r)))
        .sort((a, b) => fechaNuevo(b, lv(b)).localeCompare(fechaNuevo(a, lv(a))) || (b.datos.num - a.datos.num));
      // (1) listo pagado + nuevo de otro vivo creado el día del pago o después → guardado esperando el nuevo
      for (const r of rs.filter((x) => x.datos.estado === 'listo' && pagado(x.datos) && !x.datos.esperaPedido)) {
        const diaPago = diaUY(String(r.datos.pago?.fecha || '')) || String(lv(r)?.fecha || '');
        const n = nuevos.find((x) => x.live_id !== r.live_id && fechaNuevo(x, lv(x)) >= diaPago && fechaNuevo(x, lv(x)) >= String(lv(r)?.fecha || '').slice(0, 10));
        if (!n) continue;
        await conReintento(async () => {
          const { data: f } = await sb.from('pedidos').select('*').eq('id', r.id).single();
          const p = JSON.parse(JSON.stringify(f.datos)); if (p.estado !== 'listo' || p.esperaPedido) return;
          p.estado = 'guardado'; p.fechas = p.fechas || {}; p.fechas.guardado = hoyUY(); p.esperaPedido = n.id; delete p.preguntaEnvio;
          notaMas(p, `⏸️ Guardado: espera el pedido #${n.datos.num} del ${ddmm(fechaNuevo(n, lv(n)))} para salir junto`);
          await guardarPedido(f, p);
        });
        hechos.push({ clienta: cid, guardado: r.datos.num, espera: n.datos.num });
      }
      // (2) guardados que esperan: si el nuevo se pagó, vuelven a Despacho; si venció, alerta una sola vez
      const todas = new Map<string, any>([...rs.map((x) => [x.id, x] as [string, any]), ...[...extra.values()].filter((x) => x.clienta_id === cid).map((x) => [x.id, x] as [string, any])]);
      const vencidos: any[] = [];
      for (const r of rs.filter((x) => x.datos.estado === 'guardado' && x.datos.esperaPedido)) {
        const t = todas.get(r.datos.esperaPedido) || extra.get(r.datos.esperaPedido);
        if (t && !t.borrado && t.datos && pagado(t.datos) && t.datos.estado !== 'liberado') {
          await conReintento(async () => {
            const { data: f } = await sb.from('pedidos').select('*').eq('id', r.id).single();
            const p = JSON.parse(JSON.stringify(f.datos)); if (p.estado !== 'guardado' || !p.esperaPedido) return;
            p.estado = 'listo'; delete p.esperaPedido; delete p.alertaEspera;
            if (t.datos.entrega && t.datos.entrega !== 'sin_definir') p.entrega = t.datos.entrega;
            notaMas(p, `▶️ Vuelve a Despacho: se pagó el #${t.datos.num}, salen juntos`);
            await guardarPedido(f, p);
          });
          hechos.push({ clienta: cid, vuelve: r.datos.num, con: t.datos.num });
        } else if (!t || nuevoVencido(t, lv(t))) {
          if (r.datos.alertaEspera === r.datos.esperaPedido) continue; // ya se avisó por ese pedido
          vencidos.push({ r, t });
        }
      }
      if (vencidos.length) {
        const nv = vencidos[0].t?.datos?.num, gs = vencidos.map((v) => '#' + v.r.datos.num).join(' y ');
        const est = !vencidos[0].t || vencidos[0].t.borrado ? 'se borró' : vencidos[0].t.datos.estado === 'liberado' ? 'se liberó' : 'venció sin pagar';
        const dv = await registrarDerivado(tk, cl, `${nombre}: el ${nv ? '#' + nv : 'pedido nuevo'} ${est}. Tiene guardado el ${gs} pagado. Preguntarle si se lo mandamos.`, 'entrega', true, 'espera');
        if (dv) for (const v of vencidos) await conReintento(async () => {
          const { data: f } = await sb.from('pedidos').select('*').eq('id', v.r.id).single();
          const p = JSON.parse(JSON.stringify(f.datos)); p.alertaEspera = p.esperaPedido; await guardarPedido(f, p);
        });
        hechos.push({ clienta: cid, alerta_vencido: gs });
      }
      // (3) paquete armado hoy (todavía no salió) + pedido nuevo creado después: no se mueve, alerta una vez por pedido nuevo
      if (nuevos.length && tk) {
        const k = paqDe.get(cid);
        const nn = k && nuevos.find((x) => !(k.pedidos || []).includes(x.id) && String(x.datos?.fechas?.creado || '9') >= diaUY(String(k.fecha)));
        if (k && nn) {
          const mot = `${nombre} tiene paquete armado (${(k.datos?.nums || []).map((x: any) => '#' + x).join(' · ') || 'hoy'}) y sumó el #${nn.datos.num}: ¿lo frenamos?`;
          const { data: dvs } = await sb.from('derivados').select('datos').eq('datos->>telKey', tk).eq('borrado', false).gte('datos->>ultimo', new Date(Date.now() - 3 * 864e5).toISOString()).limit(10);
          if (!(dvs || []).some((x: any) => JSON.stringify(x.datos?.motivos || x.datos?.motivo || '').includes(`sumó el #${nn.datos.num}`))) {
            await registrarDerivado(tk, cl, mot, 'entrega', true, 'espera');
            hechos.push({ clienta: cid, alerta_paquete: nn.datos.num });
          }
        }
      }
    } catch (e) { hechos.push({ clienta: cid, esperas: 'error ' + String((e as Error).message || e).slice(0, 120) }); }
  }
  return hechos;
}
// A3 (26/11): el pago entró, Mabel le preguntó algo que falta para despachar y la clienta no contestó. El pedido aparece igual en
// Despacho, con la alerta "Le preguntamos si enviamos y no contestó" (preguntaEnvio). Se borra cuando la clienta contesta o el equipo la marca.
export async function marcarPregunta(telKey: string, texto: string | null) {
  const { data: cls } = await sb.from('clientas').select('id').eq('tel_key', telKey).eq('borrado', false);
  if (!cls?.length) return 0;
  const { data: ps } = await sb.from('pedidos').select('*').in('clienta_id', cls.map((x: any) => x.id)).eq('borrado', false).in('estado', ['listo', 'pendiente']);
  let n = 0;
  for (const r of ps || []) {
    const p0 = r.datos || {};
    if (texto ? !(pagado(p0) && p0.estado === 'listo' && !p0.cambio) : !p0.preguntaEnvio) continue;
    try {
      await conReintento(async () => {
        const { data: f } = await sb.from('pedidos').select('*').eq('id', r.id).single();
        const p = JSON.parse(JSON.stringify(f.datos));
        if (texto) p.preguntaEnvio = { texto: texto.slice(0, 160), hora: new Date().toISOString() }; else { if (!p.preguntaEnvio) return; delete p.preguntaEnvio; }
        await guardarPedido(f, p); n++;
      });
    } catch (e) { console.error('preguntaEnvio:', (e as Error).message || e); }
  }
  return n;
}

// ─── Pendientes que se cierran solos (26/11, Parte B) ───────────────────
// Un pendiente abierto se cierra solo (resueltoPor "cerrado solo: …", cerradoSolo) cuando:
//  1) el equipo (o Mabel, sin contar la frase del pase) contestó después del pase y lo que la clienta escribió después es solo agradecimiento;
//  2) el pedido que lo motivó ya salió (o la clienta no tiene pedidos abiertos) y después de la última respuesta solo agradeció;
//  3) es de pago y se registró un pago de sus pedidos después del pase.
// Nunca si lo último de la clienta es una pregunta o un pedido real, si es un reclamo sin respuesta del equipo, si Yanaina tiene
// tomada la conversación y no le escribió, si es un plazo sin cargar, o si alguien lo reabrió a mano (reabiertoManual) y no hubo nada nuevo.
// Solo se cierran solos los pendientes con movimiento desde CERRAR_SOLOS_DESDE (los de antes, con el ok de Yoan, por la limpieza).
export const CERRAR_SOLOS_DESDE = '2026-11-26T13:00:00Z';
const RE_RECLAMO = /reclam|fall(a|ad[oa])|roto|rota|manchad|descosid|equivocad|no (me )?lleg[oó]|lleg[oó] mal|falt(a|ó|aba) (una|un|la|el)|me mandaron otr|no es (lo|la|el) que ped|devoluci/i;
const TIPOS_NADA = ['edit', 'revoke', 'system', 'ephemeral'];
const soloAgradece = (m: any) => ['sticker', 'reaction'].includes(String(m.tipo)) || (String(m.tipo) === 'text' && esAck(String(m.texto || '')));
export async function cerrarSolos(telKeys: string[] | null, opt: { dry?: boolean; desde?: string } = {}) {
  const desde = opt.desde === undefined ? CERRAR_SOLOS_DESDE : opt.desde;
  let q = sb.from('derivados').select('id,datos').eq('borrado', false).is('datos->>resuelto', null);
  if (telKeys) { if (!telKeys.length) return []; q = q.in('datos->>telKey', telKeys); }
  const { data: rows, error } = await q.limit(600);
  if (error) return [{ cerrar_solos: 'error ' + error.message }];
  const out: any[] = [], ahora = new Date().toISOString();
  for (const row of rows || []) {
    const d = row.datos || {}; if (d.resuelto || d.unidoA) continue;
    const tk = String(d.telKey || ''); if (!tk || (!telKeys && /^99000\d{3}$/.test(tk))) continue;
    const ms0 = motivosDe(d), ultimo = String(d.ultimo || d.creado || ms0[ms0.length - 1]?.fecha || '');
    if (desde && ultimo < desde) continue;
    if (d.reabiertoManual && ultimo <= String(d.reabiertoManual)) continue;
    try {
      const txtMot = [d.motivo, ...ms0.map((m: any) => m.motivo)].join(' ');
      if (String(d.motivo || '').includes(FALTA_PLAZO)) continue;
      const desdeMs = new Date(Date.parse(String(d.creado || ultimo)) - 864e5).toISOString();
      const { data: msg } = await sb.from('mabel_mensajes').select('direccion,tipo,texto,creado').eq('tel_key', tk).gte('creado', desdeMs).order('creado').limit(200);
      const ms = (msg || []).filter((m: any) => !TIPOS_NADA.includes(String(m.tipo))).map((m: any) => ({ ...m, t: new Date(m.creado).toISOString() }));
      const auto = (m: any) => m.tipo === 'plantilla' || m.tipo === 'ausente' || /Gracias por elegir Emma Indumentaria|mensaje autom[aá]tico de Emma|me confirm[aá]s con un S[ÍI]|Formas de pago/i.test(String(m.texto || ''));
      const resp = ms.filter((m: any) => (m.direccion === 'out' || m.direccion === 'echo') && m.tipo !== 'reaction' && !auto(m));
      const ult = resp[resp.length - 1];
      const despues = ms.filter((m: any) => m.direccion === 'in' && (!ult || m.t > ult.t));
      if (despues.some((m: any) => !soloAgradece(m))) continue; // lo último de ella es una pregunta o un pedido real
      const ecoDespues = resp.some((m: any) => m.direccion === 'echo' && m.t > ultimo);
      const { data: cv } = await sb.from('conversaciones').select('datos').eq('id', tk).maybeSingle();
      if (cv?.datos?.estado === 'yanaina' && String(cv.datos.hasta || '') > ahora && !ecoDespues) continue; // la tiene Yanaina y no le escribió
      if ((RE_RECLAMO.test(txtMot) || ['cambio', 'especial'].includes(String(d.categoria))) && !ecoDespues) continue;
      // ¿qué regla aplica?
      let regla = '';
      const { data: cls } = await sb.from('clientas').select('id,datos').eq('tel_key', tk).eq('borrado', false);
      const cids = (cls || []).map((x: any) => x.id);
      const { data: ped } = cids.length ? await sb.from('pedidos').select('id,num,estado,datos,borrado').in('clienta_id', cids) : { data: [] as any[] };
      const abiertos = (ped || []).filter((r: any) => !r.borrado && ['pendiente', 'listo', 'guardado'].includes(r.estado) && !r.datos?.cambio);
      // Más plazo: queda abierto mientras tenga un pedido sin pagar sin el plazo cargado en la app (misma regla que resolverPendientes)
      if (RE_PLAZO.test(txtMot) && abiertos.some((r: any) => !pagado(r.datos) && !r.datos?.guardadoSinPagar?.hasta)) continue;
      const esPago = d.categoria === 'pago' || ms0.some((m: any) => m.categoria === 'pago');
      if (esPago && (ped || []).length) {
        const fPago = ms0.filter((m: any) => m.categoria === 'pago').map((m: any) => String(m.fecha)).sort()[0] || String(d.creado || '');
        const { data: gs } = await sb.from('pagos').select('id,fecha').in('pedido_id', (ped || []).map((r: any) => r.id)).eq('borrado', false).gt('fecha', fPago).limit(1);
        if (gs?.length) regla = 'se registró el pago después del pase';
      }
      const respPase = resp.filter((m: any) => m.t > ultimo && !(m.direccion === 'out' && (RE_PASE.test(String(m.texto || '')) || RE_AVISO_PROPIO.test(String(m.texto || '')))));
      if (!regla && respPase.length && !(esPago && !respPase.some((m: any) => m.direccion === 'echo'))) regla = respPase.some((m: any) => m.direccion === 'echo') ? 'el equipo contestó y la clienta solo agradeció' : 'Mabel contestó y la clienta solo agradeció';
      if (!regla) {
        const nums = [...txtMot.matchAll(/#(\d{1,5})/g)].map((x) => +x[1]);
        const citados = nums.length ? (ped || []).filter((r: any) => nums.includes(+r.num)) : [];
        // Sin pedidos abiertos cuenta solo si alguno salió o se cerró DESPUÉS del pase (lo que la tenía pendiente se resolvió así);
        // una pregunta general sin respuesta (ej. "¿venden por mayor?") no se cierra por no tener pedido.
        const diaPase = diaUY(String(ms0[0]?.fecha || d.creado || ultimo));
        const cerroDespues = (ped || []).some((r: any) => !['pendiente', 'listo', 'guardado'].includes(r.estado) && String(r.datos?.fechas?.[r.estado] || r.datos?.fechas?.enviado || '') >= diaPase);
        if (!abiertos.length && cerroDespues) regla = 'no tiene pedidos abiertos (el pedido salió o se cerró después del pase)';
        else if (citados.length && citados.every((r: any) => r.borrado || !['pendiente', 'listo', 'guardado'].includes(r.estado))) regla = 'el pedido ' + citados.map((r: any) => '#' + r.num).join(', ') + ' ya salió o se cerró';
      }
      if (!regla) continue;
      out.push({ id: row.id, telKey: tk, nombre: String(cls?.[0]?.datos?.nombre || d.tel || tk), motivo: String(ms0[0]?.motivo || d.motivo || '').slice(0, 160), ultimo, regla });
      if (!opt.dry) await sb.from('derivados').update({ datos: { ...d, resuelto: ahora, resueltoPor: 'cerrado solo: ' + regla, cerradoSolo: true } }).eq('id', row.id);
    } catch (e) { out.push({ id: row.id, error: String((e as Error).message || e).slice(0, 120) }); }
  }
  return out;
}

// ─── Escritura con control de cambios ─────────────────────────
const normD = (v: any) => String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
// Lista de direcciones de cadetería de la clienta (3/11): la principal es datos.direccion; las demás quedan en datos.direcciones.
function sumarDireccion(d: any, dir: string, barrio: string, etiqueta: string) {
  const l = Array.isArray(d.direcciones) ? [...d.direcciones] : [];
  if (d.direccion && !l.some((x: any) => normD(x.direccion) === normD(d.direccion))) l.push({ direccion: d.direccion, barrio: d.barrio || '' });
  const i = l.findIndex((x: any) => normD(x.direccion) === normD(dir));
  const nueva = { ...(i >= 0 ? l[i] : {}), direccion: dir, barrio: barrio || (i >= 0 ? l[i].barrio : ''), ...(etiqueta ? { etiqueta } : {}) };
  if (i >= 0) l[i] = nueva; else l.push(nueva);
  return l.slice(-5);
}
async function guardarPedido(row: any, datos: any) {
  const { data, error } = await sb.from('pedidos').update({ estado: datos.estado || 'pendiente', entrega: datos.entrega || 'sin_definir', datos, actualizado: new Date().toISOString() }).eq('id', row.id).eq('actualizado', row.actualizado).select('id');
  if (error) throw new Error('No se pudo guardar el pedido: ' + error.message);
  if (!data?.length) throw new Error('conflicto: el pedido cambió mientras se guardaba');
}
async function guardarClienta(row: any, datos: any) {
  const { data, error } = await sb.from('clientas').update({ datos, actualizado: new Date().toISOString() }).eq('id', row.id).eq('actualizado', row.actualizado).select('id');
  if (error) throw new Error('No se pudo guardar la clienta: ' + error.message);
  if (!data?.length) throw new Error('conflicto: la ficha cambió mientras se guardaba');
}
async function conReintento<T>(fn: () => Promise<T>): Promise<T> {
  try { return await fn(); } catch (e) { if (String((e as Error).message).startsWith('conflicto')) return await fn(); throw e; }
}

// ─── pasar_a_yanaina ──────────────────────────────────────────
// 10/11: día de salida del pedido calculado con la hora REAL del pago (p.pago.fecha), no con el plazo del live.
// Domingo no sale nada; sábado salen cadetería, DAC y Núñez (DAC y Núñez antes de las 12); Correo solo de lunes a viernes.
// Pago pasadas las 20:00 (DAC: pasadas las 20 también, aunque sale al día siguiente): no se promete día, lo confirma Yanaina.
// 15/11: días sin salida (viaje, feriados). config.diasSinSalida = [{ fecha: 'AAAA-MM-DD', solo?: ['dac'|'nunez'|'correo'|'cadeteria'|'retiro'], motivo? }].
// Sin "solo", ese día no sale nada ni hay retiro. Las fechas de salida los saltean igual que al domingo.
export function sinSalida(cfg: any, fecha: string, kind: string) {
  const l = Array.isArray(cfg?.diasSinSalida) ? cfg.diasSinSalida : [];
  return l.some((x: any) => x?.fecha === fecha && (!Array.isArray(x.solo) || !x.solo.length || x.solo.includes(kind)));
}
const DIAS_NOM = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
/** Días sin salida que vienen (desde hoy, hasta 14 días), para avisarle a Mabel: hasta cuándo se paga para que salga antes y qué día sale lo que se pague después. */
export function pausaTexto(cfg: any) {
  const hoy = hoyUY(), lim = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
  const l = (Array.isArray(cfg?.diasSinSalida) ? cfg.diasSinSalida : []).filter((x: any) => x?.fecha >= hoy && x.fecha <= lim).sort((a: any, b: any) => a.fecha.localeCompare(b.fecha));
  if (!l.length) return '';
  const dia = (f: string) => { const d = new Date(f + 'T12:00:00Z'); return DIAS_NOM[d.getUTCDay()] + ' ' + d.getUTCDate() + '/' + (d.getUTCMonth() + 1); };
  const sumar = (f: string, n: number) => new Date(new Date(f + 'T12:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10);
  const total = l.filter((x: any) => !Array.isArray(x.solo) || !x.solo.length);
  const nombre: Record<string, string> = { dac: 'DAC', nunez: 'Núñez', correo: 'Correo Uruguayo', cadeteria: 'cadetería', retiro: 'retiro' };
  const parciales = l.filter((x: any) => Array.isArray(x.solo) && x.solo.length).map((x: any) => dia(x.fecha) + ' no hay ' + x.solo.map((k: string) => nombre[k] || k).join(' ni '));
  // Último día de pago (antes de las 20, o de las 15 en DAC) que todavía sale antes de la pausa, y qué día sale lo que se pague después.
  const at = (f: string, hh: string) => new Date(f + 'T' + hh + ':00-03:00').toISOString();
  const primero = l[0].fecha;
  let ultimo = '';
  for (let f = hoy; f < primero; f = sumar(f, 1)) { const r: any = salidaPrevista('cadeteria', '', at(f, '19:00'), cfg); if (r?.dia && r.dia === salidaPrevista('cadeteria', '', at(f, '19:00'), {})?.dia) ultimo = f; }
  const desp = total.length ? total[total.length - 1].fecha : l[l.length - 1].fecha;
  const tras = (tipo: string, ag: string) => (salidaPrevista(tipo, ag, at(desp, '12:00'), cfg) as any)?.texto || '';
  return 'PAUSA DE DESPACHO (el equipo está de viaje): ' + (total.length ? 'del ' + dia(total[0].fecha) + ' al ' + dia(desp) + ' no sale ningún envío ni hay retiro' : '') + (parciales.length ? (total.length ? '; además el ' : '') + parciales.join('; ') : '') + '. '
    + (ultimo ? 'Último pago que sale antes del viaje: el ' + dia(ultimo) + ' hasta las 20:00 (cadetería ' + ((salidaPrevista('cadeteria', '', at(ultimo, '19:00'), cfg) as any)?.texto || '') + '; Núñez ' + ((salidaPrevista('agencia', 'nunez', at(ultimo, '19:00'), cfg) as any)?.texto || '') + '; Correo ' + ((salidaPrevista('agencia', 'correo', at(ultimo, '19:00'), cfg) as any)?.texto || '') + ') y DAC hasta las 15:00 (' + String((salidaPrevista('agencia', 'dac', at(ultimo, '14:00'), cfg) as any)?.texto || '').replace(/^sale hoy \((.+?)\)/, 'sale el $1') + '). ' : '')
    + (ultimo ? 'Lo que se pague después' : 'Lo que se pague ahora') + ': cadetería ' + tras('cadeteria', '') + '; Núñez ' + tras('agencia', 'nunez') + '; DAC ' + tras('agencia', 'dac') + '; Correo Uruguayo ' + tras('agencia', 'correo') + '. '
    + 'Usá estos días tal cual (SALIDAS SI PAGA AHORA y salida_prevista ya los tienen en cuenta), solo si pregunta cuándo sale o por qué tarda; no la pases a Yanaina por esto. Retiro esos días no hay: ofrecé el primer día con horario cargado o "escribinos para coordinar a la vuelta".';
}
export function salidaPrevista(tipo: string, agencia: string, pagoISO: string | null, cfg: any = {}) {
  if (!pagoISO) return null;
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', minute: '2-digit' }).formatToParts(new Date(pagoISO)).map((x) => [x.type, x.value]));
  const h = +p.hour + (+p.minute) / 60, d0 = new Date(Date.UTC(+p.year, +p.month - 1, +p.day, 12));
  const fmt = (d: Date) => DIAS_NOM[d.getUTCDay()] + ' ' + d.getUTCDate() + '/' + (d.getUTCMonth() + 1);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const ag = String(agencia || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const kind = tipo === 'cadeteria' ? 'cadeteria' : /\bdac\b/.test(ag) ? 'dac' : /nunez|nunes/.test(ag) ? 'nunez' : /correo/.test(ag) ? 'correo' : null;
  if (!kind) return { texto: 'No hay salida calculable para esta agencia: que lo confirme Yanaina.', confirmar_yanaina: true };
  const sab = kind !== 'correo';
  const sigue = (desde: Date, pausa = true) => { let d = new Date(desde.getTime() + 864e5); while (d.getUTCDay() === 0 || (d.getUTCDay() === 6 && !sab) || (pausa && sinSalida(cfg, iso(d), kind))) d = new Date(d.getTime() + 864e5); return d; };
  const cuando = (d: Date) => kind === 'cadeteria' ? '' : (kind === 'dac' ? (d.getUTCDay() === 6 ? ' antes de las 12' : ' entre las 17 y las 18') : (d.getUTCDay() === 6 ? ' antes de las 12' : ' al mediodía'));
  if (h >= 20) {
    // Pasadas las 20 entra al corte del día siguiente. Sin pausa lo confirma Yanaina; si una pausa corre la salida, el día ya es seguro.
    const base = new Date(d0.getTime() + 864e5), dP = sigue(base), dN = sigue(base, false);
    if (iso(dP) !== iso(dN)) return { texto: 'sale el ' + fmt(dP) + cuando(dP) + ' (el equipo está de viaje)', dia: fmt(dP) };
    return { texto: 'Pagó pasadas las 20 hs: no le prometas día, Yanaina le confirma el día de salida.', confirmar_yanaina: true };
  }
  if (kind === 'dac' && h < 15 && d0.getUTCDay() >= 1 && d0.getUTCDay() <= 5 && !sinSalida(cfg, iso(d0), 'dac')) return { texto: 'sale hoy (' + fmt(d0) + ') entre las 17 y las 18', dia: fmt(d0) };
  const d = sigue(d0);
  return { texto: 'sale el ' + fmt(d) + cuando(d), dia: fmt(d) };
}
// ─── Bandeja de derivados (pestaña Mabel de la app, 11/11) ─────
// Cada pase a Yanaina deja una fila en la tabla derivados con su categoría. La app la muestra como pendiente hasta que alguien toca "Resuelto".
export const CATEGORIAS = ['pedido', 'pago', 'entrega', 'cambio', 'especial', 'yharol', 'otros'];
/** Categoría por palabras del motivo: se usa cuando Mabel no la manda o manda una que no existe. */
export function categoriaDe(motivo: string): string {
  const m = String(motivo || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/yharol|yarol|maquillaje|perfum|bazar/.test(m)) return 'yharol';
  if (/\bcambio\b|cambiar (la|el|los|las|de talle)|devoluci|devolver/.test(m)) return 'cambio';
  if (/desconoce|no (lo |la )?pidio|no es (de ella|suyo|mio)|(prenda|remera|pantalon|short|cosa|algo|una|uno)s? de (mas|menos)|le falta|falta (una|la|el) |equivocad|mal anotad|reclam|no coincide con lo que pidio|numero sin pedido|sin pedido (abierto|de un live)|varios pedidos|dice ser/.test(m)) return 'pedido';
  if (/comprobante|transfi|pago\b|pagar|pagado|faltan \$|mercado ?pago|\bmp\b|link|cuenta|efectivo|plazo/.test(m)) return 'pago';
  if (/agencia|cadete|envio|enviar|retir|direccion|barrio|salio|sale |despach|dac\b|nunez|correo|local/.test(m)) return 'entrega';
  if (/agregar|sumar|guardar|guardad|avis(en|ar) cuando|consulta|pregunta (si|por)|talle|prenda|precio|tene[sn]\b|tienen|queda[n]?\b|\bhay\b|cuanto (sale|cuesta)|proximo vivo/.test(m)) return 'especial';
  return 'otros';
}
// 14/11 (MAC-07, MAC-08): UN solo pendiente por clienta. Los motivos se suman como lista con fecha (motivos[]) y `motivo`
// queda como texto armado para la app (lo más nuevo arriba). La categoría es la más urgente (orden de CATEGORIAS),
// salvo que la hayan puesto a mano en la app (categoriaManual). Si había varias filas pendientes, se unen en una y las
// otras quedan resueltas con "unido a …". "Resuelto" en la app resuelve así a la clienta entera.
// Devuelve null si no se pudo guardar (se reintenta una vez): en ese caso NO se le promete a la clienta que le escriben.
// repetido = ya había un motivo pendiente de la MISMA categoría de antes de `antesDe` (inicio del turno): el pase va en silencio.
const urg = (c: string) => { const i = CATEGORIAS.indexOf(c); return i < 0 ? 99 : i; };
const fechaCorta = (iso: string) => { try { return new Intl.DateTimeFormat('es-UY', { timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso)).replace(',', ''); } catch (_) { return ''; } };
const motivosDe = (d: any): any[] => Array.isArray(d?.motivos) && d.motivos.length ? d.motivos : [{ fecha: d?.ultimo || d?.creado || new Date().toISOString(), categoria: d?.categoria || 'otros', motivo: String(d?.motivo || 'Sin motivo'), ...(d?.silencio ? { silencio: true } : {}) }];
const textoMotivos = (ms: any[]) => ms.slice(-6).reverse().map((m) => fechaCorta(m.fecha) + ' · ' + m.motivo).join('\n') + (ms.length > 6 ? '\n(+' + (ms.length - 6) + ' anteriores)' : '');
async function dosVeces<T>(f: () => PromiseLike<{ data?: T; error: any }>) { let r = await f(); if (r.error) { await new Promise((x) => setTimeout(x, 400)); r = await f(); } return r; }
export async function registrarDerivado(telKey: string, c: any, motivo: string, categoria: string | undefined, silencio: boolean, origen: string, antesDe?: string): Promise<{ id: string; repetido: boolean } | null> {
  try {
    const cat = CATEGORIAS.includes(String(categoria)) ? String(categoria) : categoriaDe(motivo);
    const ahora = new Date().toISOString(), mot = String(motivo || 'Sin motivo').replace(/\s+/g, ' ').trim().slice(0, 300);
    const corte = antesDe || ahora;
    const { data: ab, error: e0 } = await dosVeces(() => sb.from('derivados').select('id,datos').eq('datos->>telKey', telKey).eq('borrado', false).order('actualizado', { ascending: false }).limit(30));
    if (e0) { console.error('derivados (leer):', e0.message); return null; }
    const pend = ((ab || []) as any[]).filter((r) => r.datos && !r.datos.resuelto);
    const previos = pend.flatMap((r) => motivosDe(r.datos));
    const repetido = previos.some((m) => m.categoria === cat && String(m.fecha) < corte);
    const nuevo = { fecha: ahora, categoria: cat, motivo: mot, origen, ...(silencio || repetido ? { silencio: true } : {}) };
    if (!pend.length) {
      // 14/11 tarde: si el último pendiente lo cerró el equipo al escribirle desde el celular, se reabre esa misma fila (queda la historia)
      const re = ((ab || []) as any[]).find((r) => r.datos?.resueltoPor === 'equipo respondió' && String(r.datos.resuelto || '') > new Date(Date.now() - 7 * 864e5).toISOString());
      if (re) {
        const ms = [...motivosDe(re.datos), nuevo].slice(-15);
        const d2: any = { ...re.datos, categoria: re.datos.categoriaManual ? re.datos.categoria : cat, motivos: ms, motivo: textoMotivos(ms), ultimo: ahora, veces: (+re.datos.veces || 1) + 1, resuelto: null, reabierto: ahora, silencio: !!nuevo.silencio, clienteId: c?.id || re.datos.clienteId || null };
        delete d2.resueltoPor; delete d2.resueltoEquipo;
        const { error } = await dosVeces(() => sb.from('derivados').update({ datos: d2 }).eq('id', re.id));
        if (error) { console.error('derivados (reabrir):', error.message); return null; }
        return { id: re.id, repetido: false };
      }
      const id = 'dv' + telKey + Date.now().toString(36);
      const datos = { id, telKey, tel: c?.datos?.tel || '0' + telKey, clienteId: c?.id || null, categoria: cat, motivo: textoMotivos([nuevo]), motivos: [nuevo], silencio: !!nuevo.silencio, origen, creado: ahora, ultimo: ahora, veces: 1, resuelto: null };
      const { error } = await dosVeces(() => sb.from('derivados').insert({ id, datos, borrado: false }));
      if (error) { console.error('derivados (crear):', error.message); return null; }
      return { id, repetido: false };
    }
    // Se queda la fila con categoría puesta a mano; si no, la más urgente; si empatan, la más vieja.
    const keep = [...pend].sort((x, y) => (y.datos.categoriaManual ? 1 : 0) - (x.datos.categoriaManual ? 1 : 0) || urg(x.datos.categoria) - urg(y.datos.categoria) || String(x.datos.creado).localeCompare(String(y.datos.creado)))[0];
    const vistos = new Set<string>();
    const todos = [...previos, nuevo].filter((m) => { const k = m.fecha + '|' + m.motivo; if (vistos.has(k)) return false; vistos.add(k); return true; }).sort((x, y) => String(x.fecha).localeCompare(String(y.fecha))).slice(-15);
    const categoriaFinal = keep.datos.categoriaManual ? keep.datos.categoria : [...todos].sort((x, y) => urg(x.categoria) - urg(y.categoria))[0].categoria;
    const veces = pend.reduce((n, r) => n + (+r.datos.veces || 1), 0) + 1;
    const datos = { ...keep.datos, categoria: categoriaFinal, motivos: todos, motivo: textoMotivos(todos), ultimo: ahora, veces, clienteId: c?.id || keep.datos.clienteId || null, silencio: todos.every((m) => m.silencio) };
    const { error } = await dosVeces(() => sb.from('derivados').update({ datos }).eq('id', keep.id));
    if (error) { console.error('derivados (sumar):', error.message); return null; }
    for (const r of pend) if (r.id !== keep.id) {
      const { error: e2 } = await sb.from('derivados').update({ datos: { ...r.datos, resuelto: ahora, resueltoPor: 'Mabel: unido a ' + keep.id, unidoA: keep.id } }).eq('id', r.id);
      if (e2) console.error('derivados (unir):', e2.message);
    }
    return { id: keep.id, repetido };
  } catch (e) { console.error('derivados:', (e as Error).message || e); return null; }
}

// 14/11 (MAC-01): la frase de pase le pide a la clienta que escriba. Esa respuesta queda SIN LEER en el celular de Yanaina
// (con notificación) y Mabel no la contesta mientras el pendiente siga abierto (conversaciones.datos.espera).
// 14/11 tarde: el equipo le escribió a la clienta desde el celular: sus pendientes pasan a resueltos ("equipo respondió").
// Si la clienta vuelve a escribir y nadie le contesta, el repaso de sin respuesta reabre la fila (registrarDerivado).
export async function resolverPorEquipo(telKey: string) {
  // 25/11: misma regla que el repaso (un pedido de más plazo sin el plazo cargado en la app queda abierto)
  return (await resolverPendientes(telKey, 'equipo respondió')).cerrados;
}

// 25/11 (pendientes que se reabrían solos): cierra los pendientes de una clienta cuando el equipo ya le contestó.
// Excepción: si el pendiente es de "más plazo para pagar" y ningún pedido abierto sin pagar tiene el plazo cargado en la app
// (guardado sin pagar con fecha), queda abierto con el motivo "Yanaina dijo que sí: falta cargar el plazo en la app".
export const RE_PLAZO = /plazo|m[aá]s (tiempo|d[ií]as)|pr[oó]rroga|esper(a|e|ar)(le|me|s)? (hasta|para pagar|el pago)|pagar(lo)? (en partes|despu[eé]s|m[aá]s adelante|la semana|el (lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo))|cuando cobre|cobro (el|del) sueldo/i;
const FALTA_PLAZO = 'Yanaina dijo que sí: falta cargar el plazo en la app';
export async function resolverPendientes(telKey: string, porque: string) {
  const out = { cerrados: 0, abiertos: 0 };
  const { data, error } = await sb.from('derivados').select('id,datos').eq('datos->>telKey', telKey).eq('borrado', false).order('actualizado', { ascending: false }).limit(10);
  if (error) { console.error('derivados (resolver):', error.message); return out; }
  const pend = (data || []).filter((r: any) => r.datos && !r.datos.resuelto);
  if (!pend.length) return out;
  let plazoCargado: boolean | null = null;
  const tienePlazo = async () => {
    if (plazoCargado !== null) return plazoCargado;
    const { data: cls } = await sb.from('clientas').select('id').eq('tel_key', telKey).eq('borrado', false);
    const ids = (cls || []).map((x: any) => x.id);
    const { data: ps } = ids.length ? await sb.from('pedidos').select('datos').in('clienta_id', ids).eq('borrado', false).in('estado', ['pendiente', 'listo', 'guardado']) : { data: [] as any[] };
    const sinPagar = (ps || []).map((r: any) => r.datos).filter((p: any) => p && !pagado(p));
    plazoCargado = !sinPagar.length || sinPagar.some((p: any) => p.guardadoSinPagar?.hasta);
    return plazoCargado;
  };
  const ahora = new Date().toISOString();
  for (const r of pend) {
    const motivos = motivosDe(r.datos), txt = [r.datos.motivo, ...motivos.map((m: any) => m.motivo)].join(' ');
    if (RE_PLAZO.test(txt) && !(await tienePlazo())) {
      if (!String(r.datos.motivo || '').includes(FALTA_PLAZO)) {
        const ms = [...motivos, { fecha: ahora, categoria: 'pago', motivo: FALTA_PLAZO, origen: 'repaso', silencio: true }].slice(-15);
        await sb.from('derivados').update({ datos: { ...r.datos, categoria: r.datos.categoriaManual ? r.datos.categoria : 'pago', motivos: ms, motivo: textoMotivos(ms), ultimo: ahora } }).eq('id', r.id);
      }
      out.abiertos++; continue;
    }
    const { error: e } = await sb.from('derivados').update({ datos: { ...r.datos, resuelto: ahora, resueltoPor: porque, resueltoEquipo: true } }).eq('id', r.id);
    if (e) console.error('derivados (resolver):', e.message); else out.cerrados++;
  }
  return out;
}

export const FRASE_PASE = 'Ya se lo paso a Yanaina. Contame en un mensaje qué necesitás y ella te contesta 🫶';
// 15/11: durante el modo ausente que atiende, el pase avisa que Yanaina contesta a la vuelta.
export const FRASE_PASE_AUSENTE = 'Ya se lo paso a Yanaina. Contame en un mensaje qué necesitás y ella te contesta a la vuelta del viaje 🫶';
// 20/11 (Tanda D, D-2 y D-9): la frase la decide la herramienta. Durante el vivo nadie puede contestar; lo de Yharol lleva su frase.
export const FRASE_PASE_VIVO = 'Ya se lo paso a Yanaina. Ahora estamos en vivo, apenas termine te contesta 🫶';
export const FRASE_YHAROL = 'Dale bella, le avisamos a Yharol por tu pedido 🫶';
export const frasePase = (ctx?: { ausente?: boolean; vivo?: boolean } | null, categoria?: string) => categoria === 'yharol' ? FRASE_YHAROL : ctx?.ausente ? FRASE_PASE_AUSENTE : ctx?.vivo ? FRASE_PASE_VIVO : FRASE_PASE;
// Frases de pase (la vieja sigue en el historial): para no repetirla y para sacarla cuando el pase va en silencio.
export const RE_PASE = /(ya le aviso a yanaina|ya se lo paso a yanaina|contame en un mensaje qu[eé] necesit[aá]s|le avisamos a yharol)/i;
// 26/11 (caso #24): frases propias de un motivo que también cuentan como "ya se le avisó del pase".
export const RE_AVISO_PROPIO = /(ya no la estamos usando|le paso tu comprobante a yanaina|te paso con yanaina|lo consulto con yanaina|yanaina te (confirma|escribe|contesta))/i;
// 26/11: ¿salió alguna frase de pase (o la frase propia del motivo) desde `desde`? Si no, el pase quedó sin aviso.
export async function seAvisoDesde(telKey: string, desde: string, frase = '') {
  const { data } = await sb.from('mabel_mensajes').select('texto').eq('tel_key', telKey).eq('direccion', 'out').gte('creado', desde).limit(40);
  const f = normB(frase).slice(0, 40);
  return (data || []).some((m: any) => { const t = String(m.texto || ''); return RE_PASE.test(t) || RE_AVISO_PROPIO.test(t) || (!!f && normB(t).includes(f)); });
}
export async function pasarAYanaina(ctx: Ctx, motivo: string, silencio = false, categoria?: string, frasePropia = false, fraseCaso = '') {
  // 25/11: en el repaso de una conversación que el equipo ya contestó (y la clienta no volvió a escribir) no se deriva nada.
  if (ctx.sinPase) return { ok: true, derivado: false, no_hace_falta: true, instruccion: 'El equipo ya le contestó a la clienta y ella no volvió a escribir: no hace falta pasarlo. Terminá la nota del repaso.' };
  // 4/11: cuando deriva Mabel, la conversación vuelve sola a Mabel en 1 hora (si Yanaina contesta desde el celu, el eco la deja más tiempo)
  const ahora = new Date(), hasta = new Date(ahora.getTime() + 1 * 3600e3);
  const c = ctx.clienta;
  // 14/11 (MAC-07): primero el pendiente de la bandeja. Si no se pudo guardar, no se cambia la conversación ni se promete nada.
  // 14/11 (MAR-01): en_silencio solo vale si alguien del equipo le escribió en la última hora. Excepciones: el repaso (no le
  // escribe nunca), los cambios en plazo (van en silencio a la bandeja por decisión del 13/11) y los pedidos anteriores a Mabel.
  let silencioNegado = false;
  if (silencio && !ctx.repaso && categoria !== 'cambio' && !(ctx.anteriores && categoria === 'pago')) {
    const { data: ec } = await sb.from('mabel_mensajes').select('texto,tipo').eq('tel_key', ctx.telKey).eq('direccion', 'echo').gte('creado', new Date(ahora.getTime() - 3600e3).toISOString()).limit(20);
    const equipoHablo = (ec || []).some((e: any) => !['edit', 'revoke', 'system', 'unsupported', 'ephemeral', 'reaction'].includes(String(e.tipo)) && !/Gracias por elegir Emma Indumentaria|mensaje autom[aá]tico de Emma|me confirm[aá]s con un S[ÍI]|Formas de pago/i.test(String(e.texto || '')));
    if (!equipoHablo) { silencio = false; silencioNegado = true; }
  }
  const dv = await registrarDerivado(ctx.telKey, c, motivo, categoria, silencio, categoria ? 'mabel' : 'regla', ctx.inicio);
  if (!dv) return { ok: false, derivado: false, error: 'No se pudo dejar el pase para Yanaina (falla al guardar).', instruccion: 'NO le digas que le avisás a Yanaina ni que alguien le escribe. Contestale solo lo que puedas resolver vos; si no hay nada para contestar, respondé exactamente "(sin mensaje)".' };
  const { data: prevCv } = await sb.from('conversaciones').select('datos').eq('id', ctx.telKey).maybeSingle();
  const prev = prevCv?.datos || {};
  // 26/11 (caso #24): el pase repetido solo se calla si a la clienta ya le salió la frase del pase desde el PRIMER pase de este
  // pendiente. Si el turno que derivó se descartó (reintento) y nunca se le dijo nada, se le dice ahora.
  const paseDesde = dv.repetido ? String(prev.paseDesde || prev.derivadoEn || ahora.toISOString()) : ahora.toISOString();
  const sinAviso = !!dv.repetido && !silencio && !ctx.repaso && !(await seAvisoDesde(ctx.telKey, paseDesde, prev.fraseAviso || ''));
  const repetido = dv.repetido && !sinAviso;
  const fraseAviso = silencio || repetido ? (dv.repetido ? prev.fraseAviso || '' : '') : (fraseCaso || (frasePropia && categoria !== 'yharol' ? '' : frasePase(ctx, categoria)));
  // 9/11: el repaso tiene que mirar lo que la clienta escribió y nadie contestó: desde el último mensaje nuestro (de Mabel o del equipo) anterior a este pase
  const { data: ultNuestro } = await sb.from('mabel_mensajes').select('creado').eq('tel_key', ctx.telKey).in('direccion', ['out', 'echo']).not('tipo', 'in', '(edit,revoke,reaction,system,ephemeral,unsupported)').order('creado', { ascending: false }).limit(1);
  const revisarDesde = ultNuestro?.[0]?.creado ? new Date(ultNuestro[0].creado).toISOString() : null;
  // 14/11 (punto 8): ya no se calla por "otro pase en las últimas 6 h". Solo se calla si ya había un pendiente del MISMO tema (repetido).
  const datos = { id: ctx.telKey, tel: c?.datos?.tel || '0' + ctx.telKey, clienteId: c?.id || null, estado: 'yanaina', motivo: String(motivo || 'Sin motivo').slice(0, 200), desde: ahora.toISOString(), hasta: hasta.toISOString() , derivadoEn: ahora.toISOString(), derivadoAntes: prev.derivadoEn || null, paseDesde, ...(fraseAviso ? { fraseAviso } : {}), ...(repetido && prev.avisado ? { avisado: prev.avisado } : {}), ...(prev.pagoRevision ? { pagoRevision: prev.pagoRevision } : {}), ...(revisarDesde ? { revisarDesde } : {}), ...(silencio ? { silencio: true } : {}), ...(repetido && !silencio ? { repetido: true } : {}), ...(!silencio && !repetido && !ctx.repaso ? { espera: ahora.toISOString() } : {}), ...(prev.repaso ? { repaso: prev.repaso } : {}), ...(prev.buscar ? { buscar: prev.buscar } : {}) };
  const { error } = await sb.from('conversaciones').upsert({ id: ctx.telKey, datos, borrado: false, actualizado: ahora.toISOString() }, { onConflict: 'id' });
  if (error) throw new Error(error.message);
  ctx.derivado = true;
  if (silencio) return { ok: true, derivado: true, en_silencio: true, instruccion: 'Quedó para Yanaina en silencio: NO le escribas nada a la clienta sobre esto (ni "le aviso a Yanaina"). Si no hay otra cosa para contestarle, respondé exactamente "(sin mensaje)".' };
  if (sinAviso) ctx.paseSinAviso = true;
  if (repetido) return { ok: true, derivado: true, ya_estaba_pendiente: true, instruccion: 'Ya había un pase de este mismo tema esperando a Yanaina: quedó sumado. NO le repitas que le avisás a Yanaina. Si la clienta preguntó otra cosa que podés contestar, contestala; si no, respondé exactamente "(sin mensaje)".' };
  const notaSinAviso = sinAviso ? { nota_pase: 'Ya había un pase de este tema, pero todavía no se le avisó a la clienta: decile la frase ahora (una sola vez).' } : {};
  if (fraseCaso) return { ok: true, derivado: true, mensaje_para_la_clienta: fraseCaso, ...notaSinAviso };
  if (frasePropia && categoria !== 'yharol') return { ok: true, derivado: true, instruccion: 'Quedó para Yanaina. Decile solo la frase propia del caso, sin otra frase de pase.', ...notaSinAviso };
  return { ok: true, derivado: true, mensaje_para_la_clienta: frasePase(ctx, categoria), ...notaSinAviso, ...(silencioNegado ? { nota: 'No va en silencio: nadie del equipo le escribió en la última hora. Decile mensaje_para_la_clienta.' } : {}) };
}

// 14/11 (MAR-04): ¿es solo un agradecimiento o un "ok"? Mira todas las palabras ("ok gracias", "bien", "Mu has gracias 😘").
const PAL_ACK = new Set('ok oka okay okey oki okis dale listo genial perfecto bueno buenisimo bien gracias muchas mil bella bellas a vos igualmente un una beso besos besito besitos aguardo espero respuesta quedo atenta joya barbaro divino divina hermoso hermosa lindo linda super ahi va si sii claro de nada saludos abrazo abrazos amor mu has tranqui todo ya entendido entiendo vale sticker reaction te tu para mi mabel yanaina muy amable amables genia genias divinas buenisimo perfecta dios bendiciones bendicion chau nos vemos hablamos ahi'.split(' ')); // 26/11: "gracias mabel muy amable"
export function esAck(texto: string) {
  const t = String(texto || '');
  if (t.includes('?')) return false;
  const w = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-zñ\s]/g, ' ').split(/\s+/).filter(Boolean);
  if (!w.length) return true;
  if (w.length > 8) return false;
  return w.every((x) => PAL_ACK.has(x) || /^(ja)+j?$|^(je)+$|^gra+cias+$|^o+k+$|^s+i+$|^bes+o+s*$/.test(x));
}
/** ¿Hay una pregunta? (signo de pregunta o arranca como pregunta) */
export const esPregunta = (texto: string) => /\?/.test(String(texto || '')) || /^\s*(c[oó]mo|cu[aá]ndo|cu[aá]nto|cu[aá]l|d[oó]nde|qu[eé]|por qu[eé]|me (pas[aá]s|dec[ií]s|mand[aá]s|confirm[aá]s)|pod[eé]s|puedo|se puede|hay|tienen|ten[eé]s|sale|llega|ya (sali[oó]|est[aá]))(?!\p{L})/iu.test(String(texto || ''));

// ─── actualizar_nota ──────────────────────────────────────────
export async function actualizarNota(ctx: Ctx, texto: string) {
  if (!ctx.clienta) return { error: 'No hay ficha de clienta para este número; no se guardó la nota.' };
  const t = String(texto || '').trim().split('\n').slice(0, 3).join('\n').slice(0, 300);
  await conReintento(async () => {
    const { data } = await sb.from('clientas').select('*').eq('id', ctx.clienta.id).single();
    const d = { ...data.datos }; if (t) d.notaMabel = t; else delete d.notaMabel;
    await guardarClienta(data, d);
  });
  return { ok: true, nota: t };
}

// ─── marcar_pagado ───────────────────────────────────────────────
async function comprobanteReciente(ctx: Ctx): Promise<Ctx['media']> {
  const { data } = await sb.from('mabel_mensajes').select('media,creado').eq('tel_key', ctx.telKey).eq('direccion', 'in').not('media', 'is', null).gte('creado', new Date(Date.now() - 48 * 3600e3).toISOString()).order('creado', { ascending: false }).limit(5);
  for (const m of data || []) {
    const md: any = m.media; if (!md?.path) continue;
    if (md.sha256) { const { data: dup } = await sb.from('pagos').select('id').eq('borrado', false).filter('datos->>sha256', 'eq', md.sha256).limit(1); if (dup?.length) continue; }
    return { path: md.path, sha256: md.sha256 || '', mime: md.mime || 'image/jpeg' };
  }
  return null;
}
export async function marcarPagado(ctx: Ctx, a: { cuenta: string; monto: number; fecha_comprobante?: string; destino_coincide?: boolean; nota?: string; destino?: string; titular_destino?: string; banco?: string; ordenante?: string; hora_comprobante?: string; numero_operacion?: string }) {
  const cfg = await leerConfig(), tar = tarifaDe(cfg), mp = mpDe(cfg);
  if (!ctx.clienta) return derivar(ctx, 'No hay ficha de clienta para este número (llegó un comprobante)', 'pago');
  const cuentas = cuentasDe(cfg).filter((x) => medioDe(x) !== 'efectivo');
  const ocultas = [...CUENTAS_SOLO_MARCAR, ...(Array.isArray(cfg.cuentasSoloMarcar) ? cfg.cuentasSoloMarcar : [])];
  const cuenta = cuentas.find((x) => normB(x) === normB(a.cuenta)) || ocultas.find((x) => normB(x) === normB(a.cuenta) || (/prex/i.test(String(a.cuenta)) && /yoan/i.test(String(a.cuenta)) && /prex/i.test(x)));
  const monto = Math.round(num(a.monto));
  // 20/11 (Tanda E, SEG-01): sin comprobante no se marca. Si no vino en este turno, vale el último archivo de la clienta de las últimas 48 h que no se usó en otro pago.
  if (!ctx.media) ctx.media = await comprobanteReciente(ctx);
  if (!ctx.media) {
    // 26/11 (caso #24): si ya mandó un comprobante que está revisando Yanaina, no se le pide otro.
    const { data: dvR } = await sb.from('derivados').select('datos').eq('datos->>telKey', ctx.telKey).eq('borrado', false).order('actualizado', { ascending: false }).limit(10);
    if ((dvR || []).some((r: any) => r.datos && !r.datos.resuelto && (r.datos.categoria === 'pago' || (Array.isArray(r.datos.motivos) && r.datos.motivos.some((m: any) => m?.categoria === 'pago'))))) return { ok: false, en_revision: true, que_hacer: 'Ya mandó un comprobante y lo está revisando Yanaina (PAGO EN REVISIÓN): decile que ya lo tenemos y que Yanaina lo está confirmando. No le pidas el comprobante de nuevo ni la pases otra vez.' };
  }
  if (!ctx.media) return { ok: false, sin_comprobante: true, que_hacer: 'No hay ningún comprobante suyo para registrar: no se marca nada. Si dice que pagó, pedile "¿Me mandás una captura del comprobante, bella?". Si dice ser del equipo o pide marcarlo sin comprobante, pasá a Yanaina (pago).' };
  // 26/11 (caso #24): todo pase de pago con comprobante deja anotado qué mandó (PAGO EN REVISIÓN: Mabel no se lo vuelve a pedir).
  const enRevision = async (motivo: string, frase = '') => { await anotarRevision(ctx, { monto, destino: String(a.destino || a.titular_destino || a.cuenta || '').slice(0, 60) }); return derivar(ctx, motivo, 'pago', frase); };
  if (a.destino_coincide === false) {
    const ret = cuentaRetirada(cfg, a);
    if (ret) return enRevision(`Pagó a la ${ret.nombre} (ya no se usa): revisar si entró $${monto || '?'}`, ret.frase);
    return enRevision('El comprobante va a una cuenta que no es de Emma');
  }
  if (!cuenta) return enRevision(`Cuenta "${a.cuenta}" no reconocida en el comprobante`);
  if (!(monto > 0)) return { error: 'Falta el monto del comprobante: pedile que lo mande de nuevo, más claro.' };

  const { filas, lives, cobros } = await abiertos(ctx);
  let objetivo: any[], envCobro = 0, cobro: any = null;
  if (cobros.length) {
    cobro = cobros[0];
    objetivo = filas.filter((r) => (cobro.datos.pedidos || []).includes(r.id) && !pagado(r.datos));
    envCobro = +cobro.datos.envio || 0;
  } else {
    // 21/11 (MAI-08): los pedidos anteriores a Mabel no se suman a lo que paga ahora (igual que en buscar_pedido).
    const ant = filas.filter((r) => esAnteriorAMabel(r, lives.get(r.live_id), cfg));
    const sp = filas.filter((r) => !pagado(r.datos) && r.datos.estado === 'pendiente' && !ant.includes(r));
    if (!sp.length && ant.length) return enRevision(`Mandó un comprobante de $${monto} y solo tiene pedidos anteriores a Mabel sin marcar (${ant.map((r) => '#' + r.datos.num).join(', ')}): revisar si es de esos`);
    objetivo = sp;
    if (sp.length > 1) {
      // 4/11: varios pedidos sin pagar y sin cobro agrupado: si el monto cierra con el del último live, o con todos juntos, se marca eso
      const ult = [...sp].sort((x, y) => String(lives.get(y.live_id)?.fecha || '').localeCompare(String(lives.get(x.live_id)?.fecha || '')) || (y.datos.num - x.datos.num))[0];
      const cierra = (ps: any[]) => { const b = ps.reduce((s, r) => s + calcTotal(r.datos, lives.get(r.live_id)), 0); return [b, b + tar, Math.round(b * (1 + mp / 100)), Math.round((b + tar) * (1 + mp / 100))].some((e) => monto >= e - 2 && monto <= e + 30); };
      if (cierra([ult])) objetivo = [ult];
      else if (cierra(sp)) objetivo = sp;
      else return enRevision(`Tiene ${sp.length} pedidos sin pagar (${sp.map((r) => '#' + r.datos.num).join(', ')}) y el comprobante de $${monto} no coincide ni con el último ni con todos juntos`);
    }
  }
  if (!objetivo.length) return { error: 'No hay ningún pedido sin pagar para marcar. Si dice que ya pagó, pasalo a Yanaina.' };

  // Fecha del comprobante vs fecha del live
  const f = String(a.fecha_comprobante || '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(f)) {
    const fl = objetivo.map((r) => lives.get(r.live_id)?.fecha).filter(Boolean).sort()[0];
    if (fl && f < String(fl).slice(0, 10)) return enRevision(`Comprobante de fecha ${f}, anterior al live (${String(fl).slice(0, 10)})`);
  }
  // Comprobante ya usado
  if (ctx.media?.sha256) {
    const { data: dup } = await sb.from('pagos').select('id').eq('borrado', false).filter('datos->>sha256', 'eq', ctx.media.sha256).limit(1);
    if (dup?.length) return enRevision('Ese comprobante ya figura en otro pago');
  }
  // 21/11 (SEG-01 paso 3): otra captura del mismo comprobante tiene otra huella. Se compara lo leído: mismo monto, fecha y cuenta,
  // y además la misma hora o el mismo número de operación (sin hora ni número no se compara, para no frenar dos pagos iguales del mismo día).
  const hora = (String(a.hora_comprobante || '').match(/^(\d{1,2}):(\d{2})/) || []).slice(1, 3).map((x, i) => i ? x : x.padStart(2, '0')).join(':');
  const oper = String(a.numero_operacion || '').replace(/\D/g, '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(f) && (hora || oper.length >= 4)) {
    const { data: igu } = await sb.from('pagos').select('id,datos').eq('borrado', false).filter('datos->lectura->>fecha', 'eq', f).filter('datos->lectura->>monto', 'eq', String(monto)).limit(20);
    const rep = (igu || []).find((g: any) => normB(g.datos?.cuenta) === normB(cuenta) && ((hora && g.datos?.lectura?.hora === hora) || (oper.length >= 4 && g.datos?.lectura?.operacion === oper)));
    if (rep) return enRevision(`Ese comprobante ya figura en otro pago (mismo monto, fecha${hora ? ', hora' : ''}${oper.length >= 4 ? ', n° de operación' : ''} y cuenta)`);
  }
  // Esperado (sin cadetería, salvo cobro agrupado que ya la trae) y faltante
  const base = objetivo.reduce((s, r) => s + calcTotal(r.datos, lives.get(r.live_id)), 0);
  const esp = esperadoDe(base, envCobro, cuenta, mp);
  if (monto < esp.total) return enRevision(`Transfirió de menos (faltan $${esp.total - monto}) · esperado $${esp.total}, transfirió $${monto} por ${cuenta}`);

  // Registrar (misma lógica que registrarPagos de la app)
  const ajuste = monto - esp.total;
  const res = await conReintento(async () => {
    const frescas: any[] = [];
    for (const r of objetivo) { const { data } = await sb.from('pedidos').select('*').eq('id', r.id).single(); frescas.push(data); }
    await cargarModelos(frescas);
    if (frescas.some((r) => pagado(r.datos))) throw new Error('Alguno de los pedidos ya figura pagado');
    const orden = [...frescas].sort(porCreado);
    const hoy = hoyUY(), ahora = new Date().toISOString();
    const gs: any[] = [];
    for (const r of orden) {
      const p = JSON.parse(JSON.stringify(r.datos)); const g: any = { id: uid('g'), pedidoId: p.id, clienteId: p.clienteId, cuenta, medio: medioDe(cuenta), monto: calcTotal(p, lives.get(r.live_id)), fecha: ahora, origen: cobro ? 'cobro' : 'mabel', antes: p.estado };
      p.pago = { id: g.id, cuenta, fecha: ahora };
      if (p.estado === 'pendiente') { p.estado = 'listo'; p.fechas = p.fechas || {}; p.fechas.listo = hoy; }
      gs.push({ g, p, r });
    }
    const g0 = gs[gs.length - 1].g;
    g0.envio = envCobro; g0.recargo = esp.rec; g0.esperado = esp.total; g0.ajuste = ajuste; g0.monto = (+g0.monto || 0) + envCobro + esp.rec + ajuste;
    g0.origen = cobro ? 'cobro' : 'mabel';
    if (a.nota) g0.nota = String(a.nota).slice(0, 200);
    { // 20/11 (Tanda E, MAI-01): lo que Mabel leyó del comprobante, para revisarlo después
      const lec: any = { monto, ...(f ? { fecha: f } : {}), ...(hora ? { hora } : {}), ...(oper.length >= 4 ? { operacion: oper.slice(0, 30) } : {}), ...(a.destino ? { destino: String(a.destino).slice(0, 80) } : {}), ...(a.titular_destino ? { titular_destino: String(a.titular_destino).slice(0, 80) } : {}), ...(a.banco ? { banco: String(a.banco).slice(0, 40) } : {}), ...(a.ordenante ? { ordenante: String(a.ordenante).slice(0, 80) } : {}), cuenta_dicha: String(a.cuenta || '').slice(0, 40) };
      g0.lectura = lec;
    }
    if (ctx.media) { g0.comprobante = ctx.media.path; g0.sha256 = ctx.media.sha256; }
    if (cobro) gs.forEach(({ g }) => { g.cobroId = cobro.id; });
    if (cobro && envCobro > 0) gs.forEach(({ p }) => { p.pago.conEnvio = true; p.entrega = 'cadeteria'; p.cobroEnvio = 'pago'; p.cobroMonto = 0; });
    for (const { p, r } of gs) await guardarPedido(r, p);
    const { error } = await sb.from('pagos').insert(gs.map(({ g }) => ({ id: g.id, pedido_id: g.pedidoId, cuenta: g.cuenta, monto: g.monto, fecha: g.fecha, comprobante: g.comprobante || null, datos: g, borrado: false })));
    if (error) throw new Error('No se pudo guardar el pago: ' + error.message);
    if (cobro) {
      const k = { ...cobro.datos, estado: 'pagado', pagos: gs.map(({ g }) => g.id), pagado: ahora };
      await sb.from('cobros').update({ datos: k, actualizado: ahora }).eq('id', cobro.id);
    }
    return gs.map(({ p }) => p.num);
  });
  // 26/11 (Parte A): si había pedidos guardados esperando a este, vuelven a Despacho y salen juntos. Si pagó el viejo y tiene otro sin pagar de otro vivo, se le pregunta si lo guarda.
  let juntosTxt = '';
  try {
    const marcados = objetivo.map((r) => r.id);
    const esp = filas.filter((r) => r.datos.estado === 'guardado' && marcados.includes(r.datos.esperaPedido));
    if (esp.length) {
      await revisarEsperas(ctx.clientas.map((k) => k.id), ctx.clienta?.datos?.nombre || '');
      const ns = [...esp.map((r) => r.datos.num), ...objetivo.map((r) => r.datos.num)];
      juntosTxt = `Primero decile "Recibido ✅ Te mandamos los ${ns.length === 2 ? 'dos' : ns.length} pedidos juntos (${ns.slice(0, -1).map((n) => '#' + n).join(', ')} y #${ns[ns.length - 1]})." y en el mismo mensaje seguí con la entrega (si figura como_la_otra_vez, ofrecé esa). `;
    } else {
      const otro = filas.filter((r) => !marcados.includes(r.id) && r.datos.estado === 'pendiente' && !pagado(r.datos) && (r.datos.prendas || []).length && !objetivo.some((o) => o.live_id === r.live_id)).sort((a, b) => b.datos.num - a.datos.num)[0];
      if (otro) juntosTxt = `Tiene otro pedido sin pagar (#${otro.datos.num}). En vez de preguntar la entrega, preguntale "¿Te lo guardamos para mandarlo junto con el #${otro.datos.num}?". Si dice que sí, llamá guardar_pedido con junto_con=${otro.datos.num}; si dice que no, seguí con la entrega. `;
    }
  } catch (e) { console.error('esperas (pago):', (e as Error).message || e); }
  // 20/11 (Tanda D, pregunta 7): con saldo a favor y un pago de más, lo de más lo ve Yanaina (puede haber pagado sin descontar el saldo).
  const saldoCli = num(ctx.clienta?.datos?.saldoFavor);
  if (saldoCli > 0 && ajuste > 30) {
    await registrarDerivado(ctx.telKey, ctx.clienta, `Pagó $${ajuste} de más y tiene $${saldoCli} de saldo a favor: revisar si pagó sin descontar el saldo`, 'pago', true, 'mabel', ctx.inicio);
    return { ok: true, pedidos_marcados: res, cuenta, esperado: esp.total, transferido: monto, diferencia: ajuste, que_hacer: juntosTxt + 'Quedó pagado. Lo de más ya lo ve Yanaina: no le preguntes por la diferencia ni la pases. Seguí con cómo recibe el pedido.' };
  }
  return {
    ok: true, pedidos_marcados: res, cuenta, esperado: esp.total, transferido: monto, diferencia: ajuste,
    que_hacer: juntosTxt + (ajuste <= 30 ? 'Es redondeo o exacto: no digas nada de la diferencia. Seguí con cómo recibe el pedido.'
      : ajuste === tar ? `Sobran justo $${tar}: preguntale "¿los $${tar} de más son para la cadetería?". Si dice que sí, guardá la entrega con tipo cadetería y envio_transferido=${tar}.`
      : `Sobran $${ajuste}: preguntale por qué ("Vi que transferiste $${monto} y era $${esp.total}, ¿es por algo en especial?"). Si dice que es por la cadetería (vale $${tar}), guardá la entrega con envio_transferido=${ajuste} y avisale cuánto falta ($${tar - ajuste}) que se lo paga al cadete. Si es por otra cosa o no queda claro, pasalo a Yanaina con la diferencia.`),
  };
}
async function derivar(ctx: Ctx, motivo: string, categoria?: string, frase = '') { const r = await pasarAYanaina(ctx, motivo, false, categoria || categoriaDe(motivo), false, frase); return { ...r, ok: false, motivo }; }
// 26/11: lo que mandó la clienta y quedó para que Yanaina lo revise (conversaciones.datos.pagoRevision). Lo lee atender (PAGO EN REVISIÓN).
async function anotarRevision(ctx: Ctx, r: { monto: number; destino: string }) {
  try {
    let fecha = new Date().toISOString();
    if (ctx.media?.path) { const { data: mm } = await sb.from('mabel_mensajes').select('creado').eq('tel_key', ctx.telKey).eq('direccion', 'in').filter('media->>path', 'eq', ctx.media.path).limit(1); if (mm?.[0]?.creado) fecha = new Date(mm[0].creado).toISOString(); }
    const { data: cv } = await sb.from('conversaciones').select('datos').eq('id', ctx.telKey).maybeSingle();
    const d = { ...(cv?.datos || { id: ctx.telKey, estado: 'agente' }), pagoRevision: { fecha, monto: r.monto || 0, destino: r.destino } };
    await sb.from('conversaciones').upsert({ id: ctx.telKey, datos: d, borrado: false, actualizado: new Date().toISOString() }, { onConflict: 'id' });
  } catch (e) { console.error('pagoRevision:', (e as Error).message || e); }
}

// ─── guardar_entrega ───────────────────────────────────────────
const AVISO_BARRIO = 'Falta el barrio de la cadetería';
// 15/11 (Yoan, caso La Morocha): para agencia el nombre de quien retira es obligatorio (va en la etiqueta). Si falta, se carga igual, queda el aviso en Despacho y Mabel lo pregunta.
const AVISO_NOMBRE = 'Falta el nombre de quien retira';
export async function guardarEntrega(ctx: Ctx, a: any) {
  if (!ctx.clienta) return derivar(ctx, 'No hay ficha de clienta para este número (eligió entrega)', 'entrega');
  const cfg = await leerConfig(), tar = tarifaDe(cfg);
  const tipo = String(a.tipo || '');
  if (!['retiro', 'cadeteria', 'agencia'].includes(tipo)) return { error: 'tipo tiene que ser retiro, cadeteria o agencia' };
  const { filas, cobros, lives } = await abiertos(ctx);
  let objetivo = filas.filter((r) => ['pendiente', 'listo'].includes(r.datos.estado));
  if (!objetivo.length && !cobros.length) objetivo = filas.filter((r) => r.datos.estado === 'guardado' && pagado(r.datos)); // guardado con pago: se le puede dejar anotada la entrega
  if (cobros.length) { const ids = cobros[0].datos.pedidos || []; objetivo = filas.filter((r) => ids.includes(r.id)); }
  // 4/11: con varios pedidos abiertos la entrega se carga en todos (salen juntos)
  if (!objetivo.length) return { error: 'No hay pedido abierto al que cargarle la entrega. Pasalo a Yanaina.' };

  const s = (v: any) => String(v ?? '').trim();
  const cambiosCli: Record<string, string> = {};
  const extraCli: any = { ultimaEntrega: { tipo, fecha: hoyUY() } }; // 26/11: cómo pidió que le llegue la última vez
  const hint: any = {};
  // 11/11 (Yoan, caso Xime): el barrio ya no frena la carga. Si falta o no se reconoce, la cadetería se carga igual con la dirección,
  // queda el aviso "Falta el barrio" en Despacho y Mabel lo pregunta una sola vez; si la clienta contesta, se vuelve a llamar con el barrio.
  let faltaBarrio = false, faltaNombre = false, opBarrio: string[] = [];
  let horarioSet: string | null = null, preguntarHorario = false; // 24/11: horario de ESTE envío ('' = sin horario)
  if (tipo === 'cadeteria') {
    if (!s(a.direccion)) return { error: 'Falta la dirección.' };
    const barrio = barrioCanon(s(a.barrio));
    if (!barrio) { faltaBarrio = true; opBarrio = s(a.barrio) ? barrioOpciones(s(a.barrio)) : []; }
    cambiosCli.direccion = s(a.direccion); if (barrio) cambiosCli.barrio = barrio;
    if (s(a.nombre_retira)) cambiosCli.nombreEnvio = s(a.nombre_retira);
    // 26/11 (caso #17): la ficha no queda mezclada. La agencia de antes pasa a agenciaAnterior (no se pierde) y se vacía.
    { const f0 = ctx.clienta?.datos || {}; if (s(f0.agencia) || s(f0.ciudad)) { extraCli.agenciaAnterior = { agencia: s(f0.agencia), ciudad: s(f0.ciudad), depto: s(f0.depto) }; cambiosCli.agencia = ''; cambiosCli.ciudad = ''; cambiosCli.depto = ''; } }
    // 24/11 (caso Carolina #85): la nota del cadete es solo lo fijo (timbre, portón, apto). Si Mabel reenvía lo que ya está en la ficha
    // (o el horario guardado), no se toca: el horario va aparte y nunca sale solo.
    const fichaC = ctx.clienta?.datos || {}, nc = s(a.nota_cadete);
    if (nc && normD(nc) !== normD(fichaC.notaCadete) && normD(nc) !== normD(fichaC.horarioPref)) cambiosCli.notaCadete = nc;
    if (a.sin_horario === true) { cambiosCli.horarioPref = ''; horarioSet = ''; }
    else if (s(a.horario_envio)) { cambiosCli.horarioPref = s(a.horario_envio).slice(0, 120); horarioSet = cambiosCli.horarioPref; }
    preguntarHorario = !!s(fichaC.horarioPref) && horarioSet === null && !objetivo.some((r) => s(r.datos.horarioEnvio) || r.datos.horarioPreguntado); // se pregunta una sola vez por envío
  } else if (tipo === 'agencia') {
    if (!s(a.agencia) || !s(a.ciudad)) return { error: 'Faltan la agencia y la ciudad.' };
    // 24/11 (Yoan, casos Rita y Mel): el departamento es obligatorio en agencia. Vale el de la ficha solo si es la misma ciudad.
    const fichaV = ctx.clienta?.datos || {}, mismaCiudad = normD(fichaV.ciudad) === normD(a.ciudad);
    // 26/11 (caso #17): agencia con departamento Montevideo y una ciudad de otro departamento, o con dirección de casa (calle y número):
    // no cierra. No se guarda y se pregunta una vez cadete o agencia (salvo que ya lo confirmó: confirma_agencia).
    {
      const dep = s(a.departamento) || (mismaCiudad ? s(fichaV.depto) : '');
      const ciudadMvd = normD(a.ciudad) === 'montevideo' || !!barrioCanon(s(a.ciudad));
      const dirCasa = /\p{L}[\p{L}.']*(\s+\p{L}[\p{L}.']*)*\s+(n[°º.]?\s*)?\d{2,5}\b/u.test(s(a.direccion));
      if (normD(dep) === 'montevideo' && (!ciudadMvd || dirCasa) && a.confirma_agencia !== true) return { error: 'Los datos no cierran con agencia (Montevideo + dirección de casa). No se guardó nada. Preguntale una vez: ¿te lo mandamos con cadete a esa dirección o por agencia? Si elige cadete, guardá la entrega con tipo cadeteria (dirección y barrio). Si confirma agencia, volvé a llamar con confirma_agencia=true.', no_cierra: true };
    }
    if (!s(a.departamento) && !(mismaCiudad && s(fichaV.depto))) return { error: 'Falta el departamento. No es una falla: no se cargó nada. Preguntale a la clienta "¿De qué departamento, bella?" (no lo deduzcas por el nombre de la ciudad) y volvé a llamar guardar_entrega con departamento.', falta_departamento: true };
    cambiosCli.agencia = s(a.agencia); cambiosCli.ciudad = s(a.ciudad);
    if (s(a.nombre_retira)) cambiosCli.nombreEnvio = s(a.nombre_retira);
    if (s(a.ci)) cambiosCli.ci = s(a.ci);
    // 24/11 (caso Rita): si cambia la ciudad, la dirección se reemplaza entera; lo que no venga queda vacío (no se arrastra la de la ficha).
    if (!mismaCiudad) { cambiosCli.depto = ''; cambiosCli.direccion = ''; cambiosCli.barrio = ''; cambiosCli.notaCadete = ''; }
    if (s(a.departamento)) cambiosCli.depto = s(a.departamento);
    // 24/11 (caso esquina 33 y Río Negro): la calle o esquina va en direccion, no solo en la nota.
    if (s(a.direccion)) cambiosCli.direccion = s(a.direccion);
    if (s(a.barrio)) cambiosCli.barrio = s(a.barrio);
    hint.agencia_habitual = esHabitual(cambiosCli.agencia);
    faltaNombre = !s(a.nombre_retira) && !s(ctx.clienta?.datos?.nombreEnvio);
  }
  // 20/11 (Tanda D, D-13): retiro sin pagar, como máximo hasta la fecha de pago del vivo (salvo clientas con la marca de confianza).
  let retiroLejos = '';
  if (tipo === 'retiro' && /^\d{4}-\d{2}-\d{2}$/.test(s(a.retiro_fecha)) && !ctx.clienta?.datos?.puedeGuardarSinPagar) {
    const sinPago = objetivo.filter((r) => !pagado(r.datos));
    const tope = sinPago.map((r) => String(lives.get(r.live_id)?.datos?.fechaPagoISO || '')).filter(Boolean).sort().pop() || '';
    if (sinPago.length && tope && s(a.retiro_fecha) > tope) retiroLejos = tope;
  }
  // 20/11 (Tanda D, pregunta 9): pasa de cadetería con el envío transferido a otra entrega: el envío queda como saldo a favor.
  let envioASaldo = 0;
  if (tipo !== 'cadeteria') for (const r of objetivo) { const p0 = r.datos; if (p0.entrega === 'cadeteria' && p0.cobroEnvio === 'pago' && p0.pago) { envioASaldo = tar; break; } }
  const cambio = !!a.con_cambio, tarE = cambio ? Math.round(tar * 1.5) : tar; // 4/11: si el cadete además lleva/retira un cambio, cobra un envío y medio
  const pedido_x = Math.max(0, Math.min(tarE, Math.round(num(a.envio_transferido))));
  // 21/11 (MAI-01): el envío cuenta como transferido solo si sobra en un pago ya registrado (lo de más del pago, o lo que ya se le había asignado al envío).
  // Sin pago registrado, o si el pago vino justo, el cadete cobra la tarifa: decirlo no alcanza.
  let x = 0, pagoEnvio: any = null;
  if (tipo === 'cadeteria' && pedido_x > 0) {
    const ids = [...new Set(objetivo.map((r) => r.datos.pago?.id).filter(Boolean))];
    if (ids.length) {
      const { data: gs } = await sb.from('pagos').select('*').in('id', ids).eq('borrado', false);
      const disp = (g: any) => Math.max(0, num(g.datos?.ajuste)) + Math.max(0, num(g.datos?.envio));
      pagoEnvio = (gs || []).sort((u: any, v: any) => disp(v) - disp(u))[0] || null;
      if (pagoEnvio) x = Math.min(pedido_x, disp(pagoEnvio));
    }
  }
  const envioNoFigura = tipo === 'cadeteria' && pedido_x > x;
  await conReintento(async () => {
    {
      const { data } = await sb.from('clientas').select('*').eq('id', ctx.clienta.id).single();
      if (tipo === 'cadeteria' && !cambiosCli.barrio) {
        // Sin barrio nuevo: si es la misma dirección de la ficha y ya tenía barrio, vale ese; si es otra dirección, el barrio viejo no corresponde
        const guardada = (Array.isArray(data.datos.direcciones) ? data.datos.direcciones : []).find((x: any) => normD(x.direccion) === normD(cambiosCli.direccion));
        const conocido = (normD(data.datos.direccion) === normD(cambiosCli.direccion) && s(data.datos.barrio)) || s(guardada?.barrio);
        if (conocido) { cambiosCli.barrio = conocido; faltaBarrio = false; } else cambiosCli.barrio = '';
      }
      const extra: any = tipo === 'cadeteria' ? { direcciones: sumarDireccion(data.datos, cambiosCli.direccion, cambiosCli.barrio, s(a.etiqueta).toLowerCase()) } : {};
      await guardarClienta(data, { ...data.datos, ...cambiosCli, ...extraCli, ...extra });
    }
    for (const r of objetivo) {
      const { data } = await sb.from('pedidos').select('*').eq('id', r.id).single();
      const p = JSON.parse(JSON.stringify(data.datos)); p.entrega = tipo;
      if (s(a.nota_interna) && !String(p.notas || '').includes(s(a.nota_interna))) { const n = '📦 ' + s(a.nota_interna).slice(0, 150); p.notas = p.notas ? String(p.notas) + '\n' + n : n; }
      if (tipo === 'retiro') { if (!pagado(p)) p.pagaAlRetirar = true; else delete p.pagaAlRetirar; if (s(a.horario_retiro)) { const f = s(a.retiro_fecha), hh = s(a.retiro_hora).match(/^(\d{1,2}):(\d{2})$/); p.retiroCuando = { texto: s(a.horario_retiro).slice(0, 80), ...(/^\d{4}-\d{2}-\d{2}$/.test(f) ? { fecha: f } : {}), ...(hh && +hh[1] < 24 && +hh[2] < 60 ? { hora: hh[1].padStart(2, '0') + ':' + hh[2] } : {}) }; if (!p.retiroCuando.fecha) delete p.retiroCuando.hora; } if (s(a.horario_retiro)) { const n = '🕒 Pasa a retirar: ' + s(a.horario_retiro).slice(0, 80) + ' (le dijo a Mabel)'; p.notas = p.notas ? String(p.notas).replace(/🕒 Pasa a retirar:[^\n]*/, '').trim() + (String(p.notas).replace(/🕒 Pasa a retirar:[^\n]*/, '').trim() ? '\n' : '') + n : n; } }
      else { delete p.pagaAlRetirar; delete p.retiroCuando; }
      if (tipo !== 'cadeteria' && envioASaldo) { delete p.cobroEnvio; delete p.cobroMonto; if (p.pago) p.pago.conEnvio = false; }
      { // aviso de Despacho por el barrio: se pone si falta y se saca cuando se completa o cambia la entrega
        const partes = String(p.avisoDespacho || '').split(' · ').map((t: string) => t.trim()).filter((t: string) => t && t !== AVISO_BARRIO && t !== AVISO_NOMBRE);
        if (tipo === 'cadeteria' && faltaBarrio) partes.unshift(AVISO_BARRIO);
        if (tipo === 'agencia' && faltaNombre) partes.unshift(AVISO_NOMBRE);
        const av = partes.join(' · ').slice(0, 200); if (av) p.avisoDespacho = av; else delete p.avisoDespacho;
      }
      if (tipo !== 'cadeteria' || horarioSet === '') delete p.horarioEnvio; else if (horarioSet) p.horarioEnvio = horarioSet;
      if (preguntarHorario && !faltaBarrio) p.horarioPreguntado = true; else if (tipo !== 'cadeteria') delete p.horarioPreguntado;
      if (tipo === 'cadeteria') {
        p.tipoEnvio = p.tipoEnvio || 'comun';
        if (x >= tarE) { p.cobroEnvio = 'pago'; p.cobroMonto = 0; } else if (x > 0 || cambio) { p.cobroEnvio = 'monto'; p.cobroMonto = tarE - x; } else { p.cobroEnvio = 'cobrar'; p.cobroMonto = 0; }
        if (cambio) { const n = '🔄 Con cambio: el cadete cobra un envío y medio ($' + tarE + ')'; if (!String(p.notas || '').includes('Con cambio')) p.notas = p.notas ? String(p.notas) + '\n' + n : n; }
        if (p.pago && x > 0) p.pago.conEnvio = x >= tarE;
      }
      await guardarPedido(data, p);
      // El envío ya transferido va a la fila de pago más nueva del pedido (misma convención que la app: envio, ajuste)
      if (tipo === 'cadeteria' && x > 0 && pagoEnvio && p.pago?.id === pagoEnvio.id) {
        const { data: g } = await sb.from('pagos').select('*').eq('id', pagoEnvio.id).single();
        const prev = Math.max(0, num(g?.datos?.envio)), aj = num(g?.datos?.ajuste);
        if (g && aj + prev >= x && prev !== x) { const d = { ...g.datos, envio: x, ajuste: aj + prev - x, esperado: num(g.datos.esperado) - prev + x }; await sb.from('pagos').update({ datos: d, actualizado: new Date().toISOString() }).eq('id', g.id); }
      }
    }
  });
  const cadete = tipo === 'cadeteria' ? (x >= tarE ? 0 : tarE - x) : null;
  if (envioASaldo) {
    await conReintento(async () => { const { data } = await sb.from('clientas').select('*').eq('id', ctx.clienta.id).single(); await guardarClienta(data, { ...data.datos, saldoFavor: num(data.datos.saldoFavor) + envioASaldo }); });
    await registrarDerivado(ctx.telKey, ctx.clienta, `Pasó de cadetería (envío transferido) a ${tipo}: los $${envioASaldo} del envío quedaron como saldo a favor`, 'entrega', true, 'mabel', ctx.inicio);
  }
  if (retiroLejos) {
    const d = await derivar(ctx, `Quiere retirar y pagar el ${s(a.retiro_fecha)}, después del plazo de pago (${retiroLejos}): autorizar`, 'pago');
    return { ...d, entrega_guardada: true, que_hacer: 'El retiro quedó anotado, pero pagar después del plazo lo autoriza Yanaina: no le confirmes la fecha. Decile solo mensaje_para_la_clienta.' };
  }
  return {
    ...(envioASaldo ? { envio_a_saldo: envioASaldo, que_hacer_saldo: `Decile que los $${envioASaldo} del envío que transfirió le quedan como saldo a favor para la próxima compra.` } : {}),
    ok: true, tipo, pedidos: objetivo.map((r) => r.datos.num), ...hint,
    ...(cadete !== null ? { el_cadete_cobra: cadete } : {}),
    ...(envioNoFigura ? { envio_no_figura_en_el_pago: true, que_hacer_envio: x > 0 ? `En el pago registrado sobran solo $${x} para el envío: el cadete cobra $${cadete}. Decile cuánto le cobra el cadete, sin discutir.` : `El envío no figura en ningún pago registrado (el pago vino justo o todavía no pagó): el cadete cobra $${cadete}. Decíselo una vez ("El cadete te cobra los $${cadete} del envío al recibir"). Si dice que lo transfirió aparte, pedile la captura de esa transferencia y pasá a Yanaina (pago) con "Dice que transfirió el envío aparte".` } : {}),
    ...(tipo === 'retiro' ? { paga_al_retirar: objetivo.some((r) => !pagado(r.datos)) } : {}),
    ...(tipo === 'cadeteria' && faltaBarrio ? { falta_barrio: true, ...(opBarrio.length ? { opciones: opBarrio } : {}), que_hacer: 'La cadetería YA quedó cargada con la dirección y sale igual. ' + (opBarrio.length ? 'El barrio no es exacto: preguntale cuál de estas opciones es (sin decir que es una lista).' : s(a.barrio) ? 'Ese barrio no está en la lista de GrisalExpress: preguntáselo una vez más (puede estar mal escrito).' : 'Preguntale el barrio.') + ' Una sola vez y en el mismo mensaje del cierre. Si lo contesta, volvé a llamar guardar_entrega con la misma dirección y el barrio. Si no contesta, no insistas ni lo repitas en otro mensaje: el equipo lo completa.' } : {}),
    ...(tipo === 'cadeteria' && !faltaBarrio && preguntarHorario ? { horario_guardado: s(ctx.clienta?.datos?.horarioPref), que_hacer_horario: 'Tiene un horario guardado de otra vez, pero NO va en este envío hasta que lo confirme. Preguntáselo una vez con mensaje_de_cierre. Si lo confirma o da otro, volvé a llamar guardar_entrega con horario_envio; si dice que no hay restricción, con sin_horario=true. Si no contesta eso, no insistas: sale sin horario.' } : {}),
    ...(tipo === 'agencia' && faltaNombre ? { falta_nombre: true, que_hacer: 'La agencia YA quedó cargada. Falta el nombre y apellido de quien retira en la agencia (va en la etiqueta): preguntáselo una vez, en este mismo mensaje. Cuando lo diga, volvé a llamar guardar_entrega con nombre_retira.' } : {}),
    ...(tipo === 'agencia' && !faltaNombre && !s(a.nombre_retira) ? { nombre_guardado: s(ctx.clienta?.datos?.nombreEnvio), que_hacer: 'Se usó el nombre guardado: preguntale solo si lo mandamos a ese nombre (mensaje_de_cierre), sin cerrar todavía. Cuando lo confirme o dé otro, volvé a llamar guardar_entrega con nombre_retira y usá el mensaje_de_cierre que devuelva.' } : {}),
    mensaje_de_cierre: tipo === 'agencia' && !faltaNombre && !s(a.nombre_retira) ? `Listo, anotado. ¿Lo mandamos a nombre de ${s(ctx.clienta?.datos?.nombreEnvio)} como la otra vez?` : tipo === 'agencia' && faltaNombre ? 'Listo, anotado. ¿A nombre de quién lo mandamos? Pasame nombre y apellido de quien lo retira en la agencia.' : tipo === 'cadeteria' && faltaBarrio ? 'Listo, ya lo tenemos anotado. ¿Me pasás el barrio así queda completo? La cadetería te manda un WhatsApp para confirmar la entrega 🚚' : tipo === 'cadeteria' && preguntarHorario ? `Listo, ya lo tenemos anotado. La otra vez nos dijiste "${s(ctx.clienta?.datos?.horarioPref)}", ¿sigue igual para este envío?` : tipo === 'cadeteria' && horarioSet ? 'Listo, le dejamos el horario al cadete. La cadetería te manda un WhatsApp para confirmar la entrega 🚚' : tipo === 'cadeteria' ? 'Listo, ya lo tenemos anotado. La cadetería te manda un WhatsApp para confirmar la entrega 🚚' : tipo === 'agencia' ? 'Listo, anotado. Cuando salga te mandamos la foto del comprobante de envío.' : 'Listo, anotado. ¡Te esperamos!',
  };
}

// ─── dejar_aviso_despacho (7/11) ──────────────────────────────
// Un aviso corto para quien cierra el paquete en Despacho ("tiene paquete de Yharol, enviar junto"). Va en los pedidos abiertos de la clienta
// y la app lo muestra arriba mientras el pedido no salió; cuando sale, se olvida con el pedido.
export async function dejarAvisoDespacho(ctx: Ctx, a: any) {
  if (!ctx.clienta) return { error: 'No hay ficha de clienta para este número.' };
  const texto = String(a?.texto ?? '').trim().slice(0, 120);
  if (!texto) return { error: 'Falta el texto del aviso.' };
  const { filas } = await abiertos(ctx);
  const objetivo = filas.filter((r) => ['pendiente', 'listo', 'guardado'].includes(r.datos.estado));
  if (!objetivo.length) return { ok: false, error: 'No hay pedido abierto para dejarle el aviso.' };
  await conReintento(async () => {
    for (const r of objetivo) {
      const { data } = await sb.from('pedidos').select('*').eq('id', r.id).single();
      const p = JSON.parse(JSON.stringify(data.datos));
      const previo = String(p.avisoDespacho || '').trim();
      if (previo.toLowerCase().includes(texto.toLowerCase())) continue;
      p.avisoDespacho = (previo ? previo + ' · ' : '') + texto;
      if (p.avisoDespacho.length > 200) p.avisoDespacho = p.avisoDespacho.slice(0, 200);
      await guardarPedido(data, p);
    }
  });
  return { ok: true, pedidos: objetivo.map((r) => r.datos.num) };
}

// ─── vincular_pedido (4/11) ───────────────────────────────────
// La clienta escribe desde un número que no está en ningún pedido ("soy Ale, te pedí una remera", "confirmo el pedido 34").
// Busca en los lives de hoy y ayer un pedido sin teléfono que coincida con el número de pedido y/o el nombre (TikTok),
// y le pone este teléfono. Si el pedido que coincide ya tiene OTRO teléfono, no lo toca y avisa a Yanaina.
const EMOJI_PAL: Record<string, string> = { '🦋': 'mariposa', '🌸': 'flor', '🌺': 'flor', '🌷': 'flor', '🌹': 'rosa', '❤': 'corazon', '❤️': 'corazon', '💖': 'corazon', '💕': 'corazon', '⭐': 'estrella', '🌟': 'estrella', '✨': 'brillo', '🌙': 'luna', '☀️': 'sol', '🌞': 'sol', '🐱': 'gato', '🐶': 'perro', '🦄': 'unicornio', '👑': 'reina', '🍒': 'cereza', '🍓': 'frutilla', '🐝': 'abeja', '🌻': 'girasol', '🐼': 'panda', '🦁': 'leon' };
const VACIAS = new Set(['la', 'el', 'los', 'las', 'de', 'del', 'soy', 'usuario', 'usuaria', 'user', 'un', 'una', 'que', 'te', 'mi', 'tiktok', 'con']);
// Normaliza nombres de TikTok: emojis a palabra, sin tildes, como suena (z=s, v=b, ll=y, sin h), sin letras repetidas, sin palabras vacías
const normN = (v: any) => {
  let s = String(v || '');
  for (const [e, w] of Object.entries(EMOJI_PAL)) s = s.split(e).join(' ' + w + ' ');
  s = s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ');
  s = s.replace(/z/g, 's').replace(/c([ei])/g, 's$1').replace(/v/g, 'b').replace(/ll/g, 'y').replace(/qu/g, 'k').replace(/c/g, 'k').replace(/h/g, '').replace(/([a-z])\1+/g, '$1');
  return s.split(/\s+/).filter((w) => w && !VACIAS.has(w)).join(' ').trim();
};
function edRatio(sa: string, sb2: string) {
  const m = sa.length, n = sb2.length; if (!m || !n) return 0;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (sa[i - 1] === sb2[j - 1] ? 0 : 1));
  return 1 - d[m][n] / Math.max(m, n);
}
function parecido(a: string, b: string) {
  a = normN(a); b = normN(b); if (!a || !b) return 0;
  if (a === b) return 1;
  const sa = a.replace(/ /g, ''), sb2 = b.replace(/ /g, '');
  if (sa.length >= 4 && sb2.length >= 4 && (sa.includes(sb2) || sb2.includes(sa))) return 0.9;
  const ta = a.split(' ').filter((x) => x.length >= 4), tb = b.split(' ').filter((x) => x.length >= 4);
  let mejor = edRatio(sa, sb2);
  for (const x of ta) for (const y of tb) { const r = x === y ? 0.9 : edRatio(x, y) * 0.95; if (r > mejor) mejor = r; }
  return mejor;
}
// Si no aparece y hoy hay vivo, puede que el pedido todavía no esté cargado: queda en espera y el repaso (cada 5 min) lo vuelve a buscar.
// 20/11 (D-7): una sola secuencia para el pedido que no aparece.
const NO_ENC = 'No aparece. Si todavía no le preguntaste el usuario de TikTok o el número de pedido, preguntáselo una vez. Si ya lo dijo, pasá a Yanaina (pedido) con lo que dijo.';
async function dejarEnEspera(ctx: Ctx, a: any) {
  // 25/11: vivo en curso = botón de la app (vivo.ts). La primera respuesta se calla: el repaso (cada minuto) lo vuelve a buscar
  // y, si a los 2 minutos sigue sin aparecer, le manda "apenas aparezca te aviso" (avisarEn / avisado).
  if (a?.reintento || !(await fechaVivo(sb, await leerConfig()))) return null;
  const { data: cv } = await sb.from('conversaciones').select('datos').eq('id', ctx.telKey).maybeSingle();
  const buscar = { nombre: String(a?.nombre || ''), num: a?.num || null, confirmar: !!a?.confirmar, hasta: new Date(Date.now() + 3 * 3600e3).toISOString(), avisarEn: new Date(Date.now() + 2 * 60e3).toISOString(), avisado: false };
  const datos = { ...(cv?.datos || { id: ctx.telKey, tel: '0' + ctx.telKey, estado: 'agente' }), buscar };
  if (cv) await sb.from('conversaciones').update({ datos }).eq('id', ctx.telKey); else await sb.from('conversaciones').insert({ id: ctx.telKey, datos });
  return { ok: false, no_encontrado: true, en_espera: true, que_hacer: 'Todavía no aparece (lo están cargando en el vivo). El sistema lo vuelve a buscar cada minuto y le escribe solo cuando aparece (o, si en 2 minutos no aparece, le avisa que la vas a avisar). Si su mensaje era solo para identificarse o confirmar el pedido, tu respuesta final tiene que ser exactamente: silencio. Si además preguntó otra cosa, contestá solo eso, sin hablar del pedido. No pases a Yanaina ni le vuelvas a pedir el usuario.' };
}
async function limpiarEspera(ctx: Ctx) {
  const { data: cv } = await sb.from('conversaciones').select('datos').eq('id', ctx.telKey).maybeSingle();
  if (cv?.datos?.buscar) { const d = { ...cv.datos }; delete d.buscar; await sb.from('conversaciones').update({ datos: d }).eq('id', ctx.telKey); }
}
export async function vincularPedido(ctx: Ctx, a: any) {
  const num = parseInt(String(a?.num ?? '').replace(/\D/g, ''), 10) || 0, nombre = String(a?.nombre || '').trim(), prenda = String(a?.prenda || '').trim();
  if (!num && !nombre && !prenda) return { ok: false, que_hacer: 'Pedile el número de pedido o su usuario de TikTok.' };
  const ayer = new Date(Date.now() - 36 * 3600e3).toISOString().slice(0, 10);
  const { data: lvs } = await sb.from('lives').select('id,datos').gte('datos->>fecha', ayer);
  const lids = (lvs || []).map((l: any) => l.id);
  if (!lids.length) return (await dejarEnEspera(ctx, a)) || { ok: false, no_encontrado: true, que_hacer: NO_ENC };
  const { data: ps } = await sb.from('pedidos').select('*').in('live_id', lids).eq('borrado', false).in('estado', ['pendiente', 'listo']);
  const cids = [...new Set((ps || []).map((p: any) => p.clienta_id))];
  const { data: cls } = cids.length ? await sb.from('clientas').select('*').in('id', cids) : { data: [] as any[] };
  const cl = new Map((cls || []).map((c: any) => [c.id, c]));
  const cand = (ps || []).map((p: any) => {
    const c: any = cl.get(p.clienta_id) || { datos: {} };
    const nombres = [c.datos.nombre, c.datos.nombreEnvio, ...(c.datos.alias || [])].filter(Boolean);
    const sim = nombre ? Math.max(0, ...nombres.map((x: string) => parecido(x, nombre))) : 0;
    return { p, c, sim, porNum: !!num && Number(p.datos.num) === num };
  });
  let elegido: any = null;
  if (num) {
    const xs = cand.filter((x) => x.porNum).sort((x, y) => y.sim - x.sim);
    if (xs.length === 1 && (!nombre || xs[0].sim >= 0.6)) elegido = xs[0];
    else if (xs.length > 1 && nombre && xs[0].sim >= 0.6 && xs[0].sim - (xs[1]?.sim || 0) >= 0.2) elegido = xs[0];
  }
  if (!elegido && nombre) {
    const xs = cand.filter((x) => x.sim >= 0.8).sort((x, y) => y.sim - x.sim);
    // Si hay varias con ese nombre, se descartan las que tienen otro teléfono y, si dijo la prenda, las que no la compraron
    const libres = xs.filter((x) => { const tl = String(x.c.datos.tel || '').replace(/\D/g, ''); return !tl || telKeyDe(tl) === ctx.telKey; });
    const pwN = normN(prenda).split(' ').filter((w) => w.length >= 4);
    const conPrenda = pwN.length ? libres.filter((x) => pwN.some((w) => (x.p.datos.prendas || []).some((pr: any) => normN(pr.nombre).split(' ').some((y) => y === w || edRatio(y, w) >= 0.8)))) : libres;
    if (xs.length === 1 || (xs.length > 1 && xs[0].sim - xs[1].sim >= 0.15)) elegido = xs[0];
    else if (conPrenda.length === 1) elegido = conPrenda[0];
    else if (libres.length === 1) elegido = libres[0];
    else if (xs.length > 1) return derivar(ctx, 'Escribe desde un número sin pedido (' + (nombre || '') + (num ? ', pedido #' + num : '') + '): coincide con varios pedidos: ' + xs.slice(0, 4).map((x) => '#' + x.p.datos.num + ' ' + x.c.datos.nombre).join(', '), 'pedido');
  }
  // Por la prenda que dice que compró, entre los pedidos SIN teléfono (ej. "soy Paola, por el conjunto chocolate")
  if (!elegido && prenda) {
    const pw = normN(prenda).split(' ').filter((w) => w.length >= 4);
    const xs = cand.filter((x) => !String(x.c.datos.tel || '').replace(/\D/g, '') && pw.some((w) => (x.p.datos.prendas || []).some((pr: any) => normN(pr.nombre).split(' ').some((y) => y === w || edRatio(y, w) >= 0.8))));
    const conNombre = nombre ? xs.filter((x) => x.sim >= 0.5) : xs;
    if (conNombre.length === 1) elegido = conNombre[0];
    else if (!nombre && xs.length === 1) elegido = xs[0];
  }
  if (!elegido) return (await dejarEnEspera(ctx, a)) || { ok: false, no_encontrado: true, que_hacer: NO_ENC };
  const telC = String(elegido.c.datos.tel || '').replace(/\D/g, '');
  if (telC && telKeyDe(telC) === ctx.telKey) { await limpiarEspera(ctx); return { ok: true, ya_vinculado: true, pedido: elegido.p.datos.num, que_hacer: 'Ese pedido ya está a su número.' }; }
  if (telC && telKeyDe(telC) !== ctx.telKey) return derivar(ctx, 'Escribe desde el 0' + ctx.telKey + ' y dice ser ' + (nombre || 'la clienta') + (num ? ' (pedido #' + num + ')' : '') + '. Puede ser el pedido #' + elegido.p.datos.num + ' de ' + elegido.c.datos.nombre + ', pero esa ficha tiene otro teléfono (' + elegido.c.datos.tel + '). Verificar.', 'pedido');
  if (ctx.clienta && ctx.clienta.id !== elegido.c.id) {
    // Este número ya tiene ficha: el pedido pasa a esa ficha y el nombre del live queda como alias
    await conReintento(async () => {
      const { data: r } = await sb.from('pedidos').select('*').eq('id', elegido.p.id).single();
      const d = { ...r.datos, clienteId: ctx.clienta.id };
      const { error } = await sb.from('pedidos').update({ clienta_id: ctx.clienta.id, datos: d, actualizado: new Date().toISOString() }).eq('id', r.id).eq('actualizado', r.actualizado);
      if (error) throw new Error(error.message);
    });
    await conReintento(async () => {
      const { data: c } = await sb.from('clientas').select('*').eq('id', ctx.clienta.id).single();
      const alias = [...new Set([...(c.datos.alias || []), elegido.c.datos.nombre].filter(Boolean))];
      await guardarClienta(c, { ...c.datos, alias });
    });
  } else {
    await conReintento(async () => {
      const { data: c } = await sb.from('clientas').select('*').eq('id', elegido.c.id).single();
      const { data, error } = await sb.from('clientas').update({ tel_key: ctx.telKey, datos: { ...c.datos, tel: '0' + ctx.telKey, telKey: ctx.telKey }, actualizado: new Date().toISOString() }).eq('id', c.id).eq('actualizado', c.actualizado).select('id');
      if (error) throw new Error(error.message);
      if (!data?.length) throw new Error('conflicto');
    });
  }
  await cargarClienta(ctx);
  await limpiarEspera(ctx);
  // Si es del vivo de hoy, escribir para identificarse ya cuenta como confirmación (4/11)
  const lvHoy = (lvs || []).find((l: any) => l.id === elegido.p.live_id && l.datos?.fecha === hoyUY());
  if (lvHoy) {
    const rc: any = await confirmarPedido(ctx).catch(() => null);
    return { ok: true, pedido: elegido.p.datos.num, confirmado: !!rc?.ok, que_hacer: 'Quedó con su número y confirmado. Contestá corto: "¡Gracias por confirmar tu pedido bella! 🫶" (con la presentación si es tu primer mensaje). No digas que lo buscaste ni que lo encontraste, y no le pases el total (puede seguir sumando en el vivo).' };
  }
  return { ok: true, pedido: elegido.p.datos.num, nombre_en_el_live: elegido.c.datos.nombre, que_hacer: 'Listo, el pedido quedó con su número. Seguí con lo que pidió (si quería confirmar, llamá confirmar_pedido; si pregunta el total, buscar_pedido).' };
}

// ─── guardar_pedido (3/11) ────────────────────────────────────
// Pagado → Guardado (con pago). Sin pagar → solo si la ficha tiene puedeGuardarSinPagar, hasta 7 días. Si no, Yanaina.
export async function guardarPedidoCli(ctx: Ctx, a: any) {
  if (!ctx.clienta) return derivar(ctx, 'Pide guardar el pedido pero no hay ficha de clienta para este número', 'especial');
  const { filas, cobros } = await abiertos(ctx);
  // 26/11 (Parte A): "¿Te lo guardamos para mandarlo junto con el #N?" → se guardan solo los pagados, esperando ese pedido.
  const jc = parseInt(String(a?.junto_con ?? '').replace(/\D/g, ''), 10) || 0;
  if (jc) {
    const t = filas.find((r) => +r.datos.num === jc && r.datos.estado === 'pendiente' && !pagado(r.datos));
    const pag = filas.filter((r) => r.datos.estado === 'listo' && pagado(r.datos) && r.id !== t?.id);
    if (!t) return { error: `No encuentro el pedido #${jc} sin pagar. Revisá el número en el ESTADO ACTUAL.` };
    if (!pag.length) return { ok: true, nada: true, que_hacer: 'No hay pedidos pagados para guardar: seguí normal.' };
    for (const r0 of pag) await conReintento(async () => {
      const { data: r } = await sb.from('pedidos').select('*').eq('id', r0.id).single();
      const p = JSON.parse(JSON.stringify(r.datos)); p.estado = 'guardado'; p.fechas = p.fechas || {}; p.fechas.guardado = hoyUY(); p.esperaPedido = t.id; delete p.preguntaEnvio;
      notaMas(p, `⏸️ Guardado: espera el pedido #${jc} para salir junto (le dijo a Mabel)`); await guardarPedido(r, p);
    });
    return { ok: true, pedidos: pag.map((r) => r.datos.num), espera: jc, mensaje_de_cierre: `Dale bella, te lo guardamos y sale junto con el #${jc} cuando lo pagues 🫶` };
  }
  let objetivo = filas.filter((r) => ['pendiente', 'listo'].includes(r.datos.estado));
  if (cobros.length) { const ids = cobros[0].datos.pedidos || []; objetivo = filas.filter((r) => ids.includes(r.id)); }
  if (!objetivo.length) return { ok: true, ya_guardado: true, que_hacer: 'Sus pedidos ya están guardados: confirmale corto que siguen guardados.' };
  const hoy = hoyUY(), max = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  const pagos = objetivo.map((r) => pagado(r.datos));
  if (pagos.some((x) => !x) && pagos.some((x) => x)) return derivar(ctx, 'Pide guardar: tiene pedidos pagos y otros sin pagar', 'especial');
  const sinPagar = !pagos[0];
  const { data: cli } = await sb.from('clientas').select('datos').eq('id', ctx.clienta.id).single();
  if (sinPagar && !cli?.datos?.puedeGuardarSinPagar) return derivar(ctx, 'Pide guardar el pedido sin pagar' + (a?.hasta ? ' hasta el ' + a.hasta : '') + ' (no está autorizada a guardar sin pagar)', 'especial');
  let hasta = /^\d{4}-\d{2}-\d{2}$/.test(String(a?.hasta || '')) ? String(a.hasta) : max;
  if (hasta < hoy) hasta = max;
  if (sinPagar && hasta > max) return derivar(ctx, 'Pide guardar sin pagar hasta el ' + hasta + ' (más de 7 días)', 'especial');
  const nums: number[] = [];
  for (const r0 of objetivo) {
    await conReintento(async () => {
      const { data: r } = await sb.from('pedidos').select('*').eq('id', r0.id).single();
      const p = JSON.parse(JSON.stringify(r.datos));
      p.estado = 'guardado'; p.fechas = p.fechas || {}; p.fechas.guardado = hoy;
      if (sinPagar) p.guardadoSinPagar = { desde: hoy, hasta, porMabel: true };
      const n = '⏸️ Pidió guardarlo' + (a?.hasta ? ' hasta el ' + a.hasta : '') + ' (le dijo a Mabel)';
      p.notas = p.notas ? String(p.notas) + '\n' + n : n;
      await guardarPedido(r, p); nums.push(p.num);
    });
  }
  return { ok: true, pedidos: nums, sin_pagar: sinPagar, ...(sinPagar ? { hasta } : {}), mensaje_de_cierre: sinPagar ? 'Dale bella, te lo guardamos 🫶' : 'Dale bella, te lo guardamos. Cuando quieras que salga, avisanos 🫶' };
}

// ─── confirmar_pedido (3/11) ──────────────────────────────────
// La clienta confirma ("sí", "confirmo mi pedido"): marca confirmado el/los pedidos abiertos del live más reciente (últimos 3 días). No toca pagos.
export async function confirmarPedido(ctx: Ctx) {
  await cargarClienta(ctx);
  const { filas, lives } = await abiertos(ctx);
  const desde = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);
  const cand = filas.filter((r) => r.datos?.estado !== 'guardado' && !r.datos?.guardadoSinPagar && (lives.get(r.live_id)?.fecha || '') >= desde);
  if (!cand.length) return { ok: false, motivo: 'No hay pedido abierto de un live de los últimos 3 días a este número' };
  const ultimo = cand.map((r) => lives.get(r.live_id)?.fecha || '').sort().pop();
  const rs = cand.filter((r) => (lives.get(r.live_id)?.fecha || '') === ultimo);
  const ahora = new Date().toISOString(), nums: number[] = [];
  for (const r0 of rs) {
    await conReintento(async () => {
      const { data: r } = await sb.from('pedidos').select('*').eq('id', r0.id).single();
      if (!r || r.datos?.confirmado) { if (r) nums.push(r.datos.num); return; }
      await guardarPedido(r, { ...r.datos, confirmado: ahora, confirmadoPor: 'mabel' });
      nums.push(r.datos.num);
    });
  }
  return { ok: true, pedidos_confirmados: nums, live: lives.get(rs[0].live_id)?.nombre || '' };
}

// ─── Definición de herramientas para la API de Claude ─────────────
export const HERRAMIENTAS = [
  { name: 'buscar_pedido', description: 'Refresca el ESTADO ACTUAL de la clienta (pedidos abiertos, totales, entrega guardada, nota). Sin parámetros.', input_schema: { type: 'object', properties: {} } },
  { name: 'marcar_pagado', description: 'Registra el pago del comprobante que mandó la clienta (sin comprobante no marca nada). Calcula lo esperado y la diferencia y dice qué hacer; si no cierra, deriva sola a Yanaina.', input_schema: { type: 'object', properties: {
    cuenta: { type: 'string', description: 'Cuenta de Emma de destino: BROU, Prex, Mi Dinero, OCA, Mercado Pago, o PREX YOAN si es una Prex a nombre de Yoan Piedad' },
    monto: { type: 'number', description: 'Monto del comprobante, en pesos' },
    fecha_comprobante: { type: 'string', description: 'Fecha del comprobante AAAA-MM-DD, si se lee' },
    destino_coincide: { type: 'boolean', description: 'false si el destino no es ninguna cuenta de las FORMAS DE PAGO ni PREX YOAN' },
    destino: { type: 'string', description: 'Cuenta o número de destino tal como se lee' }, titular_destino: { type: 'string', description: 'Titular de destino tal como se lee' },
    banco: { type: 'string', description: 'Banco o app del comprobante' }, ordenante: { type: 'string', description: 'Nombre de quien transfirió, si se lee' },
    hora_comprobante: { type: 'string', description: 'Hora del comprobante HH:MM, si se lee' }, numero_operacion: { type: 'string', description: 'Número de operación o referencia, si se lee' },
    nota: { type: 'string', description: 'Nota corta opcional' } }, required: ['cuenta', 'monto', 'destino_coincide'] } },
  { name: 'guardar_entrega', description: 'Carga cómo recibe el pedido (retiro, cadeteria en Montevideo o agencia) en todos sus pedidos abiertos. Se puede llamar sin barrio o sin nombre: queda cargada y dice qué preguntar.', input_schema: { type: 'object', properties: {
    tipo: { type: 'string', enum: ['retiro', 'cadeteria', 'agencia'] },
    direccion: { type: 'string', description: 'Calle y número o esquina, siempre que la diga (cadetería: obligatoria; agencia: si la dio). No la pongas solo en nota_interna' }, barrio: { type: 'string', description: 'Barrio tal como lo dijo' },
    nota_cadete: { type: 'string', description: 'Cadetería: solo datos fijos para llegar (timbre, portón, apto) que dijo en esta charla. Nunca el horario ni lo que ya figura en datos_guardados' }, horario_envio: { type: 'string', description: 'Cadetería: horario para ESTE envío, solo si lo dijo o confirmó en esta charla (ej. "No hay quien reciba de 17 a 20"). Queda guardado como horario de preferencia' }, sin_horario: { type: 'boolean', description: 'Cadetería: true si dijo que ya no tiene restricción de horario (se borra el guardado)' }, nota_interna: { type: 'string', description: 'Nota para el equipo sobre este pedido (no la ve el cadete)' }, etiqueta: { type: 'string', description: 'Cadetería: casa, trabajo, mamá… si lo dijo' }, con_cambio: { type: 'boolean', description: 'Cadetería: true si el cadete además lleva o retira un cambio' },
    envio_transferido: { type: 'number', description: 'Cadetería: cuánto del envío ya transfirió (0 si lo paga al cadete). Solo cuenta si sobra en un pago ya registrado' },
    agencia: { type: 'string' }, ciudad: { type: 'string', description: 'Agencia: ciudad o localidad tal como la dijo' }, departamento: { type: 'string', description: 'Agencia: obligatorio. El que dijo la clienta; nunca deducido del nombre de la ciudad (Villa San José es de Canelones, no de San José). Si la cambia, se reemplaza toda la dirección anterior' }, ci: { type: 'string', description: 'C.I. de quien retira en la agencia' },
    confirma_agencia: { type: 'boolean', description: 'Solo true si guardar_entrega devolvió no_cierra y la clienta confirmó que lo quiere por agencia' },
    nombre_retira: { type: 'string', description: 'Nombre y apellido de quien recibe o retira (agencia: obligatorio, salvo que ya esté en datos_guardados.nombre_envio)' }, horario_retiro: { type: 'string', description: 'Retiro: cuándo dice que pasa, con día y fecha (ej. "sábado 21/11 a las 18")' }, retiro_fecha: { type: 'string', description: 'Retiro: fecha del día que pasa, AAAA-MM-DD, sacada de HOY. Pasala siempre que diga un día' }, retiro_hora: { type: 'string', description: 'Retiro: hora aproximada, HH:MM en 24 hs' } }, required: ['tipo'] } },
  { name: 'dejar_aviso_despacho', description: 'Aviso de una línea para quien arma el paquete en Despacho (paquete de Yharol para mandar junto, lo retira otra persona…). Va en sus pedidos abiertos.', input_schema: { type: 'object', properties: { texto: { type: 'string', description: 'Ej: "Tiene paquete de Yharol: enviar junto"' } }, required: ['texto'] } },
  { name: 'vincular_pedido', description: 'Busca en los vivos de hoy y ayer el pedido de una clienta que escribe desde un número sin pedido y le pone este número.', input_schema: { type: 'object', properties: { num: { type: 'number', description: 'Número de pedido si lo dijo' }, nombre: { type: 'string', description: 'Nombre o usuario de TikTok tal como lo escribió' }, confirmar: { type: 'boolean', description: 'true si estaba confirmando el pedido' }, prenda: { type: 'string', description: 'Lo que dice que compró, si lo dijo' } } } },
  { name: 'guardar_pedido', description: 'Guarda el pedido (que no salga todavía). Decide sola si se puede; si no, avisa a Yanaina.', input_schema: { type: 'object', properties: { hasta: { type: 'string', description: 'AAAA-MM-DD, solo si dijo una fecha' }, junto_con: { type: 'number', description: 'Número del pedido sin pagar con el que tiene que salir (cuando marcar_pagado te pidió preguntarle si lo guardamos para mandarlo junto)' } } } },
  { name: 'confirmar_pedido', description: 'Marca confirmados sus pedidos del vivo más reciente (últimos 3 días). Sin parámetros.', input_schema: { type: 'object', properties: {} } },
  { name: 'pasar_a_yanaina', description: 'Deja la conversación para Yanaina con el motivo en una línea. Devuelve la frase para la clienta.', input_schema: { type: 'object', properties: { motivo: { type: 'string' }, categoria: { type: 'string', enum: CATEGORIAS, description: 'Obligatoria. pedido = problema con el pedido (desconoce la compra, prenda de más o de menos, mal anotado, reclamo, cancelar o sacar una prenda, número sin pedido que no se pudo vincular) · pago = comprobantes, faltantes, plazo para pagar, pedidos viejos sin marcar pago · entrega = cadetería, agencia, retiro, día de salida, juntar paquetes · cambio = cambio de talle o de prenda · especial = pide algo aparte que no podés resolver (guardar sin pagar, avisar cuando haya algo) · yharol = emprendimiento de Yharol · otros = no entra en ninguna. Si hay más de un tema, el que frena el pedido.' }, en_silencio: { type: 'boolean', description: 'true = no se le escribe a la clienta. Para cambios y pedidos anteriores a Mabel; en lo demás lo controla la herramienta.' }, con_frase_propia: { type: 'boolean', description: 'true si ya le dijiste la frase propia del caso: no devuelve frase de pase' } }, required: ['motivo', 'categoria'] } },
  { name: 'actualizar_nota', description: 'Reescribe la nota de la clienta: máximo 3 líneas, solo hechos con fecha, sin opiniones ni datos sensibles.', input_schema: { type: 'object', properties: { texto: { type: 'string' } }, required: ['texto'] } },
];

export async function ejecutar(name: string, input: any, ctx: Ctx) {
  ctx.llamadas.push(name);
  switch (name) {
    case 'buscar_pedido': return await buscarPedido(ctx);
    case 'marcar_pagado': return await marcarPagado(ctx, input || {});
    case 'guardar_entrega': return await guardarEntrega(ctx, input || {});
    case 'confirmar_pedido': return await confirmarPedido(ctx);
    case 'dejar_aviso_despacho': return await dejarAvisoDespacho(ctx, input || {});
    case 'vincular_pedido': return await vincularPedido(ctx, input || {});
    case 'guardar_pedido': return await guardarPedidoCli(ctx, input || {});
    case 'pasar_a_yanaina': return await pasarAYanaina(ctx, input?.motivo, !!input?.en_silencio, CATEGORIAS.includes(String(input?.categoria)) ? String(input.categoria) : categoriaDe(input?.motivo), !!input?.con_frase_propia);
    case 'actualizar_nota': return await actualizarNota(ctx, input?.texto);
    default: return { error: 'Herramienta desconocida' };
  }
}
// 5/11: horarios de retiro por fecha (cargados en la app, Config → Mabel). Siempre con la fecha real, nunca "hoy/mañana" sueltos.
export function horariosRetiroTexto(c: any) {
  const hoy = hoyUY(), dia = (f: string) => { const d = new Date(f + 'T12:00:00Z'); return ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][d.getUTCDay()] + ' ' + d.getUTCDate() + '/' + (d.getUTCMonth() + 1); };
  const hs = (Array.isArray(c.horariosRetiro) ? c.horariosRetiro : []).filter((x: any) => x?.fecha >= hoy && !sinSalida(c, x.fecha, 'retiro')).sort((a: any, b: any) => a.fecha.localeCompare(b.fecha)).slice(0, 14);
  if (!hs.length) return 'HORARIOS DE RETIRO: no hay ninguno cargado. No des horario: "Dale bella, escribinos un día antes para coordinar".';
  return 'HORARIOS DE RETIRO CARGADOS (decí siempre el día con nombre y fecha): ' + hs.map((x: any) => (x.fecha === hoy ? 'HOY ' : '') + dia(x.fecha) + ': ' + (x.cerrado ? 'sin retiro' : 'de ' + x.desde + ' a ' + x.hasta + ' hs')).join('; ') + '. Para un día que no está en la lista no des horario: "Dale bella, escribinos un día antes para coordinar".';
}
