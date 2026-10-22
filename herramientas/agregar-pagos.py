# Tercer paso (después de agregar-despacho.py): pestaña Pagos y orden de pestañas.
# Uso: python3 agregar-pagos.py index.html
import sys
f = sys.argv[1]
s = open(f).read()
def R(a, b, n=1):
    global s
    c = s.count(a)
    assert c == n, (a[:100], c)
    s = s.replace(a, b)

# Orden: Despacho, Pagos, Live, Clientes, Guardados, Mostrador, Config (Live sigue abriendo por defecto)
R('''  <button class="tab on" data-act="tab" data-t="live">📦 Live</button>
  <button class="tab" data-act="tab" data-t="clientes">👥 Clientes</button>
  <button class="tab" data-act="tab" data-t="guardados">📦 Guardados<span id="bdg-guard"></span></button>
  <button class="tab" data-act="tab" data-t="despacho">🚚 Despacho<span id="bdg-desp"></span></button>
  <button class="tab" data-act="tab" data-t="mostrador">🏪 Mostrador</button>''', '''  <button class="tab" data-act="tab" data-t="despacho">🚚 Despacho<span id="bdg-desp"></span></button>
  <button class="tab" data-act="tab" data-t="pagos">💸 Pagos</button>
  <button class="tab on" data-act="tab" data-t="live">📦 Live</button>
  <button class="tab" data-act="tab" data-t="clientes">👥 Clientes</button>
  <button class="tab" data-act="tab" data-t="guardados">📦 Guardados<span id="bdg-guard"></span></button>
  <button class="tab" data-act="tab" data-t="mostrador">🏪 Mostrador</button>''')
R('<section class="panel" id="p-despacho"></section>',
  '<section class="panel" id="p-despacho"></section>\n<section class="panel" id="p-pagos"></section>')
R("    else if (UI.tab === 'despacho') renderDespacho();",
  "    else if (UI.tab === 'despacho') renderDespacho();\n    else if (UI.tab === 'pagos') renderPagos();")
# Barra del celular: Pagos en lugar de Etiquetas (imprimir conviene desde la compu)
R('  <button class="b" data-act="etiquetasLive">🏷️ Etiquetas</button>\n</nav>',
  '  <button class="b" data-act="tab" data-t="pagos">💸 Pagos</button>\n</nav>')
R('<script src="despacho.js"></script>', '<script src="despacho.js"></script>\n<script src="pagos.js"></script>')
open(f, 'w').write(s)
print('ok')
