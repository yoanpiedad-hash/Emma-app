# Sexto paso (después de agregar-etiquetas.py): Live simple y etiqueta general igual para todos.
# Uso: python3 agregar-live.py index.html
import sys
f = sys.argv[1]
s = open(f).read()
a = '<script src="etiquetas.js"></script>'
assert s.count(a) == 1
s = s.replace(a, a + '\n<script src="live.js"></script>')
open(f, 'w').write(s)
print('ok')
