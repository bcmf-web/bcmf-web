import { useEffect, useRef, useState } from "react";
import { supabase } from "../services/supabaseClient.js";
import { getStyles } from "../styles/styles.js";
import { useIsMobile } from "../hooks/useIsMobile.js";
import { useNotify } from "../contexts/NotifyContext.jsx";
import { renderPoster, canvasToJpegBlob } from "../services/gamedayRender.js";

const JOURS = ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI", "DIMANCHE"];
const MOIS = ["JANVIER", "FÉVRIER", "MARS", "AVRIL", "MAI", "JUIN", "JUILLET", "AOÛT", "SEPTEMBRE", "OCTOBRE", "NOVEMBRE", "DÉCEMBRE"];

const slug = (s) =>
  (s || "match")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "match";

export default function GameDayPage({ onBack }) {
  const isMobile = useIsMobile();
  const styles = getStyles(isMobile);
  const { toast } = useNotify();

  const [photo, setPhoto] = useState(null);
  const [logo, setLogo] = useState(null);
  const [equipe, setEquipe] = useState("");
  const [jour, setJour] = useState("SAMEDI");
  const [numero, setNumero] = useState("");
  const [mois, setMois] = useState(MOIS[new Date().getMonth()]);
  const [heure, setHeure] = useState("14H00");
  const [salle, setSalle] = useState("");
  const [ville, setVille] = useState("");
  const [ordre, setOrdre] = useState("adversaire");
  const [logoMode, setLogoMode] = useState("auto");
  const [teams, setTeams] = useState([]);

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [previewUrl, setPreviewUrl] = useState(null);
  const blobRef = useRef(null);
  const photoRef = useRef(null);
  const logoRef = useRef(null);

  useEffect(() => {
    supabase.from("teams").select("name").eq("active", true).order("name").then(({ data }) => setTeams(data || []));
    return () => previewUrl && URL.revokeObjectURL(previewUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fileName = `gameday_${slug(equipe || salle)}.jpg`;

  async function generate() {
    if (!photo) return toast("Choisis la photo d'équipe.", "error");
    if (!logo) return toast("Choisis le logo adverse.", "error");
    if (!numero.trim()) return toast("Indique le numéro du jour (ex. 10).", "error");
    setBusy(true);
    try {
      const canvas = await renderPoster({
        photo, logo, jour, numero: numero.trim(), mois, heure: heure.trim(), equipe: equipe.trim(),
        salle: salle.trim(), ville: ville.trim(), adversaireGauche: ordre === "adversaire", logoMode,
        onProgress: setStatus,
      });
      const blob = await canvasToJpegBlob(canvas);
      blobRef.current = blob;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      setStatus("Affiche prête.");
    } catch (e) {
      console.error(e);
      setStatus("");
      toast(e.message || "Erreur pendant la génération.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const blob = blobRef.current;
    if (!blob) return;
    // Chrome / Edge : choix de l'emplacement
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [{ description: "Image JPEG", accept: { "image/jpeg": [".jpg"] } }],
        });
        const w = await handle.createWritable();
        await w.write(blob);
        await w.close();
        toast("Affiche enregistrée.", "success");
        return;
      } catch (e) {
        if (e.name === "AbortError") return;
      }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  const label = { display: "block", fontWeight: "bold", fontSize: 13, margin: "10px 0 4px", color: "#334155" };
  const fileBox = (file, ref, onPick, text) => (
    <div>
      <button type="button" style={styles.darkButton} onClick={() => ref.current?.click()}>
        {file ? "Changer : " + (file.name.length > 28 ? file.name.slice(0, 25) + "…" : file.name) : text}
      </button>
      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => onPick(e.target.files?.[0] || null)} />
    </div>
  );

  return (
    <div>
      <button style={styles.backButton} onClick={onBack}>← Retour</button>
      <h2 style={styles.sectionTitle}>🏀 Affiches Game Day</h2>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(320px, 420px) 1fr", gap: 20, alignItems: "start" }}>
        <section style={styles.panel}>
          <label style={{ ...label, marginTop: 0 }}>Photo d'équipe</label>
          {fileBox(photo, photoRef, setPhoto, "📷 Choisir la photo")}
          <label style={label}>Logo adverse</label>
          {fileBox(logo, logoRef, setLogo, "🛡️ Choisir le logo")}

          <label style={label}>Nom de l'équipe (affiché en vertical)</label>
          <input list="gd-teams" style={styles.input} value={equipe} onChange={(e) => setEquipe(e.target.value)} placeholder="ex. U11 F" />
          <datalist id="gd-teams">{teams.map((t) => <option key={t.name} value={t.name} />)}</datalist>

          <label style={label}>Date</label>
          <div style={{ display: "flex", gap: 8 }}>
            <select style={{ ...styles.input, flex: 2 }} value={jour} onChange={(e) => setJour(e.target.value)}>{JOURS.map((j) => <option key={j}>{j}</option>)}</select>
            <input style={{ ...styles.input, flex: 1, minWidth: 0 }} value={numero} onChange={(e) => setNumero(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="10" inputMode="numeric" />
            <select style={{ ...styles.input, flex: 2 }} value={mois} onChange={(e) => setMois(e.target.value)}>{MOIS.map((m) => <option key={m}>{m}</option>)}</select>
          </div>

          <label style={label}>Heure</label>
          <input style={styles.input} value={heure} onChange={(e) => setHeure(e.target.value)} placeholder="14H00" />
          <label style={label}>Salle</label>
          <input style={styles.input} value={salle} onChange={(e) => setSalle(e.target.value)} placeholder="ex. Gymnase M. J.Guimier" />
          <label style={label}>Ville</label>
          <input style={styles.input} value={ville} onChange={(e) => setVille(e.target.value)} placeholder="ex. Rive-de-Gier" />

          <label style={label}>Ordre des logos</label>
          <select style={styles.input} value={ordre} onChange={(e) => setOrdre(e.target.value)}>
            <option value="adversaire">Adversaire à gauche</option>
            <option value="bcmf">BCMF à gauche</option>
          </select>
          <label style={label}>Logo adverse</label>
          <select style={styles.input} value={logoMode} onChange={(e) => setLogoMode(e.target.value)}>
            <option value="auto">Auto</option>
            <option value="cadre">Cadre blanc (logo flou ou fond blanc)</option>
            <option value="detour">Détourer le fond blanc</option>
          </select>

          <button style={busy ? styles.disabledButton : styles.orangeButton} disabled={busy} onClick={generate} >
            {busy ? "Génération…" : "Générer l'affiche"}
          </button>
          {status && <div style={{ marginTop: 10, fontSize: 13, color: "#475569" }}>{status}</div>}
          <div style={{ marginTop: 10, fontSize: 12, color: "#64748b" }}>
            🔒 Les photos restent sur votre appareil : le détourage se fait dans le navigateur, rien n'est envoyé.
          </div>
        </section>

        <section style={{ ...styles.panel, textAlign: "center" }}>
          {previewUrl ? (
            <>
              <div style={{ width: "100%", maxWidth: isMobile ? 520 : "min(560px, 62vh)", aspectRatio: "4 / 5", margin: "0 auto" }}>
                <img
                  src={previewUrl}
                  alt="Affiche"
                  style={{ display: "block", width: "100%", height: "100%", objectFit: "contain", borderRadius: 12, boxShadow: "0 4px 16px rgba(0,0,0,.2)" }}
                />
              </div>
              <div style={{ marginTop: 14 }}>
                <button style={styles.orangeButton} onClick={save}>💾 Enregistrer l'affiche…</button>
              </div>
            </>
          ) : (
            <div style={{ color: "#64748b", padding: 40 }}>
              <div style={{ fontSize: 48 }}>🖼️</div>
              <div>L'aperçu de l'affiche apparaîtra ici.</div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
