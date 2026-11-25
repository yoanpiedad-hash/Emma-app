// 25/11: "¿hay vivo?" sale del botón 🔴 Vivo en curso de la app (Config vivoEnCurso), no de la fecha del live.
// Antes: cualquier live con la fecha de hoy contaba como vivo (el 21/11 un live con ventas sueltas hizo que Mabel dijera "estamos en vivo").
// Config vivoEnCurso = { desde: ISO, hasta: ISO } o null. Se apaga solo al llegar a `hasta` (6 h después de prenderlo).
// Config proximosVivos = [{ fecha: 'YYYY-MM-DD', desde: 'HH:MM', hasta: 'HH:MM' }] (pestaña Mabel → Ajustes).
// Sin dependencias de tools.ts (se usa desde app.ts y tools.ts sin import circular).

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const fechaUYde = (ms: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montevideo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));

/** El botón está prendido y no venció. */
export function vivoPrendido(cfg: Record<string, any>, ahora = Date.now()): { desde: string; hasta: string } | null {
  const v = cfg?.vivoEnCurso;
  if (!v || typeof v !== 'object' || !v.desde) return null;
  const hasta = Date.parse(v.hasta || '') || (Date.parse(v.desde) + 6 * 3600e3);
  return ahora < hasta ? { desde: String(v.desde), hasta: new Date(hasta).toISOString() } : null;
}

/** Fecha (YYYY-MM-DD) del vivo en curso, o null. Es la fecha del live actual de la app (con esa fecha están los pedidos);
 *  si el live actual es el registro de ventas del catálogo, o no existe, la del día en que se prendió el botón. */
export async function fechaVivo(sb: any, cfg: Record<string, any>): Promise<string | null> {
  const v = vivoPrendido(cfg); if (!v) return null;
  const id = String(cfg.liveActualId || '');
  if (id) {
    const { data } = await sb.from('lives').select('datos').eq('id', id).eq('borrado', false).maybeSingle();
    const d = data?.datos;
    if (d?.fecha && d.tipo !== 'ventas') return String(d.fecha);
  }
  return fechaUYde(Date.parse(v.desde));
}

/** Línea para el contexto de Mabel con los próximos vivos cargados en la app (hasta 3). */
export function proximosVivosTexto(cfg: Record<string, any>, hoy: string): string {
  const l = (Array.isArray(cfg?.proximosVivos) ? cfg.proximosVivos : [])
    .filter((x: any) => x && /^\d{4}-\d{2}-\d{2}$/.test(String(x.fecha)) && x.fecha >= hoy)
    .sort((a: any, b: any) => String(a.fecha + (a.desde || '')).localeCompare(String(b.fecha + (b.desde || '')))).slice(0, 3);
  if (!l.length) return 'PRÓXIMOS VIVOS: no hay ninguno cargado. Si pregunta cuándo es el próximo vivo y NOVEDADES DE HOY no lo dice: "Seguinos en TikTok @emma_indumentaria, ahí avisamos el próximo vivo 🫶".';
  const txt = l.map((x: any) => {
    const d = new Date(x.fecha + 'T12:00:00Z');
    const dia = (x.fecha === hoy ? 'hoy ' : '') + DIAS[d.getUTCDay()] + ' ' + d.getUTCDate() + '/' + (d.getUTCMonth() + 1);
    const h = (s: string) => String(s || '').replace(/^0(\d)/, '$1').replace(/:00$/, '');
    return dia + (x.desde ? ' de ' + h(x.desde) + (x.hasta ? ' a ' + h(x.hasta) : '') + ' h' : '');
  }).join(' · ');
  return 'PRÓXIMOS VIVOS (cargados por el equipo): ' + txt + '. Si pregunta cuándo es el próximo vivo, decile el primero de la lista con día, fecha y hora.';
}
