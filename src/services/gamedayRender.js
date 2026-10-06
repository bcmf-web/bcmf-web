// Moteur d'affiche "Game Day" BCMF : dessine tout dans un canvas 1600x2000.
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow-condensed/800.css";
import "@fontsource/kaushan-script/400.css";
import { cutTeam, loadBitmapCanvas } from "./gamedayCutout.js";

export const POSTER_W = 1600;
export const POSTER_H = 2000;
export const BASE = `${import.meta.env.BASE_URL}gameday/`;
export const GREEN = "rgb(40,125,80)";
export const WHITE = "#ffffff";
export const CONDENSED = '"Barlow Condensed", "Arial Narrow", sans-serif';
export const SCRIPT = '"Kaushan Script", "Brush Script MT", cursive';

export function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image introuvable : " + src));
    img.src = src;
  });
}

export async function ensureFonts() {
  await Promise.all([
    document.fonts.load('800 100px "Barlow Condensed"'),
    document.fonts.load('700 100px "Barlow Condensed"'),
    document.fonts.load('400 100px "Kaushan Script"'),
  ]);
}

// ---------- texte ----------
// Taille de police reduite jusqu'a tenir dans maxW
function fitSize(ctx, text, fontOf, size, maxW) {
  let s = size;
  ctx.font = fontOf(s);
  while (maxW && ctx.measureText(text).width > maxW && s > 24) {
    s -= 4;
    ctx.font = fontOf(s);
  }
  return s;
}

/**
 * Trace un texte avec cisaillement (italique) ancre sur la ligne de base.
 * mode "plain" : remplissage simple. mode "relief" : contour clair + ombre + biseau.
 */
export function drawText(target, spec) {
  const { text, x, y, size, fontOf, color = WHITE, align = "l", shear = 0, maxW, relief = false, rotate = 0 } = spec;
  const ctx = target;
  ctx.save();
  ctx.font = fontOf(size);
  const s = fitSize(ctx, text, fontOf, size, maxW);
  const w = ctx.measureText(text).width;
  const ox = align === "r" ? -w : align === "m" ? -w / 2 : 0;
  const place = (c) => {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.translate(x, y);
    if (rotate) c.rotate(rotate);
    c.transform(1, 0, -shear, 1, 0, 0);
    c.font = fontOf(s);
    c.textBaseline = "alphabetic";
  };

  if (!relief) {
    place(ctx);
    ctx.fillStyle = color;
    ctx.fillText(text, ox, 0);
    ctx.restore();
    return { width: w, size: s };
  }

  // 1. contour clair + ombre portee
  place(ctx);
  ctx.lineJoin = "round";
  ctx.lineWidth = 15;
  ctx.shadowColor = "rgba(10,45,25,0.75)";
  ctx.shadowBlur = 20;
  ctx.shadowOffsetX = 10;
  ctx.shadowOffsetY = 14;
  ctx.strokeStyle = "rgb(235,250,240)";
  ctx.strokeText(text, ox, 0);
  ctx.shadowColor = "transparent";
  // 2. remplissage
  ctx.fillStyle = color;
  ctx.fillText(text, ox, 0);
  ctx.restore();

  // 3. biseau : bord haut-gauche eclairci
  const off = makeCanvas(POSTER_W, POSTER_H);
  const o = off.getContext("2d");
  place(o);
  o.fillStyle = "#fff";
  o.fillText(text, ox, 0);
  o.globalCompositeOperation = "destination-out";
  o.setTransform(1, 0, 0, 1, 0, 0);
  o.translate(x + 3, y + 3);
  if (rotate) o.rotate(rotate);
  o.transform(1, 0, -shear, 1, 0, 0);
  o.font = fontOf(s);
  o.fillText(text, ox, 0);
  o.globalCompositeOperation = "source-in";
  o.setTransform(1, 0, 0, 1, 0, 0);
  o.fillStyle = "rgb(150,225,175)";
  o.fillRect(0, 0, POSTER_W, POSTER_H);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 0.9;
  ctx.drawImage(off, 0, 0);
  ctx.restore();
  return { width: w, size: s };
}

// ---------- logo adverse ----------
function hasAlpha(canvas) {
  const ctx = canvas.getContext("2d");
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let i = 3; i < d.length; i += 16) if (d[i] < 250) return true;
  return false;
}

function sharpen(canvas, amount = 0.6) {
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext("2d");
  const src = ctx.getImageData(0, 0, w, h);
  const dst = ctx.createImageData(w, h);
  const s = src.data, d = dst.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    for (let c = 0; c < 3; c++) {
      const v = s[i + c];
      const nb = (s[((Math.max(0, y - 1)) * w + x) * 4 + c] + s[((Math.min(h - 1, y + 1)) * w + x) * 4 + c] +
        s[(y * w + Math.max(0, x - 1)) * 4 + c] + s[(y * w + Math.min(w - 1, x + 1)) * 4 + c]) / 4;
      d[i + c] = Math.max(0, Math.min(255, v + (v - nb) * amount * 2));
    }
    d[i + 3] = s[i + 3];
  }
  ctx.putImageData(dst, 0, 0);
}

