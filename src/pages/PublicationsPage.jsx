import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../services/supabaseClient.js";
import { publishToSportsRegions } from "../services/sportsregions.js";
import { useIsMobile } from "../hooks/useIsMobile.js";
import { getStyles } from "../styles/styles.js";

const GREEN = "#16a34a";
const GREEN_DARK = "#14532d";
const GREEN_LIGHT = "#dcfce7";

// ─── TABLE SUPABASE À CRÉER ───────────────────────────────────────────────────
// CREATE TABLE publications (
//   id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   event_id    uuid REFERENCES events(id) ON DELETE SET NULL,
//   event_title text,
//   team_name   text,
//   opponent    text,
//   score_us    int,
//   score_them  int,
//   note        text,
//   photos      text[],          -- URLs Supabase Storage
//   published_by text,
//   synced      boolean DEFAULT false,
//   created_at  timestamptz DEFAULT now()
// );
// ─────────────────────────────────────────────────────────────────────────────

export default function PublicationsPage({ currentUser, events = [], onBack }) {
  const isMobile = useIsMobile();
  const styles = getStyles(isMobile);

  const [publications, setPublications] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showForm, setShowForm]         = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [syncing, setSyncing]           = useState(null); // id de la pub en cours de sync
  const [previewUrls, setPreviewUrls]   = useState([]);

  const fileInputRef = useRef();

  const ALL_TEAMS = ["Club","U7","U9","U11GP","U11PP","U13-1","U13-2","U15-1","U15-2","U18","U18-Elite","PNF","Loisir","DF3","LF2"];

  // Équipes accessibles selon le rôle
  const userTeams = currentUser.role === "admin"
    ? ALL_TEAMS
    : (currentUser.team ? currentUser.team.split(",").map(t => t.trim()).filter(Boolean) : []);

  // Pré-sélection si une seule équipe
  const defaultTeam = userTeams.length === 1 ? userTeams[0] : "";

  const emptyForm = {
    event_id:   "",
    team_name:  defaultTeam,
    opponent:   "",
    score_us:   "",
    score_them: "",
    note:       "",
    files:      [],
  };
  const [form, setForm] = useState(emptyForm);

  // ── Chargement des publications ──────────────────────────────────────────
  useEffect(() => {
    loadPublications();
  }, []);

  async function loadPublications() {
    setLoading(true);
    const { data, error } = await supabase
      .from("publications")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) setPublications(data || []);
    setLoading(false);
  }

  // ── Sélection de fichiers ────────────────────────────────────────────────
  function handleFileChange(e) {
    const files = Array.from(e.target.files);
    setForm((f) => ({ ...f, files }));
    setPreviewUrls(files.map((file) => URL.createObjectURL(file)));
  }

  function removeFile(index) {
    const newFiles = form.files.filter((_, i) => i !== index);
    setForm((f) => ({ ...f, files: newFiles }));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  }

  // ── Upload photos → Supabase Storage ────────────────────────────────────
  async function uploadPhotos(files, pubId) {
    const urls = [];
    for (const file of files) {
      const ext  = file.name.split(".").pop();
      const path = `publications/${pubId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage
        .from("bcmf-media")
        .upload(path, file);
      if (!error) {
        const { data } = supabase.storage.from("bcmf-media").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
    }
    return urls;
  }

  // ── Soumission du formulaire ─────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.team_name) return;
    setSubmitting(true);

    const selectedEvent = events.find((ev) => ev.id === form.event_id);

    // 1. Créer la publication sans photos d'abord
    const { data, error } = await supabase
      .from("publications")
      .insert([{
        event_id:    form.event_id || null,
        event_title: selectedEvent?.title || null,
        team_name:   form.team_name || selectedEvent?.teamsList?.[0]?.name || "",
        opponent:    form.opponent,
        score_us:    form.score_us !== "" ? Number(form.score_us) : null,
        score_them:  form.score_them !== "" ? Number(form.score_them) : null,
        note:        form.note || null,
        photos:      [],
        published_by: currentUser.name,
        synced:      false,
      }])
      .select()
      .single();

    if (error) {
      alert("Erreur : " + error.message);
      setSubmitting(false);
      return;
    }

    // 2. Uploader les photos si présentes
    let photoUrls = [];
    if (form.files.length > 0) {
      photoUrls = await uploadPhotos(form.files, data.id);
      await supabase
        .from("publications")
        .update({ photos: photoUrls })
        .eq("id", data.id);
    }

    setPublications((prev) => [{ ...data, photos: photoUrls }, ...prev]);
    setForm(emptyForm);
    setPreviewUrls([]);
    setShowForm(false);
    setSubmitting(false);
  }

  // ── Supprimer une publication ────────────────────────────────────────────
  async function handleDelete(id) {
    if (!confirm("Supprimer cette publication ?")) return;
    await supabase.from("publications").delete().eq("id", id);
    setPublications((prev) => prev.filter((p) => p.id !== id));
  }

  // ── Publier sur SportsRegions ────────────────────────────────────────────
  async function handlePublishToSR(pub) {
    setSyncing(pub.id);
    const result = await publishToSportsRegions(pub);
    setSyncing(null);

    if (!result.success) {
      alert("Erreur lors de la publication : " + result.error);
      return;
    }

    await supabase.from("publications").update({ synced: true }).eq("id", pub.id);
    setPublications((prev) =>
      prev.map((p) => (p.id === pub.id ? { ...p, synced: true } : p))
    );
  }

  // ── Helpers affichage ────────────────────────────────────────────────────
  function formatDate(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  function scoreLabel(pub) {
    if (pub.score_us == null && pub.score_them == null) return null;
    const us   = pub.score_us   ?? "?";
    const them = pub.score_them ?? "?";
    const win  = pub.score_us > pub.score_them;
    const draw = pub.score_us === pub.score_them;
    const color = win ? GREEN : draw ? "#f59e0b" : "#ef4444";
    const label = win ? "Victoire" : draw ? "Match nul" : "Défaite";
    return { us, them, color, label };
  }

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── En-tête ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 24, marginBottom: 20, flexWrap: "wrap" }}>
        <button onClick={onBack} style={styles.backButton}>← Retour</button>
        <h2 style={{ margin: 0, color: GREEN_DARK, fontSize: isMobile ? 20 : 26 }}>
          📣 Publications
        </h2>
        <span style={{ marginLeft: "auto" }}>
          <button
            onClick={() => setShowForm(!showForm)}
            style={{
              background: GREEN,
              color: "white",
              border: "none",
              padding: "10px 20px",
              borderRadius: 12,
              fontWeight: "bold",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            {showForm ? "Annuler" : "+ Nouvelle publication"}
          </button>
        </span>
      </div>

      {/* ── Formulaire de création ── */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          style={{
            background: "white",
            borderRadius: 20,
            padding: isMobile ? 18 : 28,
            boxShadow: "0 4px 20px rgba(0,0,0,.1)",
            marginBottom: 28,
            borderTop: `5px solid ${GREEN}`,
          }}
        >
          <h3 style={{ margin: "0 0 18px", color: GREEN_DARK }}>Nouvelle publication</h3>

          <div style={{ display: "grid", gap: 14 }}>
            {/* Événement lié */}
            <div>
              <label style={labelStyle}>Événement lié (optionnel)</label>
              <select
                value={form.event_id}
                onChange={(e) => setForm((f) => ({ ...f, event_id: e.target.value }))}
                style={inputStyle}
              >
                <option value="">— Aucun événement sélectionné —</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title} {ev.start_datetime ? `(${new Date(ev.start_datetime).toLocaleDateString("fr-FR")})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Équipe */}
            <div>
              <label style={labelStyle}>Équipe *</label>
              {userTeams.length === 1 ? (
                // Une seule équipe → affichage fixe
                <div style={{ ...inputStyle, background: "#f3f4f6", color: "#374151", fontWeight: "bold" }}>
                  {userTeams[0]}
                </div>
              ) : (
                <select
                  required
                  value={form.team_name}
                  onChange={(e) => setForm((f) => ({ ...f, team_name: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="">— Sélectionner une équipe —</option>
                  {userTeams.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Adversaire */}
            <div>
              <label style={labelStyle}>Adversaire (optionnel)</label>
              <input
                placeholder="Nom de l'équipe adverse (si match)"
                value={form.opponent}
                onChange={(e) => setForm((f) => ({ ...f, opponent: e.target.value }))}
                style={inputStyle}
              />
            </div>

            {/* Score */}
            <div>
              <label style={labelStyle}>Score</label>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  type="number"
                  min="0"
                  placeholder="Nous"
                  value={form.score_us}
                  onChange={(e) => setForm((f) => ({ ...f, score_us: e.target.value }))}
                  style={{ ...inputStyle, width: 80, textAlign: "center", fontSize: 22, fontWeight: "bold" }}
                />
                <span style={{ fontWeight: "bold", fontSize: 20, color: "#666" }}>–</span>
                <input
                  type="number"
                  min="0"
                  placeholder="Eux"
                  value={form.score_them}
                  onChange={(e) => setForm((f) => ({ ...f, score_them: e.target.value }))}
                  style={{ ...inputStyle, width: 80, textAlign: "center", fontSize: 22, fontWeight: "bold" }}
                />
              </div>
            </div>

            {/* Note / commentaire */}
            <div>
              <label style={labelStyle}>Commentaire (optionnel)</label>
              <textarea
                rows={3}
                placeholder="Belle victoire de l'équipe ! Bravo à toutes..."
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>

            {/* Photos */}
            <div>
              <label style={labelStyle}>Photos du match</label>
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: "2px dashed #86efac",
                  borderRadius: 12,
                  padding: "20px",
                  textAlign: "center",
                  cursor: "pointer",
                  background: GREEN_LIGHT,
                  color: GREEN_DARK,
                  fontWeight: "bold",
                }}
              >
                📸 Cliquer pour ajouter des photos
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />

              {previewUrls.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
                  {previewUrls.map((url, i) => (
                    <div key={i} style={{ position: "relative" }}>
                      <img
                        src={url}
                        alt=""
                        style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 10 }}
                      />
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        style={{
                          position: "absolute", top: -6, right: -6,
                          background: "#ef4444", color: "white",
                          border: "none", borderRadius: "50%",
                          width: 22, height: 22, cursor: "pointer",
                          fontWeight: "bold", fontSize: 12, lineHeight: "22px",
                        }}
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              marginTop: 20,
              background: submitting ? "#86efac" : GREEN,
              color: "white",
              border: "none",
              padding: "12px 28px",
              borderRadius: 12,
              fontWeight: "bold",
              cursor: submitting ? "not-allowed" : "pointer",
              fontSize: 15,
              width: isMobile ? "100%" : "auto",
            }}
          >
            {submitting ? "Publication en cours..." : "Publier"}
          </button>
        </form>
      )}

      {/* ── Historique ── */}
      {loading ? (
        <p style={{ color: "#888", textAlign: "center" }}>Chargement...</p>
      ) : publications.length === 0 ? (
        <div style={{
          background: "white", borderRadius: 16, padding: 30,
          textAlign: "center", color: "#888", boxShadow: "0 2px 8px rgba(0,0,0,.06)",
        }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📭</div>
          Aucune publication pour l'instant.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {publications.map((pub) => {
            const sc = scoreLabel(pub);
            return (
              <div
                key={pub.id}
                style={{
                  background: "white",
                  borderRadius: 18,
                  padding: isMobile ? 16 : 22,
                  boxShadow: "0 4px 14px rgba(0,0,0,.08)",
                  borderLeft: `5px solid ${sc ? sc.color : GREEN}`,
                }}
              >
                {/* En-tête de la carte */}
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: "bold", fontSize: 16, color: GREEN_DARK }}>
                      {pub.team_name || "BCMF"} vs {pub.opponent}
                    </div>
                    {pub.event_title && (
                      <div style={{ fontSize: 13, color: "#888" }}>📅 {pub.event_title}</div>
                    )}
                    <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>
                      Publié par {pub.published_by} · {formatDate(pub.created_at)}
                    </div>
                  </div>

                  {/* Score */}
                  {sc && (
                    <div style={{ textAlign: "center" }}>
                      <div style={{
                        fontSize: isMobile ? 28 : 34,
                        fontWeight: "bold",
                        color: sc.color,
                        lineHeight: 1,
                      }}>
                        {sc.us} – {sc.them}
                      </div>
                      <span style={{
                        fontSize: 12, fontWeight: "bold",
                        background: sc.color + "22",
                        color: sc.color,
                        padding: "2px 10px",
                        borderRadius: 999,
                      }}>
                        {sc.label}
                      </span>
                    </div>
                  )}
                </div>

                {/* Note */}
                {pub.note && (
                  <p style={{ margin: "12px 0 0", color: "#444", fontStyle: "italic", fontSize: 14 }}>
                    "{pub.note}"
                  </p>
                )}

                {/* Photos */}
                {pub.photos?.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                    {pub.photos.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer">
                        <img
                          src={url}
                          alt=""
                          style={{ width: 70, height: 70, objectFit: "cover", borderRadius: 10 }}
                        />
                      </a>
                    ))}
                    <span style={{ alignSelf: "center", fontSize: 12, color: "#888" }}>
                      {pub.photos.length} photo{pub.photos.length > 1 ? "s" : ""}
                    </span>
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                  {/* Bouton sync SportsRegions */}
                  {pub.synced ? (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      background: GREEN_LIGHT, color: GREEN_DARK,
                      padding: "7px 14px", borderRadius: 10,
                      fontSize: 13, fontWeight: "bold",
                    }}>
                      ✅ Publié sur le site
                    </span>
                  ) : (
                    <button
                      onClick={() => handlePublishToSR(pub)}
                      disabled={syncing === pub.id}
                      style={{
                        background: syncing === pub.id ? "#86efac" : GREEN,
                        color: "white", border: "none",
                        padding: "7px 14px", borderRadius: 10,
                        fontSize: 13, fontWeight: "bold",
                        cursor: syncing === pub.id ? "not-allowed" : "pointer",
                        display: "inline-flex", alignItems: "center", gap: 6,
                      }}
                    >
                      {syncing === pub.id ? "⏳ Publication..." : "🌐 Publier sur le site"}
                    </button>
                  )}

                  {/* Supprimer (admin uniquement) */}
                  {currentUser.role === "admin" && (
                    <button
                      onClick={() => handleDelete(pub.id)}
                      style={{
                        background: "#fee2e2",
                        color: "#dc2626",
                        border: "none",
                        padding: "7px 14px",
                        borderRadius: 10,
                        cursor: "pointer",
                        fontSize: 13,
                        fontWeight: "bold",
                      }}
                    >
                      🗑 Supprimer
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Styles locaux ─────────────────────────────────────────────────────────────
const labelStyle = {
  display: "block",
  fontWeight: "bold",
  marginBottom: 6,
  color: "#374151",
  fontSize: 14,
};

const inputStyle = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 10,
  border: "1.5px solid #d1fae5",
  fontSize: 14,
  boxSizing: "border-box",
  outline: "none",
};
