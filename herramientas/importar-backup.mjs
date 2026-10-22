// Sube un backup de Emma Pedidos (JSON "backup-completo") a Supabase.
// Uso: EMMA_EMAIL=... EMMA_PASS=... node importar-backup.mjs backup.json
// Usa upsert: correrlo dos veces no duplica nada.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createClient } = require(process.env.SUPABASE_JS || '@supabase/supabase-js');

const URL = 'https://ssipaovluukkypsbzboe.supabase.co';
const KEY = 'sb_publishable_-hoSPEhxcQoioc7Wit65iA_4cnM4nMC';
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const archivo = process.argv[2];
const b = JSON.parse(readFileSync(archivo, 'utf8'));
if (b.app !== 'emma' || !b.datos) throw new Error('No es un backup de Emma');
const d = b.datos;

const { error: eLogin } = await sb.auth.signInWithPassword({ email: process.env.EMMA_EMAIL, password: process.env.EMMA_PASS });
if (eLogin) throw eLogin;

async function subir(tabla, filas, conflicto = 'id') {
  for (let i = 0; i < filas.length; i += 400) {
    const parte = filas.slice(i, i + 400);
    const { error } = await sb.from(tabla).upsert(parte, { onConflict: conflicto });
    if (error) throw new Error(tabla + ': ' + error.message);
  }
  console.log(`${tabla}: ${filas.length}`);
}

const clientes = d.emma_clientes || [];
const idsCli = new Set(clientes.map(c => c.id));
await subir('clientas', clientes.map(c => ({ id: c.id, nombre: c.nombre || '', tel_key: c.telKey || '', datos: c })));

const lives = d.emma_lives || [];
await subir('lives', lives.map(l => { const { pedidos, ...resto } = l; return { id: l.id, nombre: l.nombre || '', fecha: l.fecha || null, datos: resto }; }));

const stock = d.emma_stock || [];
const idsStock = new Set(stock.map(s => s.id));
await subir('stock', stock.map(s => ({ id: s.id, codigo: s.codigo || '', datos: s })));

const pedidos = lives.flatMap(l => (l.pedidos || []).map(p => ({
  id: p.id, live_id: l.id, clienta_id: idsCli.has(p.clienteId) ? p.clienteId : null,
  num: +p.num || 0, codigo: String(p.codigo || p.id), estado: p.estado || 'pendiente', entrega: p.entrega || 'sin_definir', datos: p
})));
const sinCli = pedidos.filter(p => !p.clienta_id).length;
await subir('pedidos', pedidos);
if (sinCli) console.log(`  (ojo: ${sinCli} pedidos con clienta inexistente, quedan sin vínculo)`);

await subir('movimientos', (d.emma_movimientos || []).map(m => ({
  id: m.id, stock_id: idsStock.has(m.stockId) ? m.stockId : null, fecha: m.fecha || new Date().toISOString(),
  cantidad: +m.cantidad || 0, motivo: m.motivo || '', ref: m.ref || null
})));
await subir('mostrador', (d.emma_mostrador || []).map(v => ({ id: v.id, fecha: v.fecha || null, datos: v })));
await subir('compras', (d.emma_compras || []).map(c => ({ id: String(c.id), datos: c })));
await subir('config', Object.entries(d.emma_config || {}).map(([clave, valor]) => ({ clave, valor })), 'clave');
console.log('Listo.');