function contentBBox(canvas, test) {
  const w = canvas.width, h = canvas.height;
  const d = canvas.getContext("2d").getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (test(d[i], d[i + 1], d[i + 2], d[i + 3])) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return x1 < 0 ? null : [x0, y0, x1 + 1, y1 + 1];
}

function cropCanvas(canvas, bb, pad = 0) {
  const x0 = Math.max(0, bb[0] - pad), y0 = Math.max(0, bb[1] - pad);
  const x1 = Math.min(canvas.width, bb[2] + pad), y1 = Math.min(canvas.height, bb[3] + pad);
  const c = makeCanvas(x1 - x0, y1 - y0);
  c.getContext("2d").drawImage(canvas, x0, y0, c.width, c.height, 0, 0, c.width, c.height);
  return c;
}

function removeWhiteBackground(canvas) {
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext("2d");
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const seen = new Uint8Array(w * h);
  const near = (p) => 255 - d[p * 4] <= 40 && 255 - d[p * 4 + 1] <= 40 && 255 - d[p * 4 + 2] <= 40;
  const stack = [];
  for (const p of [0, w - 1, (h - 1) * w, h * w - 1]) if (near(p) && !seen[p]) { seen[p] = 1; stack.push(p); }
  while (stack.length) {
    const p = stack.pop();
    const x = p % w, y = (p / w) | 0;
    const nbs = [];
    if (x > 0) nbs.push(p - 1);
    if (x < w - 1) nbs.push(p + 1);
    if (y > 0) nbs.push(p - w);
    if (y < h - 1) nbs.push(p + w);
    for (const q of nbs) if (!seen[q] && near(q)) { seen[q] = 1; stack.push(q); }
  }
  const m = makeCanvas(w, h);
  const mctx = m.getContext("2d");
  const mid = mctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) { const v = seen[i] ? 0 : 255; mid.data[i * 4] = v; mid.data[i * 4 + 1] = v; mid.data[i * 4 + 2] = v; mid.data[i * 4 + 3] = 255; }
  mctx.putImageData(mid, 0, 0);
  const blurred = makeCanvas(w, h);
  const bctx = blurred.getContext("2d");
  bctx.filter = "blur(1px)";
  bctx.drawImage(m, 0, 0);
  const bd = bctx.getImageData(0, 0, w, h).data;
  for (let i = 0; i < w * h; i++) d[i * 4 + 3] = bd[i * 4];
  ctx.putImageData(img, 0, 0);
}

export async function prepLogo(file, mode, box = [460, 300]) {
  let src = await loadBitmapCanvas(file, 2000);
  const alpha = hasAlpha(src);
  const minSide = Math.min(src.width, src.height);
  let m = mode;
  if (m === "auto") m = alpha || minSide >= 300 ? "detour" : "cadre";
  let out;
  if (m === "detour") {
    if (!alpha) {
      const flat = makeCanvas(src.width, src.height);
      const fctx = flat.getContext("2d");
      fctx.fillStyle = "#fff";
      fctx.fillRect(0, 0, flat.width, flat.height);
      fctx.drawImage(src, 0, 0);
      src = flat;
      removeWhiteBackground(src);
    }
    const bb = contentBBox(src, (r, g, b, a) => a > 30);
    out = bb ? cropCanvas(src, bb) : src;
  } else {
    // cadre blanc : fond blanc, agrandi et accentue puis place dans un badge arrondi
    const flat = makeCanvas(src.width, src.height);
    const fctx = flat.getContext("2d");
    fctx.fillStyle = "#fff";
    fctx.fillRect(0, 0, flat.width, flat.height);
    fctx.drawImage(src, 0, 0);
    let big = flat;
    if (Math.max(big.width, big.height) < 520) {
      const r = 520 / Math.max(big.width, big.height);
      big = makeCanvas(big.width * r, big.height * r);
      const bctx = big.getContext("2d");
      bctx.imageSmoothingQuality = "high";
      bctx.drawImage(flat, 0, 0, big.width, big.height);
    }
    sharpen(big, 0.6);
    const bb = contentBBox(big, (r, g, b) => (r + g + b) / 3 < 235);
    if (bb) big = cropCanvas(big, bb, 6);
    out = makeCanvas(big.width + 40, big.height + 40);
    const octx = out.getContext("2d");
    octx.fillStyle = "rgba(255,255,255,0.92)";
    octx.beginPath();
    octx.roundRect(0, 0, out.width, out.height, 36);
    octx.fill();
    octx.drawImage(big, 20, 20);
  }
  const r = Math.min(box[0] / out.width, box[1] / out.height);
  const fin = makeCanvas(out.width * r, out.height * r);
  const fctx = fin.getContext("2d");
  fctx.imageSmoothingQuality = "high";
  fctx.drawImage(out, 0, 0, fin.width, fin.height);
  return fin;
}


