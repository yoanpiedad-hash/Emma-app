# Décimo paso (después de agregar-mabel.py): pestaña Mabel (derivados por categoría, conversaciones, ajustes).
# Uso: python3 agregar-mabeltab.py index.html
import sys
f = sys.argv[1]
s = open(f).read()
a = '  <button class="tab on" data-act="tab" data-t="live">📦 Live</button>\n'
assert s.count(a) == 1
s = s.replace(a, a + '  <button class="tab" data-act="tab" data-t="mabel">🤖 Mabel<span id="bdg-mabel"></span></button>\n')
a = '<section class="panel" id="p-clientes">'
assert s.count(a) == 1
s = s.replace(a, """<section class="panel" id="p-mabel">
  <div id="mbt-sub" class="ptabs"></div>
  <div id="mbt-deriv"></div>
  <div id="mbt-conv" hidden>
    <input id="mbt-q" data-inp="mbConvQ" placeholder="🔎 Nombre, usuario o teléfono…" class="mb" autocomplete="off">
    <div id="mbt-conv-f" class="ptabs"></div>
    <div id="mbt-conv-l"></div>
  </div>
  <div id="mbt-aj" hidden><div id="mbt-pausa"></div></div>
  <div id="mbt-madre" hidden><div class="card"><div class="card-t">🧠 Chat madre</div><p class="small muted">Todavía no está. La idea: escribirle a Mabel por WhatsApp para preguntarle cosas y darle instrucciones, y ver ese chat acá.</p></div></div>
</section>
""" + a)
a = '<script src="mabel.js"></script>'
assert s.count(a) == 1
s = s.replace(a, a + '\n<script src="mabeltab.js"></script>')
open(f, 'w').write(s)
print('ok')
