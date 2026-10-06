// Affiches "Victoire / Défaite" et "MVP" (meme moteur que Game Day).
import "@fontsource/playfair-display/400.css";
import {
  POSTER_W, POSTER_H, BASE, GREEN, WHITE, CONDENSED, SCRIPT,
  makeCanvas, loadImage, ensureFonts, drawText, prepLogo, paintBackground,
} from "./gamedayRender.js";
import { cutTeam, loadBitmapCanvas } from "./gamedayCutout.js";

const SERIF = '"Playfair Display", "Times New Roman", serif';
const DARK = "rgb(22,85,52)";
const cond = (w) => (s) => `${w} ${s}px ${CONDENSED}`;
const bold = cond(800);
const semi = cond(700);
const script = (s) => `400 ${s}px ${SCRIPT}`;
const serif = (s) => `400 ${s}px ${SERIF}`;

async function fonts() {
  await ensureFonts();
  await document.fonts.load(`400 100px ${SERIF}`);
}

// ======================================================================
//  VICTOIRE / DEFAITE
// ======================================================================
/**
 * o: { resultat: "victoire"|"defaite", scoreBcmf, scoreAdv, journee, jour, numero, mois, salle, ville,
 *      equipe, photo(File), logo(File), bcmfGauche(bool), logoMode, onProgress }
 */
export async function renderResultPoster(o) {
  if (o.style === "photo") return renderResultPhoto(o);
  const progress = o.onProgress || (() => {});
  progress("Préparation du fond…");
  await fonts();
  const canvas = makeCanvas(POSTER_W, POSTER_H);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  const bcmfImg = await paintBackground(ctx, o.ville);

  // journee (petit script en haut)
  if (o.journee) drawText(ctx, { text: o.journee.toUpperCase(), x: 800, y: 105, size: 80, fontOf: script, color: DARK, align: "m", maxW: 700 });

  // nom de l'equipe vertical
  if (o.equipe) drawText(ctx, { text: o.equipe, x: 215, y: 440, size: 160, fontOf: script, color: WHITE, rotate: -Math.PI / 2, maxW: 330 });

  // titre
  const titre = o.resultat === "defaite" ? "DÉFAITE" : "VICTOIRE";
  drawText(ctx, { text: titre, x: 800, y: 370, size: 300, fontOf: bold, color: GREEN, align: "m", shear: 0.2, maxW: 1200, relief: true });

  // panneau score
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.20)";
  ctx.beginPath();
  ctx.roundRect(110, 470, 1380, 620, 36);
  ctx.fill();
  ctx.restore();

  // logos
  const adv = await prepLogo(o.logo, o.logoMode || "auto", [380, 230]);
  const home = makeCanvas(380, 199);
  const hctx = home.getContext("2d");
  hctx.drawImage(bcmfImg, 0, 0, 380, 199);
  const leftLogo = o.bcmfGauche === false ? adv : home;
  const rightLogo = o.bcmfGauche === false ? home : adv;
  const leftScore = o.bcmfGauche === false ? o.scoreAdv : o.scoreBcmf;
  const rightScore = o.bcmfGauche === false ? o.scoreBcmf : o.scoreAdv;
  const cxL = 450, cxR = 1150;
  ctx.drawImage(leftLogo, cxL - leftLogo.width / 2, 590 - leftLogo.height / 2);
  ctx.drawImage(rightLogo, cxR - rightLogo.width / 2, 590 - rightLogo.height / 2);

  // scores
  drawText(ctx, { text: String(leftScore ?? ""), x: cxL, y: 1040, size: 400, fontOf: serif, color: DARK, align: "m", maxW: 520 });
  drawText(ctx, { text: String(rightScore ?? ""), x: cxR, y: 1040, size: 400, fontOf: serif, color: DARK, align: "m", maxW: 520 });
  drawText(ctx, { text: "VS", x: 800, y: 880, size: 120, fontOf: bold, color: WHITE, align: "m", shear: 0.2 });

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
  ctx.drawImage(cut, (POSTER_W - wd) / 2, 1130, wd, hgt);
  ctx.restore();

  // pied : date, salle, ville
  const date = [o.jour, o.numero, o.mois].filter(Boolean).join(" ").toUpperCase();
  const lieu = [o.salle, o.ville].filter(Boolean).join(" - ").toUpperCase();
  if (date) drawText(ctx, { text: date, x: 800, y: 1925, size: 78, fontOf: bold, color: WHITE, align: "m", shear: 0.2, maxW: 1400 });
  if (lieu) drawText(ctx, { text: lieu, x: 800, y: 1982, size: 48, fontOf: semi, color: WHITE, align: "m", shear: 0.2, maxW: 1400 });
  return canvas;
}


