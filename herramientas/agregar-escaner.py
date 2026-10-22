# Cuarto paso (después de agregar-pagos.py): escáner con cámara y etiquetas QR.
# Uso: python3 agregar-escaner.py index.html
import sys
f = sys.argv[1]
s = open(f).read()
a = '<script src="pagos.js"></script>'
assert s.count(a) == 1
s = s.replace(a, a + '\n<script src="vendor/qrcode-generator-1.4.4.js"></script>\n<script src="escaner.js"></script>')
open(f, 'w').write(s)
print('ok')
