# Quinto paso (después de agregar-escaner.py): etiqueta al cargar prenda, versión visible y recarga automática.
# Uso: python3 agregar-etiquetas.py index.html
import sys
f = sys.argv[1]
s = open(f).read()
a = '<script src="escaner.js"></script>'
assert s.count(a) == 1
s = s.replace(a, a + '\n<script src="etiquetas.js"></script>')
open(f, 'w').write(s)
print('ok')
