// Detourage de la photo d'equipe, 100 % dans le navigateur (aucune photo n'est envoyee).
// Modele IS-Net (Apache-2.0) quantifie, servi depuis /gameday/isnet-q.onnx, execute par onnxruntime-web.
import * as ort from "onnxruntime-web/wasm";

const MODEL_URL = `${import.meta.env.BASE_URL}gameday/isnet-q.onnx`;
let sessionPromise = null;

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
function upscaleMask(mask, w, h) {
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
  octx.drawImage(g, 0, 0, w, h);
  const d = octx.getImageData(0, 0, w, h).data;
  const a = new Uint8Array(w * h);
  for (let i = 0; i < a.length; i++) a[i] = d[i * 4];
  return a;
}

// ---------- morphologie sur grille reduite ----------
function boxFilter(src, w, h, k, isMax) {
  const r = Math.floor(k / 2);
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = isMax ? 0 : 1;
      for (let dx = -r; dx <= r; dx++) {
        const xx = x + dx;
        const p = xx < 0 || xx >= w ? (isMax ? 0 : 1) : src[y * w + xx];
        if (isMax) { if (p > v) v = p; } else if (p < v) v = p;
      }
      tmp[y * w + x] = v;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = isMax ? 0 : 1;
      for (let dy = -r; dy <= r; dy++) {
        const yy = y + dy;
        const p = yy < 0 || yy >= h ? (isMax ? 0 : 1) : tmp[yy * w + x];
        if (isMax) { if (p > v) v = p; } else if (p < v) v = p;
      }
      out[y * w + x] = v;
    }
  }
  return out;
}

function keepLargeComponents(bin, w, h, minArea) {
  const label = new Int32Array(w * h);
  const keep = new Uint8Array(w * h);
  const stack = [];
  let id = 0;
  for (let i = 0; i < w * h; i++) {
    if (!bin[i] || label[i]) continue;
    id++;
    const members = [];
    stack.push(i);
    label[i] = id;
    while (stack.length) {
      const p = stack.pop();
      members.push(p);
      const x = p % w, y = (p / w) | 0;
      if (x > 0 && bin[p - 1] && !label[p - 1]) { label[p - 1] = id; stack.push(p - 1); }
      if (x < w - 1 && bin[p + 1] && !label[p + 1]) { label[p + 1] = id; stack.push(p + 1); }
      if (y > 0 && bin[p - w] && !label[p - w]) { label[p - w] = id; stack.push(p - w); }
      if (y < h - 1 && bin[p + w] && !label[p + w]) { label[p + w] = id; stack.push(p + w); }
    }
    if (members.length >= minArea) for (const m of members) keep[m] = 1;
  }
  return keep;
}

/**
 * Detoure l'equipe. Retourne un canvas RGBA recadre sur les personnes.
 */
export async function cutTeam(file, onProgress = () => {}) {
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

  let cw = bx1 - bx0, ch = by1 - by0;
  const rs = Math.min(1, 1800 / cw);
  const crop = makeCanvas(cw * rs, ch * rs);
  const cctx = crop.getContext("2d");
  cctx.imageSmoothingQuality = "high";
  cctx.drawImage(full, bx0, by0, cw, ch, 0, 0, crop.width, crop.height);
  const W = crop.width, H = crop.height;

  onProgress("Détourage, passe 2/2…");
  const m2 = await predict1024(crop);
  const a = upscaleMask(m2, W, H);

  onProgress("Nettoyage du détourage…");
  // grille reduite /4 : ouverture (retire lignes du sol), petits ilots, puis reprise
  const f = 4;
  const sw = Math.ceil(W / f), sh = Math.ceil(H / f);
  const small = new Uint8Array(sw * sh);
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    small[y * sw + x] = a[Math.min(H - 1, y * f) * W + Math.min(W - 1, x * f)] > 110 ? 1 : 0;
  }
  const k = Math.max(3, Math.round((Math.max(15, W * 0.017)) / f) | 1);
  const opened = boxFilter(boxFilter(small, sw, sh, k, false), sw, sh, k, true);
  const big = keepLargeComponents(opened, sw, sh, Math.round(0.004 * W * H / (f * f)));
  const gate = boxFilter(big, sw, sh, Math.max(3, k - 1) | 1, true);

  // gate -> pleine resolution, bord adouci
  const gc = makeCanvas(sw, sh);
  const gid = gc.getContext("2d").createImageData(sw, sh);
  for (let i = 0; i < gate.length; i++) { const v = gate[i] ? 255 : 0; gid.data[i * 4] = v; gid.data[i * 4 + 1] = v; gid.data[i * 4 + 2] = v; gid.data[i * 4 + 3] = 255; }
  gc.getContext("2d").putImageData(gid, 0, 0);
  const gf = makeCanvas(W, H);
  const gfctx = gf.getContext("2d");
  gfctx.imageSmoothingQuality = "high";
  gfctx.filter = "blur(3px)";
  gfctx.drawImage(gc, 0, 0, W, H);
  const gd = gfctx.getImageData(0, 0, W, H).data;

  const out = makeCanvas(W, H);
  const octx = out.getContext("2d");
  octx.drawImage(crop, 0, 0);
  const od = octx.getImageData(0, 0, W, H);
  let minX = W, minY = H, maxX = 0, maxY = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const g = gd[i * 4] / 255;
    const raw = a[i] / 255;
    const v = Math.max(raw, a[i] > 110 ? 1 : 0) * g;
    const al = Math.max(0, Math.min(1, (v * 255 - 120) / 80));
    od.data[i * 4 + 3] = Math.round(al * 255);
    if (al > 0.08) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  octx.putImageData(od, 0, 0);
  if (maxX <= minX) throw new Error("Détourage vide : essaie une autre photo.");
  const res = makeCanvas(maxX - minX + 1, maxY - minY + 1);
  res.getContext("2d").drawImage(out, minX, minY, res.width, res.height, 0, 0, res.width, res.height);
  return res;
}