// ----- modele "photo plein fond + panneau vert" -----
function squeezedText(ctx, text, cx, baseline, size, maxW, color) {
  ctx.save();
  ctx.font = `800 ${size}px ${CONDENSED}`;
  const w = ctx.measureText(text).width;
  const sx = w > maxW ? maxW / w : 1;
  ctx.translate(cx, baseline);
  ctx.scale(sx, 1);
  ctx.textAlign = "center";
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

async function renderResultPhoto(o) {
  const progress = o.onProgress || (() => {});
  progress("Préparation…");
  await fonts();
  const canvas = makeCanvas(POSTER_W, POSTER_H);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  const [bcmfImg, photo] = await Promise.all([loadImage(BASE + "bcmf-logo.png"), loadBitmapCanvas(o.photo, 3000)]);

  coverDraw(ctx, photo, 0, 0, POSTER_W, POSTER_H, o.zoom || 1, o.focusX ?? 0.5, o.focusY ?? 0.4);
  // voile leger pour la lisibilite
  const veil = ctx.createLinearGradient(0, 0, 0, POSTER_H);
  veil.addColorStop(0, "rgba(0,0,0,0.10)");
  veil.addColorStop(1, "rgba(0,0,0,0.30)");
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, POSTER_W, POSTER_H);

  // panneau vert
  ctx.save();
  ctx.fillStyle = "rgba(30,92,56,0.86)";
  ctx.beginPath();
  ctx.roundRect(130, 405, 475, 1190, 38);
  ctx.fill();
  ctx.restore();

  const first = o.bcmfGauche === false ? o.scoreAdv : o.scoreBcmf;
  const second = o.bcmfGauche === false ? o.scoreBcmf : o.scoreAdv;
  squeezedText(ctx, String(first ?? ""), 367, 925, 640, 400, "#fff");
  squeezedText(ctx, String(second ?? ""), 367, 1530, 640, 400, "#fff");
  if (o.journee) drawText(ctx, { text: o.journee.toUpperCase(), x: 367, y: 1068, size: 74, fontOf: semi, color: WHITE, align: "m", maxW: 400 });

  // logos : haut = premier score, bas = second
  const adv = await prepLogo(o.logo, o.logoMode || "auto", [330, 260]);
  const home = greenLogo(bcmfImg, 360, 188);
  const topLogo = o.bcmfGauche === false ? adv : home;
  const botLogo = o.bcmfGauche === false ? home : adv;
  const putLogo = (img, cx, cy) => {
    ctx.save();
    ctx.shadowColor = "rgba(255,255,255,0.9)";
    ctx.shadowBlur = img === home ? 10 : 0;
    ctx.drawImage(img, cx - img.width / 2, cy - img.height / 2);
    ctx.restore();
  };
  putLogo(topLogo, 367, 315);
  putLogo(botLogo, 367, 1590 + 155);

  if (o.equipe) drawText(ctx, { text: o.equipe, x: 1530, y: 140, size: 90, fontOf: script, color: WHITE, align: "r", maxW: 600 });
  const date = [o.jour, o.numero, o.mois].filter(Boolean).join(" ").toUpperCase();
  const lieu = [o.salle, o.ville].filter(Boolean).join(" - ").toUpperCase();
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 12;
  if (date) drawText(ctx, { text: date, x: 1540, y: 1900, size: 74, fontOf: bold, color: WHITE, align: "r", shear: 0.2, maxW: 800 });
  if (lieu) drawText(ctx, { text: lieu, x: 1540, y: 1962, size: 46, fontOf: semi, color: WHITE, align: "r", shear: 0.2, maxW: 800 });
  ctx.restore();
  progress("Terminé.");
  return canvas;
}

// ======================================================================
//  MVP  (carre 1600x1600)
// ======================================================================
function greenLogo(bcmfImg, w, h) {
  const c = makeCanvas(w, h);
  const x = c.getContext("2d");
  x.drawImage(bcmfImg, 0, 0, w, h);
  x.globalCompositeOperation = "source-in";
  x.fillStyle = "rgb(30,140,75)";
  x.fillRect(0, 0, w, h);
  return c;
}

