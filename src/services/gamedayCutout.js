// Detourage de la photo d'equipe, 100 % dans le navigateur (aucune photo n'est envoyee).
// Modele IS-Net (Apache-2.0) quantifie, servi depuis /gameday/isnet-q.onnx, execute par onnxruntime-web.
import * as ort from "onnxruntime-web/wasm";

const MODEL_URL = `${import.meta.env.BASE_URL}gameday/isnet-q.onnx`;
let sessionPromise = null;

// Resultats de detourage gardes en memoire (par fichier) : permet de retoucher puis de regenerer sans relancer le modele.
const cache = new WeakMap();

function getSession() {
  if (!sessionPromise) {
    ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ort.env.versions.web}/dist/`;
    ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;
    sessionPromise = ort.InferenceSession.create(MODEL_URL, { executionProviders: ["wasm"] }).catch((e) => {
      sessionPromise = null;
      throw e;
    });
  }
  return sessionPromise;
}

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export async function loadBitmapCanvas(file, maxSide) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const r = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = makeCanvas(bmp.width * r, bmp.height * r);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return c;
}

// Renvoie un masque 1024x1024 (Float32, 0..1)
async function predict1024(canvas) {
  const session = await getSession();
  const s = makeCanvas(1024, 1024);
  const sctx = s.getContext("2d");
  sctx.imageSmoothingQuality = "high";
  sctx.drawImage(canvas, 0, 0, 1024, 1024);
  const { data } = sctx.getImageData(0, 0, 1024, 1024);
  const n = 1024 * 1024;
  const input = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    input[i] = data[i * 4] / 255 - 0.5;
    input[n + i] = data[i * 4 + 1] / 255 - 0.5;
    input[2 * n + i] = data[i * 4 + 2] / 255 - 0.5;
  }
  const feeds = { [session.inputNames[0]]: new ort.Tensor("float32", input, [1, 3, 1024, 1024]) };
  const out = await session.run(feeds);
  const y = out[session.outputNames[0]].data;
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < n; i++) { if (y[i] < mn) mn = y[i]; if (y[i] > mx) mx = y[i]; }
  const res = new Float32Array(n);
  const d = mx - mn + 1e-6;
  for (let i = 0; i < n; i++) res[i] = (y[i] - mn) / d;
  return res;
}

// Masque 1024 -> Uint8 a la taille (w, h), interpolation douce
function upscaleMask(mask, w, h, src = [0, 0, 1024, 1024]) {
  const g = makeCanvas(1024, 1024);
  const gctx = g.getContext("2d");
  const id = gctx.createImageData(1024, 1024);
  for (let i = 0; i < mask.length; i++) {
    const v = Math.max(0, Math.min(255, Math.round(mask[i] * 255)));
    id.data[i * 4] = v; id.data[i * 4 + 1] = v; id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255;
  }
  gctx.putImageData(id, 0, 0);
  const o = makeCanvas(w, h);
  const octx = o.getContext("2d");
  octx.imageSmoothingQuality = "high";
  octx.drawImage(g, src[0], src[1], src[2], src[3], 0, 0, w, h);
  const d = octx.getImageData(0, 0, w, h).data;
  const a = new Uint8Array(w * h);
  for (let i = 0; i < a.length; i++) a[i] = d[i * 4];
  return a;
}

// ---------- grille reduite : on garde tout ce qui est relie a une personne ----------
function dilate(src, w, h, r) {
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = 0;
    for (let dx = -r; dx <= r && !v; dx++) { const xx = x + dx; if (xx >= 0 && xx < w && src[y * w + xx]) v = 1; }
    tmp[y * w + x] = v;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = 0;
    for (let dy = -r; dy <= r && !v; dy++) { const yy = y + dy; if (yy >= 0 && yy < h && tmp[yy * w + x]) v = 1; }
    out[y * w + x] = v;
  }
  return out;
}

/** Composantes de `low` qui contiennent au moins un pixel `strong` et dont la surface depasse minArea. */
function keepConnected(low, strong, w, h, minArea) {
  const label = new Int32Array(w * h);
  const keep = new Uint8Array(w * h);
  const stack = [];
  let id = 0;
  for (let i = 0; i < w * h; i++) {
    if (!low[i] || label[i]) continue;
    id++;
    const members = [];
    let hasStrong = false;
    stack.push(i);
    label[i] = id;
    while (stack.length) {
      const p = stack.pop();
      members.push(p);
      if (strong[p]) hasStrong = true;
      const x = p % w, y = (p / w) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const q = yy * w + xx;
        if (low[q] && !label[q]) { label[q] = id; stack.push(q); }
      }
    }
    if (hasStrong && members.length >= minArea) for (const m of members) keep[m] = 1;
  }
  return keep;
}

/**
 * Detoure la photo. Retourne { orig: canvas (RGB, recadre), alpha: Uint8ClampedArray, w, h }.
 * Le resultat est mis en cache pour permettre la retouche.
 */
export async function getCutout(file, onProgress = () => {}) {
  if (cache.has(file)) return cache.get(file);

  onProgress("Chargement de la photo…");
  const full = await loadBitmapCanvas(file, 3200);

  onProgress("Chargement du modèle de détourage (la première fois, ~45 Mo)…");
  await getSession();

  onProgress("Détourage, passe 1/2…");
  const m1 = await predict1024(full);
  let x0 = 1024, y0 = 1024, x1 = 0, y1 = 0;
  for (let y = 0; y < 1024; y++) for (let x = 0; x < 1024; x++) {
    if (m1[y * 1024 + x] > 0.5) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 <= x0 || y1 <= y0) throw new Error("Aucune personne détectée sur la photo.");
  const sx = full.width / 1024, sy = full.height / 1024;
  const mx = full.width * 0.03, my = full.height * 0.03;
  const bx0 = Math.max(0, Math.floor(x0 * sx - mx)), by0 = Math.max(0, Math.floor(y0 * sy - my));
  const bx1 = Math.min(full.width, Math.ceil((x1 + 1) * sx + mx)), by1 = Math.min(full.height, Math.ceil((y1 + 1) * sy + my));

  const cw = bx1 - bx0, ch = by1 - by0;
  const rs = Math.min(1, 1800 / cw);
  const crop = makeCanvas(cw * rs, ch * rs);
  const cctx = crop.getContext("2d");
  cctx.imageSmoothingQuality = "high";
  cctx.drawImage(full, bx0, by0, cw, ch, 0, 0, crop.width, crop.height);
  const W = crop.width, H = crop.height;

  onProgress("Détourage, passe 2/2…");
  const m2 = await predict1024(crop);
  const a2 = upscaleMask(m2, W, H);
  // la passe 1 (photo entiere) est parfois plus fiable sur les visages : on garde le meilleur des deux
  const a1 = upscaleMask(m1, W, H, [bx0 / sx, by0 / sy, cw / sx, ch / sy]);
  const a = new Uint8Array(W * H);
  for (let i = 0; i < a.length; i++) a[i] = a2[i];
  void a1;

  onProgress("Nettoyage du détourage…");
  // Grille /4 (maximum par bloc pour ne pas perdre les parties fines).
  const f = 4;
  const sw = Math.ceil(W / f), sh = Math.ceil(H / f);
  const low = new Uint8Array(sw * sh);
  const strong = new Uint8Array(sw * sh);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = a[y * W + x];
    if (v > 100) {
      const k = ((y / f) | 0) * sw + ((x / f) | 0);
      low[k] = 1;
      if (v > 170) strong[k] = 1;
    }
  }
  // Ouverture (retire les lignes fines du sol), composantes principales, puis reprise des parties fines proches du corps.
  const inv = new Uint8Array(low.length);
  for (let i = 0; i < low.length; i++) inv[i] = low[i] ? 0 : 1;
  const eroded = dilate(inv, sw, sh, 2);
  for (let i = 0; i < eroded.length; i++) eroded[i] = eroded[i] ? 0 : 1;
  const opened = dilate(eroded, sw, sh, 2);
  const core = new Uint8Array(low.length);
  for (let i = 0; i < core.length; i++) core[i] = opened[i] && low[i] ? 1 : 0;
  const kept = keepConnected(core, strong, sw, sh, Math.round(0.003 * W * H / (f * f)));
  // Trous dans la silhouette (visages ou torses que le modele a mal classes) : tout ce qui est entoure par la personne est rempli.
  const closed = dilate(kept, sw, sh, 2);
  const outside = new Uint8Array(sw * sh);
  const fstack = [];
  const seed = (i) => { if (!closed[i] && !outside[i]) { outside[i] = 1; fstack.push(i); } };
  for (let x = 0; x < sw; x++) { seed(x); seed((sh - 1) * sw + x); }
  for (let y = 0; y < sh; y++) { seed(y * sw); seed(y * sw + sw - 1); }
  while (fstack.length) {
    const p = fstack.pop();
    const x = p % sw, y = (p / sw) | 0;
    if (x > 0) seed(p - 1);
    if (x < sw - 1) seed(p + 1);
    if (y > 0) seed(p - sw);
    if (y < sh - 1) seed(p + sw);
  }
  const rawHoles = new Uint8Array(sw * sh);
  for (let i = 0; i < rawHoles.length; i++) rawHoles[i] = !closed[i] && !outside[i] ? 1 : 0;
  // on ne bouche que les petits trous (visage, torse) pas les grands espaces entre deux personnes
  const holes = new Uint8Array(sw * sh);
  {
    const lab = new Uint8Array(sw * sh);
    const maxHole = Math.round(0.002 * sw * sh);
    for (let i = 0; i < rawHoles.length; i++) {
      if (!rawHoles[i] || lab[i]) continue;
      const mem = [];
      const st = [i];
      lab[i] = 1;
      while (st.length) {
        const q = st.pop();
        mem.push(q);
        const x = q % sw, y = (q / sw) | 0;
        if (x > 0 && rawHoles[q - 1] && !lab[q - 1]) { lab[q - 1] = 1; st.push(q - 1); }
        if (x < sw - 1 && rawHoles[q + 1] && !lab[q + 1]) { lab[q + 1] = 1; st.push(q + 1); }
        if (y > 0 && rawHoles[q - sw] && !lab[q - sw]) { lab[q - sw] = 1; st.push(q - sw); }
        if (y < sh - 1 && rawHoles[q + sw] && !lab[q + sw]) { lab[q + sw] = 1; st.push(q + sw); }
      }
      if (mem.length <= maxHole) for (const m of mem) holes[m] = 1;
    }
  }
  const fill = dilate(holes, sw, sh, 2);
  const solid = new Uint8Array(sw * sh);
  for (let i = 0; i < solid.length; i++) solid[i] = kept[i] || fill[i] ? 1 : 0;
  const gate = dilate(solid, sw, sh, 6);

  const gc = makeCanvas(sw, sh);
  const gid = gc.getContext("2d").createImageData(sw, sh);
  for (let i = 0; i < gate.length; i++) { const v = gate[i] ? 255 : 0; gid.data[i * 4] = v; gid.data[i * 4 + 1] = v; gid.data[i * 4 + 2] = v; gid.data[i * 4 + 3] = 255; }
  gc.getContext("2d").putImageData(gid, 0, 0);
  const gf = makeCanvas(W, H);
  const gfctx = gf.getContext("2d");
  gfctx.imageSmoothingQuality = "high";
  gfctx.filter = "blur(2px)";
  gfctx.drawImage(gc, 0, 0, W, H);
  const gd = gfctx.getImageData(0, 0, W, H).data;

  const alpha = new Uint8ClampedArray(W * H);
  for (let i = 0; i < alpha.length; i++) {
    const g = gd[i * 4] / 255;
    // seuils tolerants : on garde les bords fins (cheveux, mains)
    const inHole = fill[(((i / W) | 0) / f | 0) * sw + (((i % W) / f) | 0)];
    const v = inHole ? 1 : Math.max(0, Math.min(1, (a[i] - 70) / 60));
    alpha[i] = Math.round(v * g * 255);
  }
  const result = { orig: crop, alpha, alpha0: new Uint8ClampedArray(alpha), w: W, h: H };
  cache.set(file, result);
  return result;
}

/**
 * Canvas RGBA recadre sur les personnes, a partir d'un resultat de detourage.
 * opts.fondu : au lieu d'un detourage net, la photo reste visible autour des personnes et s'estompe en douceur.
 */
export function cutoutToCanvas(cut, opts = {}) {
  const { orig, alpha, w, h } = cut;
  const o = makeCanvas(w, h);
  const octx = o.getContext("2d");
  octx.drawImage(orig, 0, 0);
  const id = octx.getImageData(0, 0, w, h);
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    id.data[i * 4 + 3] = alpha[i];
    if (alpha[i] > 20) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  if (maxX < 0) throw new Error("Détourage vide : essaie une autre photo ou retouche-le.");

  if (opts.fondu) {
    // silhouette elargie puis tres floutee : sert de masque pour fondre la photo dans le fond
    const sil = makeCanvas(w, h);
    const sctx = sil.getContext("2d");
    sctx.putImageData(id, 0, 0);
    const shape = makeCanvas(w, h);
    const hctx = shape.getContext("2d");
    const grow = Math.round(Math.max(w, h) * 0.018);
    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2;
      hctx.drawImage(sil, Math.cos(ang) * grow, Math.sin(ang) * grow);
    }
    hctx.drawImage(sil, 0, 0);
    const soft = makeCanvas(w, h);
    const softCtx = soft.getContext("2d");
    softCtx.filter = `blur(${Math.round(Math.max(w, h) * 0.022)}px)`;
    softCtx.drawImage(shape, 0, 0);
    const out = makeCanvas(w, h);
    const ctx2 = out.getContext("2d");
    ctx2.drawImage(orig, 0, 0);
    ctx2.globalCompositeOperation = "destination-in";
    ctx2.drawImage(soft, 0, 0);
    const pad = Math.round(Math.max(w, h) * 0.05);
    const x0 = Math.max(0, minX - pad), y0 = Math.max(0, minY - pad);
    const x1 = Math.min(w, maxX + pad), y1 = Math.min(h, maxY + pad);
    const res = makeCanvas(x1 - x0, y1 - y0);
    res.getContext("2d").drawImage(out, x0, y0, res.width, res.height, 0, 0, res.width, res.height);
    return res;
  }

  octx.putImageData(id, 0, 0);
  const res = makeCanvas(maxX - minX + 1, maxY - minY + 1);
  res.getContext("2d").drawImage(o, minX, minY, res.width, res.height, 0, 0, res.width, res.height);
  return res;
}

/** Detoure l'equipe. Retourne un canvas RGBA recadre sur les personnes. */
export async function cutTeam(file, onProgress = () => {}, opts = {}) {
  return cutoutToCanvas(await getCutout(file, onProgress), opts);
}
