import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../services/supabaseClient.js";
import { publishToSportsRegions } from "../services/sportsregions.js";
import { useIsMobile } from "../hooks/useIsMobile.js";
import { getStyles } from "../styles/styles.js";

const GREEN       = "#16a34a";
const GREEN_DARK  = "#14532d";
const GREEN_LIGHT = "#dcfce7";

export default function PublicationsPage({ currentUser, onBack }) {
  const isMobile = useIsMobile();
  const styles   = getStyles(isMobile);

  const [publications, setPublications] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showForm, setShowForm]         = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [syncing, setSyncing]           = useState(null);
  const [previewUrls, setPreviewUrls]   = useState([]);
  const [allTeams, setAllTeams]         = useState([]);

  const fileInputRef = useRef();

  // Équipes accessibles selon le rôle
  const userTeamNames = currentUser.role === "admin"
    ? allTeams.map((t) => t.name)
    : (currentUser.teamsList || []).map((t) => t.name);

  const defaultTeam = userTeamNames.length === 1 ? userTeamNames[0] : "";
  const emptyForm   = { team_name: defaultTeam, files: [] };
  const [form, setForm] = useState(emptyForm);

  // ── Chargement ────────────────────────────────────────────────────────────
  useEffect(() => {
    loadPublications();
    supabase.from("teams").select("*").eq("active", true).order("name")
      .then(({ data }) => setAllTeams(data || []));
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

  // ── Fichiers ──────────────────────────────────────────────────────────────
  function handleFileChange(e) {
    const files = Array.from(e.target.files);
    setForm((f) => ({ ...f, files }));
    setPreviewUrls(files.map((file) => URL.createObjectURL(file)));
  }

  function removeFile(index) {
    setForm((f) => ({ ...f, files: f.files.filter((_, i) => i !== index) }));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  }

  // ── Upload photos ─────────────────────────────────────────────────────────
  async function uploadPhotos(files, pubId) {
    const urls = [];
    for (const file of files) {
      const ext  = file.name.split(".").pop();
      const path = `publications/${pubId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("bcmf-media").upload(path, file);
      if (!error) {
        const { data } = supabase.storage.from("bcmf-media").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
    }
    return urls;
  }

  // ── Soumission ────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.team_name) return;
    if (form.files.length === 0) { alert("Merci d'ajouter au moins une photo."); return; }
    setSubmitting(true);

    const { data, error } = await supabase
      .from("publications")
      .insert([{
        team_name:    form.team_name,
        photos:       [],
        published_by: currentUser.name,
        synced:       false,
      }])
      .select()
      .single();

    if (error) { alert("Erreur : " + error.message); setSubmitting(false); return; }

    const photoUrls = await uploadPhotos(form.files, data.id);
    await supabase.from("publications").update({ photos: photoUrls }).eq("id", data.id);

    setPublications((prev) => [{ ...data, photos: photoUrls }, ...prev]);
    setForm({ ...emptyForm, team_name: defaultTeam });
    setPreviewUrls([]);
    setShowForm(false);
    setSubmitting(false);
  }

  // ── Sync sportsregions ────────────────────────────────────────────────────
  async function handleSync(pub) {
    setSyncing(pub.id);
    const result = await publishToSportsRegions(pub);
    if (result.success) {
      await supabase.from("publications").update({ synced: true }).eq("id", pub.id);
      setPublications((prev) => prev.map((p) => p.id === pub.id ? { ...p, synced: true } : p));
    } else {
      alert("Erreur lors de la mise en ligne : " + result.error);
    }
    setSyncing(null);
  }

  // ── Suppression ───────────────────────────────────────────────────────────
  async function handleDelete(id) {
    if (!confirm("Supprimer cette publication ?")) return;
    await supabase.from("publications").delete().eq("id", id);
    setPublications((prev) => prev.filter((p) => p.id !== id));
  }

  function formatDate(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* En-tête */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 24, marginBottom: 20, flexWrap: "wrap" }}>
        <button onClick={onBack} style={styles.backButton}>← Retour</button>
        <h2 style={{ margin: 0, color: GREEN_DARK, fontSize: isMobile ? 20 : 26 }}>📣 Publications</h2>
        <span style={{ marginLeft: "auto" }}>
          <button
            onClick={() => setShowForm(!showForm)}
            style={{ background: GREEN, color: "white", border: "none", padding: "10px 20px", borderRadius: 12, fontWeight: "bold", cursor: "pointer", fontSize: 14 }}
          >
            {showForm ? "Annuler" : "+ Nouvelle publication"}
          </button>
        </span>
      </div>

      {/* Formulaire */}
      {showForm && (
        <form onSubmit={handleSubmit} style={{ background: "white", borderRadius: 20, padding: isMobile ? 18 : 28, boxShadow: "0 4px 20px rgba(0,0,0,.1)", marginBottom: 28, borderTop: `5px solid ${GREEN}` }}>
          <h3 style={{ margin: "0 0 18px", color: GREEN_DARK }}>Nouvelle publication</h3>

          <div style={{ display: "grid", gap: 14 }}>
            {/* Équipe */}
            <div>
              <label style={labelStyle}>Équipe *</label>
              {userTeamNames.length === 1 ? (
                <div style={{ ...inputStyle, background: "#f3f4f6", color: "#374151", fontWeight: "bold" }}>
                  {userTeamNames[0]}
                </div>
              ) : (
                <select
                  required
                  value={form.team_name}
                  onChange={(e) => setForm((f) => ({ ...f, team_name: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="">— Sélectionner une équipe —</option>
                  {userTeamNames.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Photos */}
            <div>
              <label style={labelStyle}>Photos *</label>
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{ border: "2px dashed #86efac", borderRadius: 12, padding: 20, textAlign: "center", cursor: "pointer", background: GREEN_LIGHT, color: GREEN_DARK, fontWeight: "bold" }}
              >
                📸 Cliquer pour ajouter des photos
              </div>
              <input ref={fileInputRef} type="file" multiple accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />

              {previewUrls.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
                  {previewUrls.map((url, i) => (
                    <div key={i} style={{ position: "relative" }}>
                      <img src={url} alt="" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 10 }} />
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        style={{ position: "absolute", top: -6, right: -6, background: "#ef4444", color: "white", border: "none", borderRadius: "50%", width: 22, height: 22, cursor: "pointer", fontWeight: "bold", fontSize: 12, lineHeight: "22px" }}
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
            style={{ marginTop: 20, background: submitting ? "#86efac" : GREEN, color: "white", border: "none", padding: "12px 28px", borderRadius: 12, fontWeight: "bold", cursor: submitting ? "not-allowed" : "pointer", fontSize: 15, width: isMobile ? "100%" : "auto" }}
          >
            {submitting ? "Publication en cours..." : "Publier"}
          </button>
        </form>
      )}

      {/* Liste */}
      {loading ? (
        <p style={{ color: "#888", textAlign: "center" }}>Chargement...</p>
      ) : publications.length === 0 ? (
        <div style={{ background: "white", borderRadius: 16, padding: 30, textAlign: "center", color: "#888", boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📭</div>
          Aucune publication pour l'instant.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {publications.map((pub) => (
            <div key={pub.id} style={{ background: "white", borderRadius: 18, padding: isMobile ? 16 : 22, boxShadow: "0 4px 14px rgba(0,0,0,.08)", borderLeft: `5px solid ${GREEN}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ fontWeight: "bold", fontSize: 16, color: GREEN_DARK }}>
                    {pub.team_name || "BCMF"}
                  </div>
                  <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>
                    Publié par {pub.published_by} · {formatDate(pub.created_at)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {(currentUser.role === "admin" || currentUser.role === "referent") && !pub.synced && (
                    <button
                      onClick={() => handleSync(pub)}
                      disabled={syncing === pub.id}
                      style={{ background: syncing === pub.id ? "#86efac" : "#16a34a", color: "white", border: "none", padding: "7px 14px", borderRadius: 10, cursor: syncing === pub.id ? "not-allowed" : "pointer", fontSize: 13, fontWeight: "bold" }}
                    >
                      {syncing === pub.id ? "⏳ Envoi..." : "🌐 Mettre en ligne"}
                    </button>
                  )}
                  {pub.synced && (
                    <span style={{ background: "#dcfce7", color: "#16a34a", padding: "7px 14px", borderRadius: 10, fontSize: 13, fontWeight: "bold" }}>
                      ✅ En ligne
                    </span>
                  )}
                  {currentUser.role === "admin" && (
                    <button
                      onClick={() => handleDelete(pub.id)}
                      style={{ background: "#fee2e2", color: "#dc2626", border: "none", padding: "7px 14px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: "bold" }}
                    >
                      🗑 Supprimer
                    </button>
                  )}
                </div>
              </div>

              {pub.photos?.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                  {pub.photos.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noreferrer">
                      <img src={url} alt="" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 10 }} />
                    </a>
                  ))}
                  <span style={{ alignSelf: "center", fontSize: 12, color: "#888" }}>
                    {pub.photos.length} photo{pub.photos.length > 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const labelStyle = { display: "block", fontWeight: "bold", marginBottom: 6, color: "#374151", fontSize: 14 };
const inputStyle = { width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #d1fae5", fontSize: 14, boxSizing: "border-box", outline: "none" };
