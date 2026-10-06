import { useEffect, useRef, useState } from "react";
import { supabase } from "../services/supabaseClient.js";
import { getStyles } from "../styles/styles.js";
import { useIsMobile } from "../hooks/useIsMobile.js";
import { useNotify } from "../contexts/NotifyContext.jsx";
import { renderPoster, canvasToJpegBlob } from "../services/gamedayRender.js";
import { renderResultPoster, renderMvpPoster } from "../services/gamedayPosters.js";

const JOURS = ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI", "DIMANCHE"];
const MOIS = ["JANVIER", "FÉVRIER", "MARS", "AVRIL", "MAI", "JUIN", "JUILLET", "AOÛT", "SEPTEMBRE", "OCTOBRE", "NOVEMBRE", "DÉCEMBRE"];

const KINDS = [
  { id: "gameday", label: "🏀 Game Day" },
  { id: "resultat", label: "🏆 Victoire / Défaite" },
  { id: "mvp", label: "⭐ MVP" },
];

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

  const [kind, setKind] = useState("gameday");

  // communs
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

  // victoire / defaite
  const [resultat, setResultat] = useState("victoire");
  const [modele, setModele] = useState("vert");
  const [scoreBcmf, setScoreBcmf] = useState("");
  const [scoreAdv, setScoreAdv] = useState("");
  const [journee, setJournee] = useState("");

  // MVP
  const [prenomNom, setPrenomNom] = useState("");
  const [numMaillot, setNumMaillot] = useState("");
  const [contexte, setContexte] = useState("");
  const [stats, setStats] = useState([
    { label: "PTS", value: "" }, { label: "REB", value: "" }, { label: "PD", value: "" }, { label: "EVAL", value: "" },
  ]);

  // cadrage photo (MVP et modele photo)
  const [zoom, setZoom] = useState(1);
  const [focusX, setFocusX] = useState(0.5);
  const [focusY, setFocusY] = useState(0.35);

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

  const needsLogo = kind !== "mvp";
  const framing = kind === "mvp" || (kind === "resultat" && modele === "photo");
  const prefix = kind === "gameday" ? "gameday" : kind === "mvp" ? "mvp" : resultat;
  const fileName = `${prefix}_${slug(kind === "mvp" ? prenomNom : equipe || salle)}.jpg`;

  async function generate() {
    if (!photo) return toast(kind === "mvp" ? "Choisis la photo de la joueuse." : "Choisis la photo d'équipe.", "error");
    if (needsLogo && !logo) return toast("Choisis le logo adverse.", "error");
    if (kind === "gameday" && !numero.trim()) return toast("Indique le numéro du jour (ex. 10).", "error");
    if (kind === "resultat" && (scoreBcmf === "" || scoreAdv === "")) return toast("Indique les deux scores.", "error");
    if (kind === "mvp" && !prenomNom.trim()) return toast("Indique le nom de la joueuse.", "error");
    setBusy(true);
    try {
      let canvas;
      if (kind === "gameday") {
        canvas = await renderPoster({
          photo, logo, jour, numero: numero.trim(), mois, heure: heure.trim(), equipe: equipe.trim(),
          salle: salle.trim(), ville: ville.trim(), adversaireGauche: ordre === "adversaire", logoMode,
          onProgress: setStatus,
        });
      } else if (kind === "resultat") {
        canvas = await renderResultPoster({
          style: modele, resultat, scoreBcmf, scoreAdv, journee: journee.trim(), jour: numero.trim() ? jour : "",
          numero: numero.trim(), mois: numero.trim() ? mois : "", equipe: equipe.trim(), salle: salle.trim(),
          ville: ville.trim(), photo, logo, bcmfGauche: ordre !== "adversaire", logoMode, zoom, focusX, focusY,
          onProgress: setStatus,
        });
      } else {
        canvas = await renderMvpPoster({
          photo, prenomNom, numero: numMaillot.trim(), contexte: contexte.trim(), stats, zoom, focusX, focusY,
          onProgress: setStatus,
        });
      }
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
  const chip = (active) => (active ? styles.orangeButton : styles.darkButton);

  const dateFields = (
    <>
      <label style={label}>Date{kind === "resultat" ? " (facultatif)" : ""}</label>
      <div style={{ display: "flex", gap: 8 }}>
        <select style={{ ...styles.input, flex: 2 }} value={jour} onChange={(e) => setJour(e.target.value)}>{JOURS.map((j) => <option key={j}>{j}</option>)}</select>
        <input style={{ ...styles.input, flex: 1, minWidth: 0 }} value={numero} onChange={(e) => setNumero(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="10" inputMode="numeric" />
        <select style={{ ...styles.input, flex: 2 }} value={mois} onChange={(e) => setMois(e.target.value)}>{MOIS.map((m) => <option key={m}>{m}</option>)}</select>
      </div>
    </>
  );

  return (
    <div>
      <button style={styles.backButton} onClick={onBack}>← Retour</button>
      <h2 style={styles.sectionTitle}>🏀 Affiches</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {KINDS.map((k) => (
          <button key={k.id} style={chip(kind === k.id)} onClick={() => { setKind(k.id); setOrdre(k.id === "resultat" ? "bcmf" : "adversaire"); }}>{k.label}</button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(320px, 420px) 1fr", gap: 20, alignItems: "start" }}>
        <section style={styles.panel}>
          {kind === "resultat" && (
            <>
              <label style={{ ...label, marginTop: 0 }}>Résultat</label>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={chip(resultat === "victoire")} onClick={() => setResultat("victoire")}>Victoire</button>
                <button style={chip(resultat === "defaite")} onClick={() => setResultat("defaite")}>Défaite</button>
              </div>
              <label style={label}>Modèle</label>
              <select style={styles.input} value={modele} onChange={(e) => setModele(e.target.value)}>
                <option value="vert">Fond vert + équipe détourée</option>
                <option value="photo">Photo plein fond + panneau vert</option>
              </select>
            </>
          )}

          <label style={{ ...label, marginTop: kind === "resultat" ? 10 : 0 }}>
            {kind === "mvp" ? "Photo de la joueuse" : modele === "photo" && kind === "resultat" ? "Photo (plein fond)" : "Photo d'équipe"}
          </label>
          {fileBox(photo, photoRef, setPhoto, "📷 Choisir la photo")}

          {needsLogo && (
            <>
              <label style={label}>Logo adverse</label>
              {fileBox(logo, logoRef, setLogo, "🛡️ Choisir le logo")}
            </>
          )}

          {kind === "mvp" ? (
            <>
              <label style={label}>Prénom et nom</label>
              <input style={styles.input} value={prenomNom} onChange={(e) => setPrenomNom(e.target.value)} placeholder="ex. Mariana Muadi" />
              <label style={label}>Numéro de maillot</label>
              <input style={styles.input} value={numMaillot} onChange={(e) => setNumMaillot(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="12" inputMode="numeric" />
              <label style={label}>Contexte (facultatif)</label>
              <input style={styles.input} value={contexte} onChange={(e) => setContexte(e.target.value)} placeholder="ex. Finale, 2ème journée" />
              <label style={label}>Statistiques (laisser vide pour ne pas afficher)</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {stats.map((st, i) => (
                  <div key={i} style={{ display: "flex", gap: 6 }}>
                    <input style={{ ...styles.input, width: "50%", minWidth: 0 }} value={st.label} onChange={(e) => setStats(stats.map((x, k) => (k === i ? { ...x, label: e.target.value.toUpperCase().slice(0, 6) } : x)))} />
                    <input style={{ ...styles.input, width: "50%", minWidth: 0 }} value={st.value} placeholder="–" onChange={(e) => setStats(stats.map((x, k) => (k === i ? { ...x, value: e.target.value.slice(0, 3) } : x)))} />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <label style={label}>Nom de l'équipe{kind === "gameday" ? " (affiché en vertical)" : ""}</label>
              <input list="gd-teams" style={styles.input} value={equipe} onChange={(e) => setEquipe(e.target.value)} placeholder="ex. U11 F" />
              <datalist id="gd-teams">{teams.map((t) => <option key={t.name} value={t.name} />)}</datalist>

              {kind === "resultat" && (
                <>
                  <label style={label}>Score</label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input style={{ ...styles.input, minWidth: 0 }} value={scoreBcmf} onChange={(e) => setScoreBcmf(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="BCMF" inputMode="numeric" />
                    <span>-</span>
                    <input style={{ ...styles.input, minWidth: 0 }} value={scoreAdv} onChange={(e) => setScoreAdv(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="Adversaire" inputMode="numeric" />
                  </div>
                  <label style={label}>Journée / compétition (facultatif)</label>
                  <input style={styles.input} value={journee} onChange={(e) => setJournee(e.target.value)} placeholder="ex. 2ème journée" />
                </>
              )}

              {dateFields}
              {kind === "gameday" && (
                <>
                  <label style={label}>Heure</label>
                  <input style={styles.input} value={heure} onChange={(e) => setHeure(e.target.value)} placeholder="14H00" />
                </>
              )}
              <label style={label}>Salle{kind === "resultat" ? " (facultatif)" : ""}</label>
              <input style={styles.input} value={salle} onChange={(e) => setSalle(e.target.value)} placeholder="ex. Gymnase M. J.Guimier" />
              <label style={label}>Ville{kind === "resultat" ? " (facultatif)" : ""}</label>
              <input style={styles.input} value={ville} onChange={(e) => setVille(e.target.value)} placeholder="ex. Rive-de-Gier" />

              <label style={label}>Ordre des logos{kind === "resultat" ? " / scores" : ""}</label>
              <select style={styles.input} value={ordre} onChange={(e) => setOrdre(e.target.value)}>
                <option value="adversaire">Adversaire à gauche{kind === "resultat" ? " (ou en haut)" : ""}</option>
                <option value="bcmf">BCMF à gauche{kind === "resultat" ? " (ou en haut)" : ""}</option>
              </select>
              <label style={label}>Logo adverse</label>
              <select style={styles.input} value={logoMode} onChange={(e) => setLogoMode(e.target.value)}>
                <option value="auto">Auto</option>
                <option value="cadre">Cadre blanc (logo flou ou fond blanc)</option>
                <option value="detour">Détourer le fond blanc</option>
              </select>
            </>
          )}

          {framing && (
            <>
              <label style={label}>Cadrage de la photo</label>
              <div style={{ fontSize: 12, color: "#64748b" }}>Zoom</div>
              <input type="range" min="1" max="2.5" step="0.05" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} style={{ width: "100%" }} />
              <div style={{ fontSize: 12, color: "#64748b" }}>Gauche ↔ droite</div>
              <input type="range" min="0" max="1" step="0.02" value={focusX} onChange={(e) => setFocusX(Number(e.target.value))} style={{ width: "100%" }} />
              <div style={{ fontSize: 12, color: "#64748b" }}>Haut ↔ bas</div>
              <input type="range" min="0" max="1" step="0.02" value={focusY} onChange={(e) => setFocusY(Number(e.target.value))} style={{ width: "100%" }} />
            </>
          )}

          <button style={busy ? styles.disabledButton : styles.orangeButton} disabled={busy} onClick={generate}>
            {busy ? "Génération…" : "Générer l'affiche"}
          </button>
          {status && <div style={{ marginTop: 10, fontSize: 13, color: "#475569" }}>{status}</div>}
          <div style={{ marginTop: 10, fontSize: 12, color: "#64748b" }}>
            🔒 Les photos restent sur votre appareil : le traitement se fait dans le navigateur, rien n'est envoyé.
          </div>
        </section>

        <section style={{ ...styles.panel, textAlign: "center" }}>
          {previewUrl ? (
            <>
              <div style={{ width: "100%", maxWidth: isMobile ? 520 : "min(560px, 62vh)", aspectRatio: kind === "mvp" ? "1 / 1" : "4 / 5", margin: "0 auto" }}>
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
