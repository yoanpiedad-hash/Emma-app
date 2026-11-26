// Filtro de los recordatorios (separado para poder probarlo sin la base). v8 (26/11): skip 'pago'.
// Recordatorios (5/11): además de lo que filtra la app, la función misma NO manda a los números del equipo (MABEL_EQUIPO)
// ni a clientas cuya conversación está con Yanaina ahora. Con accion:'revisar' devuelve qué saldría y qué no, SIN mandar nada.
export const SKIP_TXT: Record<string, string> = { equipo: 'número del equipo', yanaina: 'Yanaina la está atendiendo', pago: 'ya mandó comprobante (en revisión)' };
export const CON_FILTRO = new Set(['emma_recordatorio_1', 'emma_recordatorio_2']);
export async function excluidos(sb: any, A: Record<string, string>, tks: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const equipo = new Set(String(A.MABEL_EQUIPO || '').split(',').map((x) => telKeyDe(x)).filter(Boolean));
  tks.forEach((t) => { if (equipo.has(t)) out.set(t, 'equipo'); });
  const resto = tks.filter((t) => !out.has(t));
  if (resto.length) {
    const { data: cv } = await sb.from('conversaciones').select('id,datos').in('id', resto).eq('borrado', false);
    const ahora = new Date().toISOString();
    (cv || []).forEach((c: any) => { if (c.datos?.estado === 'yanaina' && (!c.datos.hasta || c.datos.hasta > ahora)) out.set(String(c.id), 'yanaina'); });
  }
  // v8 (26/11, caso #24): tampoco a quien ya mandó comprobante: pendiente de pago abierto en la bandeja, o una foto/PDF de la clienta
  // después del último total (o en los últimos 3 días si no figura el total).
  const resto2 = tks.filter((t) => !out.has(t));
  if (resto2.length) {
    const hace = (d: number) => new Date(Date.now() - d * 864e5).toISOString();
    const [{ data: dv }, { data: tot }, { data: med }] = await Promise.all([
      sb.from('derivados').select('datos').in('datos->>telKey', resto2).eq('borrado', false).limit(1000),
      sb.from('mabel_mensajes').select('tel_key,creado').in('tel_key', resto2).eq('direccion', 'out').or('texto.ilike.%detalle de tu pedido%,texto.ilike.%total de tus pedidos%').gte('creado', hace(10)).limit(3000),
      sb.from('mabel_mensajes').select('tel_key,creado').in('tel_key', resto2).eq('direccion', 'in').in('tipo', ['image', 'document']).gte('creado', hace(10)).limit(3000),
    ]);
    (dv || []).forEach((r: any) => { const d = r.datos || {}; if (!d.resuelto && (d.categoria === 'pago' || (Array.isArray(d.motivos) && d.motivos.some((m: any) => m?.categoria === 'pago')))) out.set(String(d.telKey), 'pago'); });
    const ultTot = new Map<string, string>();
    (tot || []).forEach((m: any) => { const t = new Date(m.creado).toISOString(); if ((ultTot.get(m.tel_key) || '') < t) ultTot.set(m.tel_key, t); });
    (med || []).forEach((m: any) => { const t = new Date(m.creado).toISOString(); if (!out.has(m.tel_key) && t > (ultTot.get(m.tel_key) || hace(3))) out.set(String(m.tel_key), 'pago'); });
  }
  return out;
}
const telKeyDe = (t: string) => { const d = String(t || '').replace(/\D/g, ''); return d.startsWith('598') ? d.slice(3).replace(/^0/, '') : d.replace(/^0/, ''); };
