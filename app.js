\
/**
 * ARK Story Generator (Luxury v1)
 * Local-only. Uses Canvas 2D.
 */

const W = 1080;
const H = 1920;

const els = {
  photo: document.getElementById('photo'),
  title: document.getElementById('title'),
  status: document.getElementById('status'),
  ctaEnabled: document.getElementById('ctaEnabled'),
  ctaText: document.getElementById('ctaText'),
  dim: document.getElementById('dim'),
  blur: document.getElementById('blur'),
  dimValue: document.getElementById('dimValue'),
  blurValue: document.getElementById('blurValue'),
  render: document.getElementById('render'),
  download: document.getElementById('download'),
  canvas: document.getElementById('canvas'),
  debug: document.getElementById('debug'),
};


function showDebug(msg){
  try{
    clearDebug();
    showDebug('Loading image…');
    if (!els.debug) return;
    els.debug.hidden = false;
    els.debug.textContent = msg;
  }catch(_){}
}
function clearDebug(){
  try{
    if (!els.debug) return;
    els.debug.hidden = true;
    els.debug.textContent = '';
  }catch(_){}
}
window.addEventListener('error', (e) => {
  showDebug('Error: ' + (e.message || e.error || e.type));
});
window.addEventListener('unhandledrejection', (e) => {
  showDebug('Unhandled promise rejection: ' + (e.reason && e.reason.message ? e.reason.message : String(e.reason)));
});
const ctx = els.canvas.getContext('2d');

let img = null;
let imgLoaded = false;

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

function normalizeSpaces(s){
  return (s || '').replace(/\s+/g, ' ').trim();
}

function toAllCaps(s){
  return normalizeSpaces(s).toUpperCase();
}

function setControlsEnabled(enabled){
  els.render.disabled = !enabled;
  els.download.disabled = !enabled;
}


async function ensureBrowserReadableImageFile(file){
  // Many phones (especially iPhone) produce HEIC/HEIF images that some browsers can't decode.
  // If heic2any is available, convert to JPEG in-browser.
  const name = ((file && file.name) || '').toLowerCase();
  const type = ((file && file.type) || '').toLowerCase();

  const isHeic = type.includes('heic') || type.includes('heif') || name.endsWith('.heic') || name.endsWith('.heif');
  if (!isHeic) return file;

  if (typeof heic2any !== 'function'){
    throw new Error('HEIC image detected but converter not available.');
  }

  const jpegBlob = await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: 0.92
  });

  const outBlob = Array.isArray(jpegBlob) ? jpegBlob[0] : jpegBlob;

  return new File([outBlob], (file.name || 'photo').replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
}

function loadImageFromFile(file){
  // Robust decode: try createImageBitmap, then fall back to objectURL Image(), then FileReader dataURL.
  return new Promise(async (resolve, reject) => {
    try{
      if (window.createImageBitmap){
        const bmp = await createImageBitmap(file);
        // Convert ImageBitmap into an HTMLImageElement for naturalWidth/Height compatibility
        const off = document.createElement('canvas');
        off.width = bmp.width;
        off.height = bmp.height;
        off.getContext('2d').drawImage(bmp, 0, 0);
        const dataUrl = off.toDataURL('image/png');
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = (e) => reject(e);
        i.src = dataUrl;
        return;
      }
    }catch(err){
      // continue to fallbacks
      console.warn('createImageBitmap failed, falling back', err);
    }

    // Fallback 1: objectURL
    try{
      const url = URL.createObjectURL(file);
      const i = new Image();
      i.onload = () => { URL.revokeObjectURL(url); resolve(i); };
      i.onerror = (e) => { URL.revokeObjectURL(url); throw e; };
      i.src = url;
      return;
    }catch(err){
      console.warn('objectURL load failed, falling back', err);
    }

    // Fallback 2: FileReader dataURL
    try{
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = reader.result;
      };
      reader.readAsDataURL(file);
    }catch(err){
      reject(err);
    }
  });
}

