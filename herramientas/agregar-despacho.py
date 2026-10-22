# Segundo paso después de generar-index.py: suma la pestaña Despacho (despacho.js),
# los paquetes y los pagos. Uso: python3 agregar-despacho.py index.html
import sys
f = sys.argv[1]
s = open(f).read()
def R(a, b, n=1):
    global s
    c = s.count(a)
    assert c == n, (a[:100], c)
    s = s.replace(a, b)

# Pestaña: Despacho reemplaza a Salidas (Salidas queda en el código, sin botón)
R('<button class="tab" data-act="tab" data-t="salidas">🚚 Salidas</button>',
  '<button class="tab" data-act="tab" data-t="despacho">🚚 Despacho<span id="bdg-desp"></span></button>')
R('<!-- ═════════ SALIDAS ═════════ -->', '''<!-- ═════════ DESPACHO ═════════ -->
<section class="panel" id="p-despacho"></section>

<!-- ═════════ SALIDAS ═════════ -->''')
R("    else if (UI.tab === 'salidas') renderSalidas();",
  "    else if (UI.tab === 'salidas') renderSalidas();\n    else if (UI.tab === 'despacho') renderDespacho();")
R("""  $('#bdg-guard').innerHTML = rojos ? ` <span class="bdg red">🔴${rojos}</span>` : '';
}""", """  $('#bdg-guard').innerHTML = rojos ? ` <span class="bdg red">🔴${rojos}</span>` : '';
  if (typeof despBadge === 'function') despBadge();
}""")
R("  bbScan: () => { setTab('salidas'); setTimeout(() => (UI.salida && !UI.salida.cerrada ? $('#scan-in') : $('#bus-cod')).focus(), 30); },",
  "  bbScan: () => { setTab('despacho'); setTimeout(() => { const el = $('#dsp-q'); if (el) el.focus(); }, 30); },")

# Datos: paquetes y pagos en memoria, en la nube y en los backups
R("const DB = { clientes: [], lives: [], stock: [], movimientos: [], mostrador: [], config: {}, respaldos: [] };",
  "const DB = { clientes: [], lives: [], stock: [], movimientos: [], mostrador: [], config: {}, paquetes: [], pagos: [], respaldos: [] };")
R("emma_config: () => DB.config, emma_compras: () => NUBE.compras };",
  "emma_config: () => DB.config, emma_compras: () => NUBE.compras, emma_paquetes: () => DB.paquetes, emma_pagos: () => DB.pagos };")
R("emma_mostrador: DB.mostrador, emma_config: DB.config };\n  const comp = leer('emma_compras', null);",
  "emma_mostrador: DB.mostrador, emma_config: DB.config, emma_paquetes: DB.paquetes, emma_pagos: DB.pagos };\n  const comp = leer('emma_compras', null);")
R("const KEYS = ['emma_clientes', 'emma_lives', 'emma_stock', 'emma_movimientos', 'emma_mostrador', 'emma_compras', 'emma_config'];",
  "const KEYS = ['emma_clientes', 'emma_lives', 'emma_stock', 'emma_movimientos', 'emma_mostrador', 'emma_compras', 'emma_config', 'emma_paquetes', 'emma_pagos'];")
R("""  if (d.emma_config) DB.config = d.emma_config;
  nubeCambioTodo(); render();""", """  if (d.emma_config) DB.config = d.emma_config;
  if (d.emma_paquetes) DB.paquetes = d.emma_paquetes;
  if (d.emma_pagos) DB.pagos = d.emma_pagos;
  nubeCambioTodo(); render();""")

R("navigator.serviceWorker.register('sw.js').catch(() => {});\n</script>",
  "navigator.serviceWorker.register('sw.js').catch(() => {});\n</script>\n<script src=\"despacho.js\"></script>")
open(f, 'w').write(s)
print('ok')
