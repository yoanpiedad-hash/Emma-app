# Noveno paso (después de agregar-etapa4.py): datos para Mabel + importar.js (traer un live de la app vieja) (guardado sin pagar, cobro agrupado, conversaciones, config).
# Uso: python3 agregar-mabel.py index.html
import sys
f = sys.argv[1]
s = open(f).read()
a = '<script src="pedidos4.js"></script>'
assert s.count(a) == 1
s = s.replace(a, a + '\n<script src="mabel.js"></script>\n<script src="importar.js"></script>')
open(f, 'w').write(s)
print('ok')
