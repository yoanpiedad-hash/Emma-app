// Herramientas de Mabel. Replican la lógica de la app (despacho.js, mabel.js, index.html) sobre la base.
// Regla de seguridad: ninguna herramienta recibe teléfono ni id de clienta del modelo. Siempre usan ctx (el número que escribió).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { BARRIOS_GRISAL } from './barrios.ts';

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
const CUENTAS_DEF = ['BROU', 'Prex', 'Mi Dinero', 'OCA', 'Mercado Pago', 'Efectivo'];
const medioDe = (c: string) => /mercado\s*pago/i.test(c || '') ? 'mercadopago' : /efectivo|d[eé]bito|cr[eé]dito/i.test(c || '') ? 'efectivo' : 'transferencia';
const esHabitual = (a: string) => /^(dac|nu[nñ]ez|correo)/.test(normB(a));

export type Ctx = { telKey: string; wa: string; clienta: any | null; clientas: any[]; media: { path: string; sha256: string; mime: string } | null; llamadas: string[] };

// ─── Config ───────────────────────────────────────────────────────
export async function leerConfig(): Promise<Record<string, any>> {
  const { data } = await sb.from('config').select('clave,valor');
  const o: Record<string, any> = {};
  for (const r of data || []) o[r.clave] = r.valor;
  return o;
}
const num = (v: any, d = 0) => { const n = +v; return Number.isFinite(n) ? n : d; };
export const tarifaDe = (c: any) => num(c.tarifaEnvio, 250) || 250;
export const mpDe = (c: any) => (c.mpRecargo === undefined || c.mpRecargo === null || c.mpRecargo === '') ? 10 : Math.max(0, num(c.mpRecargo, 10));
const cuentasDe = (c: any): string[] => Array.isArray(c.cuentasPago) && c.cuentasPago.length ? c.cuentasPago : CUENTAS_DEF;
export const novedadesVigentes = (c: any) => { const n = c.novedadesHoy; return n && n.texto && (!n.vence || n.vence >= hoyUY()) ? n : null; };

// ─── Reglas de la app ───────────────────────────────────────────
const pagado = (p: any) => !!p.cambio || !!p.pago || p.estado === 'listo';
const entregaEf = (p: any, cli: any) => (p.entrega && p.entrega !== 'sin_definir') ? p.entrega : (cli && cli.datos?.agencia ? 'agencia' : (p.entrega || 'sin_definir'));
function calcTotal(p: any, live: any): number {
  let bruto = 0;
  for (const pr of p.prendas || []) bruto += (+pr.precio || 0) * (pr.qty || 1);
  const d = (p.descuento !== null && p.descuento !== undefined && p.descuento !== '') ? +p.descuento : (+(live?.datos?.descuento) || 0);
  const sub = bruto - Math.round(bruto * d / 100);
  return sub - Math.min(p.saldoAplicado || 0, sub);
}
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
  const pedidos = filas.map((r) => {
    const p = r.datos, live = lives.get(r.live_id);
    const total = calcTotal(p, live);
    return {
      numero: p.num, live: live?.nombre || '', fecha_live: live?.fecha || null, total, estado: p.estado, estado_pago: estadoPago(p, c),
      entrega: entregaEf(p, c), guardado_sin_pagar_hasta: p.guardadoSinPagar?.hasta || null, paga_al_retirar: !!p.pagaAlRetirar,
      cadeteria_cobra_el_cadete: p.entrega === 'cadeteria' ? (p.cobroEnvio === 'pago' ? 0 : p.cobroEnvio === 'monto' ? (+p.cobroMonto || 0) : tar) : null,
      en_cobro_agrupado: cobros.find((k) => (k.datos.pedidos || []).includes(r.id))?.id || null,
    };
  });
  const sinPagar = filas.filter((r) => !pagado(r.datos) && r.datos.estado === 'pendiente');
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
  return {
    clienta_encontrada: !!c,
    nota_de_la_clienta: c?.datos?.notaMabel || '',
    datos_guardados: c ? { direccion: c.datos.direccion || '', barrio: c.datos.barrio || '', agencia: c.datos.agencia || '', ciudad: c.datos.ciudad || '', departamento: c.datos.depto || '', nombre_envio: c.datos.nombreEnvio || '', ci: c.datos.ci || '', nota_cadete: c.datos.notaCadete || '' } : null,
    pedidos_abiertos: pedidos,
    a_transferir,
    sin_pagar_para_marcar: sinPagar.length,
    config: { tarifa_cadeteria: tar, recargo_mercado_pago_pct: mp, dia_otras_agencias: cfg.diaOtrasAgencias || 'viernes', cuentas: cuentasDe(cfg) },
  };
}

