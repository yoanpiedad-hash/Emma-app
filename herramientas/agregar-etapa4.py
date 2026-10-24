# Octavo paso (después de agregar-gestion.py): talles, escáner de prenda, promos y VIP en Pedidos.
# Uso: python3 agregar-etapa4.py index.html
import sys
f = sys.argv[1]
s = open(f).read()
a = '<script src="live.js"></script>'
assert s.count(a) == 1
s = s.replace(a, a + '\n<script src="promos.js"></script>\n<script src="pedidos4.js"></script>')
open(f, 'w').write(s)
print('ok')