/** Fond vert du modele + motif de mots. Retourne l'image du logo BCMF (blanc). */
export async function paintBackground(ctx, ville) {
  const [bg, mask, bcmf] = await Promise.all([
    loadImage(BASE + "bg.jpg"),
    loadImage(BASE + "bg-mask.png"),
    loadImage(BASE + "bcmf-logo.png"),
  ]);
  ctx.drawImage(bg, 0, 0, POSTER_W, POSTER_H);
  const pat = makeCanvas(POSTER_W, POSTER_H);
  const pctx = pat.getContext("2d");
  pctx.font = `700 64px ${CONDENSED}`;
  pctx.fillStyle = "rgba(60,110,90,0.15)";
  pctx.textBaseline = "top";
  const words = ["GO BCMF GO", "NEXT GAME", "ICI, ICI C'EST", (ville || "ICI").toUpperCase(), "EN VERT ET BLANC"];
  for (let r = 0; r < 22; r++) for (let c = -1; c < 4; c++) pctx.fillText(words[(r + c) % 5 < 0 ? 0 : (r + c) % 5], c * 480 - (r % 2) * 240 + 10, r * 100 + 420);
  pctx.globalCompositeOperation = "destination-in";
  pctx.drawImage(mask, 0, 0, POSTER_W, POSTER_H);
  ctx.drawImage(pat, 0, 0);
  return bcmf;
}

// ---------- affiche ----------
/**
 * @param {object} o
 *  photo: File, logo: File, jour, numero, mois, heure, equipe, salle, ville,
 *  adversaireGauche: bool, logoMode: "auto" | "cadre" | "detour", onProgress(msg)
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function renderPoster(o) {
  const progress = o.onProgress || (() => {});
  progress("Préparation du fond…");
  await ensureFonts();

  const canvas = makeCanvas(POSTER_W, POSTER_H);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  const bcmf = await paintBackground(ctx, o.ville);

  const cond = (w) => (s) => `${w} ${s}px ${CONDENSED}`;
  const bold = cond(800);
  const script = (s) => `400 ${s}px ${SCRIPT}`;

  // titre
  drawText(ctx, { text: "GAME DAY", x: 1480, y: 330, size: 340, fontOf: bold, color: GREEN, align: "r", shear: 0.2, maxW: 1150, relief: true });
  drawText(ctx, { text: "GAME", x: 610, y: 345, size: 135, fontOf: script, color: WHITE });
  drawText(ctx, { text: "DAY", x: 1170, y: 345, size: 135, fontOf: script, color: WHITE });

  // nom de l'equipe (vertical, a gauche)
  if (o.equipe) {
    drawText(ctx, { text: o.equipe, x: 215, y: 400, size: 160, fontOf: script, color: WHITE, rotate: -Math.PI / 2, maxW: 330 });
  }

  // date
  const jour = (o.jour || "").toUpperCase();
  const mois = (o.mois || "").toUpperCase();
  const jl = drawText(ctx, { text: jour, x: 70, y: 620, size: 215, fontOf: bold, color: GREEN, shear: 0.2, maxW: 620, relief: true });
  drawText(ctx, { text: mois, x: 95, y: 810, size: 215, fontOf: bold, color: GREEN, shear: 0.2, maxW: 740, relief: true });
  drawText(ctx, { text: String(o.numero || ""), x: 70 + jl.width + 10, y: 690, size: 270, fontOf: script, color: GREEN, maxW: 330, relief: true });
  drawText(ctx, { text: (o.heure || "").toUpperCase().replace(":", "H"), x: 930, y: 815, size: 190, fontOf: script, color: WHITE, maxW: 560 });

  // equipe detouree
  const cut = await cutTeam(o.photo, progress, { fondu: o.teamStyle === "fondu" });
  progress("Mise en page…");
  let hgt = 700;
  let wd = (cut.width * hgt) / cut.height;
  if (wd > 1300) { wd = 1300; hgt = (cut.height * wd) / cut.width; }
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetX = 8;
  ctx.shadowOffsetY = 12;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(cut, (POSTER_W - wd) / 2, 880, wd, hgt);
  ctx.restore();

  // logos
  const adv = await prepLogo(o.logo, o.logoMode || "auto");
  const home = makeCanvas(470, 246);
  home.getContext("2d").drawImage(bcmf, 0, 0, 470, 246);
  const left = o.adversaireGauche === false ? home : adv;
  const right = o.adversaireGauche === false ? adv : home;
  const cy = 1690;
  ctx.drawImage(left, 450 - left.width / 2, cy - left.height / 2);
  ctx.drawImage(right, 1155 - right.width / 2, cy - right.height / 2);
  drawText(ctx, { text: "VS", x: 800, y: 1745, size: 105, fontOf: bold, color: WHITE, align: "m", shear: 0.2 });

  // lieu
  if (o.salle) drawText(ctx, { text: o.salle.toUpperCase(), x: 800, y: o.ville ? 1925 : 1955, size: 100, fontOf: bold, color: WHITE, align: "m", shear: 0.2, maxW: 1300 });
  if (o.ville) drawText(ctx, { text: o.ville.toUpperCase(), x: 800, y: 1992, size: 56, fontOf: cond(700), color: WHITE, align: "m", shear: 0.2, maxW: 1100 });

  return canvas;
}

export function canvasToJpegBlob(canvas, quality = 0.93) {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Export impossible"))), "image/jpeg", quality));
}