function drawCover(image, x, y, w, h){
  // Draw image to cover rectangle (fill + crop)
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  const scale = Math.max(w / iw, h / ih);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (iw - sw) / 2;
  const sy = (ih - sh) / 2;
  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
}

function drawContain(image, x, y, w, h){
  // Draw image contained within rectangle (fit, no crop)
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  const scale = Math.min(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.drawImage(image, dx, dy, dw, dh);
}

function drawPanelAndText(){
  // Bottom panel
  const panelY = 1680;
  const panelH = 240;

  ctx.save();
  ctx.fillStyle = '#F7F6F3';
  ctx.fillRect(0, panelY, W, panelH);

  // Divider line
  ctx.fillStyle = '#c19a6b';
  ctx.fillRect(480, 1704, 120, 2);

  // Title
  const titleRaw = toAllCaps(els.title.value || '');
  const title = titleRaw.length ? titleRaw : '—';
  const status = toAllCaps(els.status.value || 'AVAILABLE');

  // Typography
  // Note: letterSpacing isn't directly supported on canvas; we implement manual tracking.
  const titleBoxX = 96;
  const titleBoxW = 888;
  const titleY = 1748; // top of title box
  const titleMaxLines = 2;

  // Try to fit title within 2 lines by adjusting font size down to min 36.
  let fontSize = 44;
  const minFont = 36;
  const titleLineHeight = 52; // px
  const tracking = 0.04; // +4% of font size per char spacing (approx)

  // Ensure font loaded (best effort). Canvas will fallback if not.
  function measureTextWithTracking(text, size){
    ctx.font = `600 ${size}px "Playfair Display", serif`;
    const base = ctx.measureText(text).width;
    const extra = Math.max(0, text.length - 1) * (size * tracking);
    return base + extra;
  }

  function splitIntoLines(text, size){
    // Greedy wrap by words into <=2 lines, with tracking-aware measure.
    const words = text.split(' ');
    const lines = [];
    let line = '';

    for (const word of words){
      const test = line ? `${line} ${word}` : word;
      if (measureTextWithTracking(test, size) <= titleBoxW){
        line = test;
      } else {
        if (line) lines.push(line);
        line = word;
      }
      if (lines.length >= titleMaxLines) break;
    }
    if (lines.length < titleMaxLines && line) lines.push(line);

    // If we still have remaining words, append ellipsis to last line.
    const usedWords = lines.join(' ').split(' ').length;
    if (usedWords < words.length){
      const last = lines[lines.length - 1];
      let trimmed = last;
      while (trimmed.length > 0 && measureTextWithTracking(trimmed + '…', size) > titleBoxW){
        trimmed = trimmed.slice(0, -1);
      }
      lines[lines.length - 1] = (trimmed.length ? trimmed : last) + '…';
    }
    return lines;
  }

  let lines = splitIntoLines(title, fontSize);
  // If it overflows (needs >2 lines), reduce font.
  while (fontSize > minFont){
    lines = splitIntoLines(title, fontSize);
    // if first line too wide or we needed ellipsis too aggressively, still OK; we mainly enforce 2 lines.
    // We'll check max width of produced lines fits.
    const maxW = Math.max(...lines.map(l => measureTextWithTracking(l, fontSize)));
    if (maxW <= titleBoxW + 0.5 && lines.length <= 2) break;
    fontSize -= 1;
  }

  // Draw title lines (centered within title box)
  ctx.fillStyle = '#111111';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left'; // we'll manually center with tracking draw

  const totalTitleH = lines.length * titleLineHeight;
  const titleStartY = titleY; // keep anchored; spec uses fixed Y, not vertical centering inside panel
  for (let i = 0; i < lines.length; i++){
    drawTrackedCenteredText(lines[i], titleBoxX, titleStartY + i * titleLineHeight, titleBoxW, fontSize, 600, tracking, '#111111');
  }

  // Status
  drawTrackedCenteredText(status, 96, 1816, 888, 26, 400, 0.06, '#555555');

  ctx.restore();
}

function drawTrackedCenteredText(text, x, y, w, size, weight, trackingRatio, color){
  ctx.save();
  ctx.font = `${weight} ${size}px "Playfair Display", serif`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';

  // Total width with tracking
  const base = ctx.measureText(text).width;
  const track = Math.max(0, text.length - 1) * (size * trackingRatio);
  const total = base + track;

  let cursorX = x + (w - total) / 2;
  for (let i = 0; i < text.length; i++){
    const ch = text[i];
    ctx.fillText(ch, cursorX, y);
    const chW = ctx.measureText(ch).width;
    cursorX += chW + (size * trackingRatio);
  }
  ctx.restore();
}

function drawMicroCTA(){
  if (!els.ctaEnabled.checked) return;

  const cta = toAllCaps(els.ctaText.value || 'DM TO INQUIRE');
  const pad = 40;
  const y = 40;

  ctx.save();
  const size = 18;
  const tracking = 0.10;
  ctx.font = `400 ${size}px "Playfair Display", serif`;

  const base = ctx.measureText(cta).width;
  const extra = Math.max(0, cta.length - 1) * (size * tracking);
  const total = base + extra;

  const x = W - pad - total;
  drawTrackedCenteredText(cta, x, y, total, size, 400, tracking, 'rgba(119,119,119,0.8)');
  ctx.restore();
}

async function render(){
  if (!imgLoaded || !img) return;

  // Clear
  ctx.clearRect(0, 0, W, H);

  // Background (cover + blur)
  // Canvas blur can be expensive but OK for 1080x1920.
  const blurPx = parseInt(els.blur.value, 10) || 40;
  const dimPct = parseInt(els.dim.value, 10) || 15;

  ctx.save();
  ctx.filter = `blur(${blurPx}px)`;
  drawCover(img, 0, 0, W, H);
  ctx.restore();

  // Dim overlay
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${clamp(dimPct,0,40)/100})`;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // Foreground (contain, no crop)
  drawContain(img, 0, 0, W, H);

  // Panel + text
  drawPanelAndText();

  // CTA
  drawMicroCTA();
}

function downloadPNG(){
  const a = document.createElement('a');
  const titleSafe = (toAllCaps(els.title.value) || 'ARK-STORY').replace(/[^A-Z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g,'');
  a.download = `${titleSafe || 'ARK-STORY'}.png`;
  a.href = els.canvas.toDataURL('image/png');
  a.click();
}

els.dim.addEventListener('input', () => { els.dimValue.textContent = els.dim.value; });
els.blur.addEventListener('input', () => { els.blurValue.textContent = els.blur.value; });

els.photo.addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  try{
    const readableFile = await ensureBrowserReadableImageFile(file);
    img = await loadImageFromFile(readableFile);
    imgLoaded = true;
    showDebug('Image loaded. Rendering…');
    setControlsEnabled(true);
    // Render automatically once after image load
    await render();
    clearDebug();
  }catch(err){
    console.error(err);
    showDebug('Could not load image. Details: ' + (err && err.message ? err.message : String(err)) + '\n\nTry: a different JPEG, a PNG screenshot, or re-export the photo.');
    alert('Could not load that image. Open the debug box for details.');
  }
});

['input','change'].forEach(ev => {
  els.title.addEventListener(ev, () => render());
  els.status.addEventListener(ev, () => render());
  els.ctaEnabled.addEventListener(ev, () => render());
  els.ctaText.addEventListener(ev, () => render());
  els.dim.addEventListener(ev, () => render());
  els.blur.addEventListener(ev, () => render());
});

els.render.addEventListener('click', render);
els.download.addEventListener('click', downloadPNG);

// Initial placeholder (dark canvas)
ctx.fillStyle = '#111';
ctx.fillRect(0,0,W,H);
ctx.fillStyle = '#777';
ctx.font = '500 22px system-ui, sans-serif';
ctx.fillText('Upload a photo to begin', 40, 40);