// ─── Escritura con control de cambios ─────────────────────────
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
export async function pasarAYanaina(ctx: Ctx, motivo: string) {
  const ahora = new Date(), hasta = new Date(ahora.getTime() + 12 * 3600e3);
  const c = ctx.clienta;
  const datos = { id: ctx.telKey, tel: c?.datos?.tel || '0' + ctx.telKey, clienteId: c?.id || null, estado: 'yanaina', motivo: String(motivo || 'Sin motivo').slice(0, 200), desde: ahora.toISOString(), hasta: hasta.toISOString() };
  const { error } = await sb.from('conversaciones').upsert({ id: ctx.telKey, datos, borrado: false, actualizado: ahora.toISOString() }, { onConflict: 'id' });
  if (error) throw new Error(error.message);
  return { ok: true, derivado: true, mensaje_para_la_clienta: 'Ya le aviso a Yanaina y te escribe enseguida 💛' };
}

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
export async function marcarPagado(ctx: Ctx, a: { cuenta: string; monto: number; fecha_comprobante?: string; destino_coincide?: boolean; nota?: string }) {
  const cfg = await leerConfig(), tar = tarifaDe(cfg), mp = mpDe(cfg);
  if (!ctx.clienta) return derivar(ctx, 'No hay ficha de clienta para este número (llegó un comprobante)');
  const cuentas = cuentasDe(cfg).filter((x) => medioDe(x) !== 'efectivo');
  const cuenta = cuentas.find((x) => normB(x) === normB(a.cuenta));
  const monto = Math.round(num(a.monto));
  if (a.destino_coincide === false) return derivar(ctx, 'El comprobante va a una cuenta que no es de Emma');
  if (!cuenta) return derivar(ctx, `Cuenta "${a.cuenta}" no reconocida en el comprobante`);
  if (!(monto > 0)) return { error: 'Falta el monto del comprobante: pedile que lo mande de nuevo, más claro.' };

  const { filas, lives, cobros } = await abiertos(ctx);
  let objetivo: any[], envCobro = 0, cobro: any = null;
  if (cobros.length) {
    cobro = cobros[0];
    objetivo = filas.filter((r) => (cobro.datos.pedidos || []).includes(r.id) && !pagado(r.datos));
    envCobro = +cobro.datos.envio || 0;
  } else {
    const sp = filas.filter((r) => !pagado(r.datos) && r.datos.estado === 'pendiente');
    if (sp.length > 1) return derivar(ctx, 'Tiene más de un pedido sin pagar y no hay cobro agrupado');
    objetivo = sp;
  }
  if (!objetivo.length) return { error: 'No hay ningún pedido sin pagar para marcar. Si dice que ya pagó, pasalo a Yanaina.' };

  // Fecha del comprobante vs fecha del live
  const f = String(a.fecha_comprobante || '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(f)) {
    const fl = objetivo.map((r) => lives.get(r.live_id)?.fecha).filter(Boolean).sort()[0];
    if (fl && f < String(fl).slice(0, 10)) return derivar(ctx, `Comprobante de fecha ${f}, anterior al live (${String(fl).slice(0, 10)})`);
  }
  // Comprobante ya usado
  if (ctx.media?.sha256) {
    const { data: dup } = await sb.from('pagos').select('id').eq('borrado', false).filter('datos->>sha256', 'eq', ctx.media.sha256).limit(1);
    if (dup?.length) return derivar(ctx, 'Ese comprobante ya figura en otro pago');
  }
  // Esperado (sin cadetería, salvo cobro agrupado que ya la trae) y faltante
  const base = objetivo.reduce((s, r) => s + calcTotal(r.datos, lives.get(r.live_id)), 0);
  const esp = esperadoDe(base, envCobro, cuenta, mp);
  if (monto < esp.total) return derivar(ctx, `Transfirió de menos (faltan $${esp.total - monto}) · esperado $${esp.total}, transfirió $${monto} por ${cuenta}`);

  // Registrar (misma lógica que registrarPagos de la app)
  const ajuste = monto - esp.total;
  const res = await conReintento(async () => {
    const frescas: any[] = [];
    for (const r of objetivo) { const { data } = await sb.from('pedidos').select('*').eq('id', r.id).single(); frescas.push(data); }
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
  return {
    ok: true, pedidos_marcados: res, cuenta, esperado: esp.total, transferido: monto, diferencia: ajuste,
    que_hacer: ajuste <= 30 ? 'Es redondeo o exacto: no digas nada de la diferencia. Seguí con cómo recibe el pedido.'
      : ajuste === tar ? `Sobran justo $${tar}: preguntale "¿los $${tar} de más son para la cadetería?". Si dice que sí, guardá la entrega con tipo cadetería y envio_transferido=${tar}.`
      : `Sobran $${ajuste}: preguntale por qué ("Vi que transferiste $${monto} y era $${esp.total}, ¿es por algo en especial?"). Si dice que es por la cadetería (vale $${tar}), guardá la entrega con envio_transferido=${ajuste} y avisale cuánto falta ($${tar - ajuste}) que se lo paga al cadete. Si es por otra cosa o no queda claro, pasalo a Yanaina con la diferencia.`,
  };
}
async function derivar(ctx: Ctx, motivo: string) { const r = await pasarAYanaina(ctx, motivo); return { ...r, ok: false, motivo }; }

// ─── guardar_entrega ───────────────────────────────────────────
export async function guardarEntrega(ctx: Ctx, a: any) {
  if (!ctx.clienta) return derivar(ctx, 'No hay ficha de clienta para este número (eligió entrega)');
  const cfg = await leerConfig(), tar = tarifaDe(cfg);
  const tipo = String(a.tipo || '');
  if (!['retiro', 'cadeteria', 'agencia'].includes(tipo)) return { error: 'tipo tiene que ser retiro, cadeteria o agencia' };
  const { filas, cobros } = await abiertos(ctx);
  let objetivo = filas.filter((r) => ['pendiente', 'listo'].includes(r.datos.estado));
  if (cobros.length) { const ids = cobros[0].datos.pedidos || []; objetivo = filas.filter((r) => ids.includes(r.id)); }
  else if (objetivo.length > 1) return derivar(ctx, 'Tiene más de un pedido abierto y no hay cobro agrupado (eligió entrega)');
  if (!objetivo.length) return { error: 'No hay pedido abierto al que cargarle la entrega. Pasalo a Yanaina.' };

  const s = (v: any) => String(v ?? '').trim();
  const cambiosCli: Record<string, string> = {};
  const hint: any = {};
  if (tipo === 'cadeteria') {
    if (!s(a.direccion)) return { error: 'Falta la dirección.' };
    const barrio = barrioCanon(s(a.barrio));
    if (!barrio) return derivar(ctx, `Barrio "${s(a.barrio)}" no está en la lista de GrisalExpress (o es fuera de Montevideo)`);
    cambiosCli.direccion = s(a.direccion); cambiosCli.barrio = barrio;
    if (s(a.nombre_retira)) cambiosCli.nombreEnvio = s(a.nombre_retira);
    if (s(a.nota_cadete)) cambiosCli.notaCadete = s(a.nota_cadete);
  } else if (tipo === 'agencia') {
    if (!s(a.agencia) || !s(a.ciudad)) return { error: 'Faltan la agencia y la ciudad.' };
    cambiosCli.agencia = s(a.agencia); cambiosCli.ciudad = s(a.ciudad);
    if (s(a.nombre_retira)) cambiosCli.nombreEnvio = s(a.nombre_retira);
    if (s(a.ci)) cambiosCli.ci = s(a.ci);
    if (s(a.departamento)) cambiosCli.depto = s(a.departamento);
    hint.agencia_habitual = esHabitual(cambiosCli.agencia);
    hint.dia_otras_agencias = cfg.diaOtrasAgencias || 'viernes';
  }
  const x = Math.max(0, Math.min(tar, Math.round(num(a.envio_transferido))));
  await conReintento(async () => {
    if (Object.keys(cambiosCli).length) { const { data } = await sb.from('clientas').select('*').eq('id', ctx.clienta.id).single(); await guardarClienta(data, { ...data.datos, ...cambiosCli }); }
    for (const r of objetivo) {
      const { data } = await sb.from('pedidos').select('*').eq('id', r.id).single();
      const p = JSON.parse(JSON.stringify(data.datos)); p.entrega = tipo;
      if (tipo === 'retiro') { if (!pagado(p)) p.pagaAlRetirar = true; else delete p.pagaAlRetirar; }
      else delete p.pagaAlRetirar;
      if (tipo === 'cadeteria') {
        p.tipoEnvio = p.tipoEnvio || 'comun';
        if (x >= tar) { p.cobroEnvio = 'pago'; p.cobroMonto = 0; } else if (x > 0) { p.cobroEnvio = 'monto'; p.cobroMonto = tar - x; } else { p.cobroEnvio = 'cobrar'; p.cobroMonto = 0; }
        if (p.pago && x > 0) p.pago.conEnvio = x >= tar;
      }
      await guardarPedido(data, p);
      // El envío ya transferido va a la fila de pago más nueva del pedido (misma convención que la app: envio, ajuste)
      if (tipo === 'cadeteria' && x > 0 && p.pago?.id) {
        const { data: g } = await sb.from('pagos').select('*').eq('id', p.pago.id).single();
        if (g && (g.datos.ajuste || 0) >= x) { const d = { ...g.datos, envio: x, ajuste: (g.datos.ajuste || 0) - x, esperado: (g.datos.esperado || 0) + x }; await sb.from('pagos').update({ datos: d, actualizado: new Date().toISOString() }).eq('id', g.id); }
      }
    }
  });
  const cadete = tipo === 'cadeteria' ? (x >= tar ? 0 : tar - x) : null;
  return {
    ok: true, tipo, pedidos: objetivo.map((r) => r.datos.num), ...hint,
    ...(cadete !== null ? { el_cadete_cobra: cadete } : {}),
    ...(tipo === 'retiro' ? { paga_al_retirar: objetivo.some((r) => !pagado(r.datos)) } : {}),
    mensaje_de_cierre: tipo === 'cadeteria' ? 'Listo, ya lo tenemos anotado. Cuando salga te avisa la cadetería.' : tipo === 'agencia' ? 'Listo, anotado. Cuando salga te mandamos la foto del comprobante de envío.' : 'Listo, anotado. Te confirmamos el horario.',
  };
}

// ─── Definición de herramientas para la API de Claude ─────────────
export const HERRAMIENTAS = [
  { name: 'buscar_pedido', description: 'Trae el estado actual de la clienta que está escribiendo: pedidos abiertos, totales a transferir, datos de entrega guardados, nota y configuración. Sin parámetros.', input_schema: { type: 'object', properties: {} } },
  { name: 'marcar_pagado', description: 'Registra el pago de lo que vio en el comprobante. La herramienta calcula lo esperado y la diferencia; si no cierra, deriva sola a Yanaina.', input_schema: { type: 'object', properties: {
    cuenta: { type: 'string', description: 'Cuenta de Emma a la que se transfirió: BROU, Prex, Mi Dinero, OCA o Mercado Pago' },
    monto: { type: 'number', description: 'Monto que figura en el comprobante, en pesos' },
    fecha_comprobante: { type: 'string', description: 'Fecha del comprobante AAAA-MM-DD, si se lee' },
    destino_coincide: { type: 'boolean', description: 'false si el destino del comprobante no coincide con ninguna cuenta de las formas de pago de Emma' },
    nota: { type: 'string', description: 'Nota corta opcional (ejemplo: "transfirió $1.200")' } }, required: ['cuenta', 'monto', 'destino_coincide'] } },
  { name: 'guardar_entrega', description: 'Carga cómo recibe el pedido: retiro, cadeteria (Montevideo) o agencia.', input_schema: { type: 'object', properties: {
    tipo: { type: 'string', enum: ['retiro', 'cadeteria', 'agencia'] },
    direccion: { type: 'string', description: 'Cadetería: dirección' }, barrio: { type: 'string', description: 'Cadetería: barrio (tiene que estar en la lista de GrisalExpress)' },
    nota_cadete: { type: 'string', description: 'Cadetería: indicación para el cadete (opcional)' },
    envio_transferido: { type: 'number', description: 'Cadetería: cuánto de los $250 ya transfirió (0 si lo paga al cadete, 250 si lo transfirió completo)' },
    agencia: { type: 'string' }, ciudad: { type: 'string' }, departamento: { type: 'string' }, ci: { type: 'string', description: 'C.I. de quien retira en la agencia' },
    nombre_retira: { type: 'string', description: 'Nombre completo de quien recibe o retira, si es distinto del nombre de la clienta' } }, required: ['tipo'] } },
  { name: 'pasar_a_yanaina', description: 'Deja la conversación para Yanaina, con el motivo en una línea. Mabel se calla en esa conversación por 12 horas o hasta que Yanaina la devuelva.', input_schema: { type: 'object', properties: { motivo: { type: 'string' } }, required: ['motivo'] } },
  { name: 'actualizar_nota', description: 'Reescribe la nota de la clienta (máximo 3 líneas, solo hechos con fecha, sin opiniones ni datos sensibles). Llamala al cerrar una conversación en la que pasó algo útil para la próxima vez.', input_schema: { type: 'object', properties: { texto: { type: 'string' } }, required: ['texto'] } },
];

export async function ejecutar(name: string, input: any, ctx: Ctx) {
  ctx.llamadas.push(name);
  switch (name) {
    case 'buscar_pedido': return await buscarPedido(ctx);
    case 'marcar_pagado': return await marcarPagado(ctx, input || {});
    case 'guardar_entrega': return await guardarEntrega(ctx, input || {});
    case 'pasar_a_yanaina': return await pasarAYanaina(ctx, input?.motivo);
    case 'actualizar_nota': return await actualizarNota(ctx, input?.texto);
    default: return { error: 'Herramienta desconocida' };
  }
}
