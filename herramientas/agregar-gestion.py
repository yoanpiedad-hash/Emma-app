# Séptimo paso (después de agregar-live.py): botón a Emma Gestión y versión compartida (version.js).
# Uso: python3 agregar-gestion.py index.html
import sys
f = sys.argv[1]
s = open(f).read()
def R(a, b):
    global s
    assert s.count(a) == 1, (a, s.count(a))
    s = s.replace(a, b)
R('<span id="nube-estado" class="nube">☁️</span>\n</header>',
  '<span id="nube-estado" class="nube">☁️</span>\n  <a class="b sm" href="gestion.html" title="Ir a Emma Gestión" style="text-decoration:none">📊<span class="hide-m"> Gestión</span></a>\n</header>')
R('<script src="nube.js"></script>', '<script src="version.js"></script>\n<script src="nube.js"></script>')
open(f, 'w').write(s)
print('ok')
