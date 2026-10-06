import { useEffect, useRef, useState } from "react";
import { getStyles } from "../styles/styles.js";
import { useIsMobile } from "../hooks/useIsMobile.js";

/**
 * Retouche manuelle du detourage : gommer (retirer du fond) ou restaurer (rendre une partie coupee).
 * cut = { orig: canvas, alpha: Uint8ClampedArray, alpha0, w, h } ; alpha est modifie sur place.
 */
export default function CutoutEditor({ cut, onClose, onApply }) {
  const styles = getStyles(useIsMobile());
  const canvasRef = useRef(null);
  const offRef = useRef(null);
  const dataRef = useRef(null);
  const undoRef = useRef([]);
  const drawingRef = useRef(false);
  const lastRef = useRef(null);
  const rafRef = useRef(0);
  const [mode, setMode] = useState("restore");
  const [radius, setRadius] = useState(28);
  const [zoom, setZoom] = useState(1);
  const [undoCount, setUndoCount] = useState(0);
  const [cursor, setCursor] = useState(null);

  const { w, h } = cut;
  const alphaRef = useRef(cut.alpha);
  const alpha0Ref = useRef(cut.alpha0);

  function paint() {
    rafRef.current = 0;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "rgb(70,130,100)";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(offRef.current, 0, 0);
  }
  function schedulePaint() {
    if (!rafRef.current) rafRef.current = requestAnimationFrame(paint);
  }

  useEffect(() => {
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const octx = off.getContext("2d");
    octx.drawImage(cut.orig, 0, 0);
    const id = octx.getImageData(0, 0, w, h);
    for (let i = 0; i < w * h; i++) id.data[i * 4 + 3] = alphaRef.current[i];
    octx.putImageData(id, 0, 0);
    offRef.current = off;
    dataRef.current = id;
    paint();
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stamp(cx, cy) {
    const id = dataRef.current;
    const r = radius;
    const x0 = Math.max(0, Math.floor(cx - r - 1)), x1 = Math.min(w - 1, Math.ceil(cx + r + 1));
    const y0 = Math.max(0, Math.floor(cy - r - 1)), y1 = Math.min(h - 1, Math.ceil(cy + r + 1));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x - cx, y - cy) / r;
      if (d >= 1) continue;
      // bord doux : plein au centre, progressif sur le dernier tiers
      const k = d < 0.66 ? 1 : 1 - (d - 0.66) / 0.34;
      const i = y * w + x;
      const a = alphaRef.current[i];
      let na;
      if (mode === "erase") na = Math.min(a, Math.round(a * (1 - k)));
      else na = Math.max(a, Math.round(255 * k));
      if (na !== a) { alphaRef.current[i] = na; id.data[i * 4 + 3] = na; }
    }
    offRef.current.getContext("2d").putImageData(id, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
    schedulePaint();
  }

  function toImage(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    return [((e.clientX - rect.left) * w) / rect.width, ((e.clientY - rect.top) * h) / rect.height];
  }

  function strokeTo(x, y) {
    const last = lastRef.current;
    if (!last) { stamp(x, y); }
    else {
      const dist = Math.hypot(x - last[0], y - last[1]);
      const step = Math.max(2, radius / 4);
      const n = Math.max(1, Math.ceil(dist / step));
      for (let i = 1; i <= n; i++) stamp(last[0] + ((x - last[0]) * i) / n, last[1] + ((y - last[1]) * i) / n);
    }
    lastRef.current = [x, y];
  }

  function onDown(e) {
    e.preventDefault();
    canvasRef.current.setPointerCapture(e.pointerId);
    undoRef.current.push(new Uint8ClampedArray(alphaRef.current));
    if (undoRef.current.length > 12) undoRef.current.shift();
    setUndoCount(undoRef.current.length);
    drawingRef.current = true;
    lastRef.current = null;
    const [x, y] = toImage(e);
    strokeTo(x, y);
  }
  function onMove(e) {
    const [x, y] = toImage(e);
    const rect = canvasRef.current.getBoundingClientRect();
    setCursor([e.clientX - rect.left, e.clientY - rect.top, (radius * rect.width) / w]);
    if (drawingRef.current) strokeTo(x, y);
  }
  function onUp() {
    drawingRef.current = false;
    lastRef.current = null;
  }

  function setAlpha(arr) {
    const id = dataRef.current;
    alphaRef.current.set(arr);
    for (let i = 0; i < w * h; i++) id.data[i * 4 + 3] = alphaRef.current[i];
    offRef.current.getContext("2d").putImageData(id, 0, 0);
    schedulePaint();
  }
  function undo() {
    const prev = undoRef.current.pop();
    setUndoCount(undoRef.current.length);
    if (prev) setAlpha(prev);
  }
  function reset() {
    undoRef.current.push(new Uint8ClampedArray(alphaRef.current));
    setUndoCount(undoRef.current.length);
    setAlpha(alpha0Ref.current);
  }

  const baseW = Math.min(900, typeof window !== "undefined" ? window.innerWidth - 60 : 900);
  const cssW = baseW * zoom;
  const chip = (active) => (active ? styles.orangeButton : styles.darkButton);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.72)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div style={{ background: "white", borderRadius: 16, padding: 16, maxWidth: "96vw", maxHeight: "94vh", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontWeight: "bold" }}>✂️ Retoucher le détourage</div>
        <div style={{ fontSize: 13, color: "#475569" }}>
          <b>Restaurer</b> : peins sur une partie coupée pour la récupérer. <b>Gommer</b> : peins sur ce qui reste du fond pour l'enlever.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button style={chip(mode === "restore")} onClick={() => setMode("restore")}>🖌️ Restaurer</button>
          <button style={chip(mode === "erase")} onClick={() => setMode("erase")}>🧽 Gommer</button>
          <label style={{ fontSize: 13 }}>Taille
            <input type="range" min="8" max="90" value={radius} onChange={(e) => setRadius(Number(e.target.value))} style={{ verticalAlign: "middle", marginLeft: 6 }} />
          </label>
          <label style={{ fontSize: 13 }}>Zoom
            <input type="range" min="1" max="4" step="0.25" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} style={{ verticalAlign: "middle", marginLeft: 6 }} />
          </label>
          <button style={undoCount ? styles.darkButton : styles.disabledButton} disabled={!undoCount} onClick={undo}>↩︎ Annuler</button>
          <button style={styles.darkButton} onClick={reset}>Tout réinitialiser</button>
        </div>
        <div style={{ overflow: "auto", maxHeight: "62vh", border: "1px solid #cbd5e1", borderRadius: 8, background: "#e2e8f0" }}>
          <div style={{ position: "relative", width: cssW, lineHeight: 0 }}>
            <canvas
              ref={canvasRef}
              width={w}
              height={h}
              style={{ width: cssW, height: "auto", touchAction: "none", cursor: "none", display: "block" }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              onPointerLeave={() => setCursor(null)}
            />
            {cursor && (
              <div style={{
                position: "absolute", pointerEvents: "none", left: cursor[0] - cursor[2], top: cursor[1] - cursor[2],
                width: cursor[2] * 2, height: cursor[2] * 2, borderRadius: "50%",
                border: `2px solid ${mode === "erase" ? "#dc2626" : "#16a34a"}`, background: mode === "erase" ? "rgba(220,38,38,.15)" : "rgba(22,163,74,.15)",
              }} />
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button style={styles.darkButton} onClick={onClose}>Annuler</button>
          <button style={styles.orangeButton} onClick={onApply}>✅ Valider et régénérer l'affiche</button>
        </div>
      </div>
    </div>
  );
}
