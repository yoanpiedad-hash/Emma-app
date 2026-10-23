'use strict';
/* ══════════════════════════════════════════════════════════════
   EMMA · ESCÁNER CON CÁMARA + ETIQUETAS QR
   - Las etiquetas pasan a QR con el código del pedido (se lee rápido y en cualquier ángulo).
     Las etiquetas viejas con código de barras se siguen leyendo con el lector USB.
   - Botón 📷 en Despacho y Pagos: abre la cámara trasera y lee QR (de Emma o de GrisalExpress).
     Usa el lector del navegador (BarcodeDetector, Android/Chrome) y si no está, jsQR (iPhone, compu).
   ══════════════════════════════════════════════════════════════ */

(() => {
  const st = document.createElement('style');
  st.textContent = `
.l-bc svg[data-qr]{width:15mm;height:15mm;margin:0 auto}
.sheet-t .l-bc svg[data-qr]{width:30mm;height:30mm}
#cam{position:fixed;inset:0;z-index:950;background:#000;display:flex;flex-direction:column}
#cam video{flex:1;width:100%;min-height:0;object-fit:cover}
#cam .guia{position:absolute;left:50%;top:45%;width:min(68vw,320px);aspect-ratio:1;transform:translate(-50%,-50%);border:3px solid #fff;border-radius:18px;box-shadow:0 0 0 100vmax #0007;pointer-events:none}
#cam .guia.ok{border-color:var(--ok)}
#cam .bar{position:absolute;left:0;right:0;bottom:0;padding:16px 16px calc(16px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:10px;align-items:center;background:linear-gradient(transparent,#000c)}
#cam .txt{color:#fff;font-weight:700;font-size:16px;text-align:center}
`;
  document.head.appendChild(st);
})();

// ─── Etiquetas con QR ─────────────────────────────────────────
const _barcodeSVG = barcodeSVG;
barcodeSVG = function (text) {
  if (typeof qrcode !== 'function') return _barcodeSVG(text);
  try {
    const q = qrcode(0, 'M'); q.addData(String(text)); q.make();
    const n = q.getModuleCount(), m = 2;
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`;
    return `<svg viewBox="0 0 ${n + 2 * m} ${n + 2 * m}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" data-qr="${esc(text)}"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  } catch (e) { return _barcodeSVG(text); }
};