function coverDraw(ctx, img, rx, ry, rw, rh, zoom = 1, fx = 0.5, fy = 0.35) {
  const s = Math.max(rw / img.width, rh / img.height) * zoom;
  const dw = img.width * s, dh = img.height * s;
  const dx = rx - (dw - rw) * fx;
  const dy = ry - (dh - rh) * fy;
  ctx.drawImage(img, dx, dy, dw, dh);
}

/**
 * o: { photo(File), prenomNom, numero, contexte, stats:[{label,value}], zoom, focusX, focusY, onProgress }
 */
export async function renderMvpPoster(o) {
  const progress = o.onProgress || (() => {});
  progress("Préparation…");
  await fonts();
  const S = 1600;
  const COL = 528;
  const canvas = makeCanvas(S, S);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  const [bcmfImg, photo] = await Promise.all([loadImage(BASE + "bcmf-logo.png"), loadBitmapCanvas(o.photo, 2600)]);

  // colonne gauche blanche
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, S, S);

  // photo a droite
  ctx.save();
  ctx.beginPath();
  ctx.rect(COL, 0, S - COL, S);
  ctx.clip();
  coverDraw(ctx, photo, COL, 0, S - COL, S, o.zoom || 1, o.focusX ?? 0.5, o.focusY ?? 0.35);
  ctx.restore();

  // 4 x MVP : lettres vertes avec la photo qui transparait
  const rowH = (S - 300) / 4;
  const mvp = makeCanvas(COL, S);
  const m = mvp.getContext("2d");
  m.fillStyle = "rgb(88,168,130)";
  for (let r = 0; r < 4; r++) {
    m.save();
    m.font = `800 ${rowH * 1.05}px ${CONDENSED}`;
    const tw = m.measureText("MVP").width;
    m.translate(COL / 2, r * rowH + rowH * 0.88);
    m.scale((COL - 34) / tw, 1);
    m.textAlign = "center";
    m.fillText("MVP", 0, 0);
    m.restore();
  }
  // photo en transparence dans les lettres
  m.save();
  m.globalCompositeOperation = "source-atop";
  m.globalAlpha = 0.38;
  coverDraw(m, photo, -COL * 0.35, 0, S * 0.85, S, 1, 0.5, 0.2);
  m.restore();
  ctx.drawImage(mvp, 0, 0);

  // logo BCMF vert en bas de la colonne
  const lg = greenLogo(bcmfImg, 440, 230);
  ctx.drawImage(lg, COL / 2 - 220, S - 265);

  // nom
  const nom = (o.prenomNom || "").trim().toUpperCase();
  const i = nom.indexOf(" ");
  const l1 = i > 0 ? nom.slice(0, i) : nom;
  const l2 = i > 0 ? nom.slice(i + 1) : "";
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 14;
  ctx.restore();
  drawText(ctx, { text: l1, x: 1540, y: 215, size: 190, fontOf: bold, color: WHITE, align: "r", shear: 0.2, maxW: 760, relief: false });
  if (l2) drawText(ctx, { text: l2, x: 1540, y: 385, size: 190, fontOf: bold, color: WHITE, align: "r", shear: 0.2, maxW: 760 });
  if (o.numero) drawText(ctx, { text: "#" + String(o.numero).replace(/^#/, ""), x: 1500, y: 500, size: 150, fontOf: script, color: "rgb(120,200,155)", align: "r", relief: false });

  // contexte (ex. FINALE / 2EME JOURNEE)
  if (o.contexte) drawText(ctx, { text: o.contexte.toUpperCase(), x: 1540, y: 1255, size: 78, fontOf: script, color: WHITE, align: "r", maxW: 700 });

  // statistiques
  const stats = (o.stats || []).filter((s) => String(s.value ?? "").trim() !== "");
  if (stats.length) {
    const n = stats.length;
    const bw = 215, gap = 56, totalW = n * bw + (n - 1) * gap;
    const startX = COL + (S - COL - totalW) / 2 + 10;
    stats.forEach((st, k) => {
      const bx = startX + k * (bw + gap);
      const by = 1290;
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.3)";
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 6;
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, 195, 30);
      ctx.fill();
      ctx.restore();
      drawText(ctx, { text: String(st.value), x: bx + bw / 2, y: by + 150, size: 150, fontOf: script, color: "rgb(110,185,145)", align: "m", maxW: bw - 40 });
      drawText(ctx, { text: (st.label || "").toUpperCase(), x: bx + bw / 2, y: by + 270, size: 64, fontOf: semi, color: WHITE, align: "m", maxW: bw });
    });
  }
  progress("Terminé.");
  return canvas;
}