// ─── Cámara ───────────────────────────────────────────────────
const CAM = { stream: null, timer: null, det: null, onCode: null, abierta: false };
function cargarScript(src) {
  return new Promise((res, rej) => { if (document.querySelector(`script[src="${src}"]`)) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('No cargó ' + src)); document.head.appendChild(s); });
}
async function abrirCamara(onCode, texto) {
  if (CAM.abierta) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return alert('Este navegador no deja usar la cámara. Abrí la app desde Chrome o Safari (con https).');
  CAM.abierta = true; CAM.onCode = onCode;
  const el = document.createElement('div'); el.id = 'cam';
  el.innerHTML = `<video playsinline muted autoplay></video><div class="guia"></div>
    <div class="bar"><div class="txt" id="cam-txt">${esc(texto || 'Apuntá al código de la etiqueta')}</div><button class="b lg" data-act="camCerrar" style="min-width:160px">✕ Cerrar</button></div>`;
  document.body.appendChild(el);
  const video = el.querySelector('video');
  try {
    CAM.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
  } catch (e) {
    cerrarCamara();
    return alert(/NotAllowed|Permission/i.test(e.name + e.message) ? '📷 No hay permiso para la cámara. Habilitalo en los ajustes del navegador para este sitio y probá de nuevo.' : '📷 No se pudo abrir la cámara: ' + e.message);
  }
  if (!CAM.abierta) { CAM.stream.getTracks().forEach(t => t.stop()); return; }
  video.srcObject = CAM.stream;
  try { await video.play(); } catch (e) { /* algunos navegadores arrancan solos */ }
  CAM.det = null;
  try {
    if ('BarcodeDetector' in window) {
      const sop = await BarcodeDetector.getSupportedFormats();
      if (sop.includes('qr_code')) CAM.det = new BarcodeDetector({ formats: ['qr_code', 'code_128'].filter(f => sop.includes(f)) });
    }
  } catch (e) { CAM.det = null; }
  if (!CAM.det) { try { await cargarScript('vendor/jsqr-1.4.0.js'); } catch (e) { cerrarCamara(); return alert('No se pudo cargar el lector de QR. Revisá la conexión.'); } }
  const cv = document.createElement('canvas'), ctx = cv.getContext('2d', { willReadFrequently: true });
  const mirar = async () => {
    if (!CAM.abierta) return;
    let txt = null;
    try {
      if (video.readyState >= 2 && video.videoWidth) {
        if (CAM.det) { const r = await CAM.det.detect(video); if (r && r.length) txt = r[0].rawValue; }
        else {
          const k = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight));
          cv.width = Math.round(video.videoWidth * k); cv.height = Math.round(video.videoHeight * k);
          ctx.drawImage(video, 0, 0, cv.width, cv.height);
          const img = ctx.getImageData(0, 0, cv.width, cv.height);
          const r = jsQR(img.data, cv.width, cv.height, { inversionAttempts: 'attemptBoth' });
          if (r && r.data) txt = r.data;
        }
      }
    } catch (e) { /* cuadro malo: sigue */ }
    if (txt && String(txt).trim()) {
      const g = el.querySelector('.guia'); if (g) g.classList.add('ok');
      try { navigator.vibrate && navigator.vibrate(80); } catch (e) {}
      const cb = CAM.onCode;
      setTimeout(() => { cerrarCamara(); cb && cb(String(txt).trim()); }, 150);
      return;
    }
    CAM.timer = setTimeout(mirar, 120);
  };
  mirar();
}
function cerrarCamara() {
  CAM.abierta = false;
  clearTimeout(CAM.timer);
  if (CAM.stream) { CAM.stream.getTracks().forEach(t => t.stop()); CAM.stream = null; }
  const el = document.getElementById('cam'); if (el) el.remove();
}

// ─── Qué hace cada pantalla con lo leído ──────────────────────
function codigoLeido(t) {
  const s = String(t).trim();
  if (esGrisal(s)) return s.toUpperCase();
  const d = s.replace(/\D/g, '');
  return d.length >= 3 && d.length <= 6 && /^\D*\d+\D*$/.test(s) ? d.padStart(5, '0') : s;
}
function camEnDespacho() {
  abrirCamara(t => {
    const v = codigoLeido(t);
    UI.desp.q = v; const q = $('#dsp-q'); if (q) q.value = v;
    buscarEnter();
  }, 'Apuntá al QR de la etiqueta (Emma o GrisalExpress)');
}
function camEnPagos() {
  abrirCamara(t => {
    const v = codigoLeido(t);
    if (esGrisal(v)) return toast('Esa es la etiqueta de GrisalExpress: para pagos escaneá la de Emma', 4000);
    const p = todosPedidos().find(x => x.codigo === v);
    if (!p) { UI.pag.q = v; const q = $('#pg-q'); if (q) q.value = v; renderPagLista(); return toast('No hay un pedido con ese código', 3000); }
    if (pagado(p)) { const c = cliById(p.clienteId) || { nombre: '?' }; return toast(`#${p.num} ${c.nombre} ya figura pagado${p.pago ? ' (' + p.pago.cuenta + ')' : ''}`, 4000); }
    ACT.pagElegir({ id: p.id });
  }, 'Apuntá al QR de la etiqueta del pedido');
}
const tactil = () => window.matchMedia && matchMedia('(pointer:coarse)').matches;
Object.assign(ACT, {
  camDesp: () => camEnDespacho(),
  camPag: () => camEnPagos(),
  camCerrar: () => cerrarCamara(),
  // Barra del celular: "Escanear" abre Despacho con la cámara directamente
  bbScan: () => { setTab('despacho'); if (tactil()) camEnDespacho(); else setTimeout(() => { const el = $('#dsp-q'); if (el) el.focus(); }, 30); }
});
document.addEventListener('keydown', e => { if (CAM.abierta && e.key === 'Escape') cerrarCamara(); }, true);
document.addEventListener('visibilitychange', () => { if (document.hidden && CAM.abierta) cerrarCamara(); });
