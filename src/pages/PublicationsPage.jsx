import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../services/supabaseClient.js";
import { publishToSportsRegions, publishNewsToSportsRegions } from "../services/sportsregions.js";
import { useIsMobile } from "../hooks/useIsMobile.js";
import { getStyles } from "../styles/styles.js";

const GREEN       = "#16a34a";
const GREEN_DARK  = "#14532d";
const GREEN_LIGHT = "#dcfce7";

export default function PublicationsPage({ currentUser, onBack }) {
  const isMobile = useIsMobile();
  const styles   = getStyles(isMobile);

  const [tab, setTab]                   = useState("photos"); // "photos" | "news"
  const [publications, setPublications] = useState([]);
  const [newsList, setNewsList]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showForm, setShowForm]         = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [syncing, setSyncing]           = useState(null);
  const [previewUrls, setPreviewUrls]   = useState([]);
  const [allTeams, setAllTeams]         = useState([]);

  const fileInputRef = useRef();
  const illuInputRef = useRef();

  const isAdmin    = currentUser.role === "admin";
  const isReferent = currentUser.role === "referent";

  const userTeamNames = isAdmin
    ? allTeams.map((t) => t.name)
    : (currentUser.teamsList || []).map((t) => t.name);

  const defaultTeam = userTeamNames.length === 1 ? userTeamNames[0] : "";

  const emptyPhoto = { team_name: defaultTeam, files: [] };
  const emptyNews  = { titre: "", chapo: "", corps: "", team_name: defaultTeam, illustration: null };

  const [photoForm, setPhotoForm]     = useState(emptyPhoto);
  const [newsForm, setNewsForm]       = useState(emptyNews);
  const [illuPreview, setIlluPreview] = useState(null);

  // ── Chargement ────────────────────────────────────────────────────────────
  useEffect(() => {
    loadAll();
    supabase.from("teams").select("*").eq("active", true).order("name")
      .then(({ data }) => setAllTeams(data || []));
  }, []);

  async function loadAll() {
    setLoading(true);
    const [{ data: pubs }, { data: news }] = await Promise.all([
      supabase.from("publications").select("*").order("created_at", { ascending: false }),
      supabase.from("news").select("*").order("created_at", { ascending: false }),
    ]);
    setPublications(pubs || []);
    setNewsList(news || []);
    setLoading(false);
  }

  // ── Photos ────────────────────────────────────────────────────────────────
  function handleFileChange(e) {
    const files = Array.from(e.target.files);
    setPhotoForm((f) => ({ ...f, files }));
    setPreviewUrls(files.map((file) => URL.createObjectURL(file)));
  }

  function removeFile(index) {
    setPhotoForm((f) => ({ ...f, files: f.files.filter((_, i) => i !== index) }));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  }

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

  async function handlePhotoSubmit(e) {
    e.preventDefault();
    if (!photoForm.team_name) return;
    if (photoForm.files.length === 0) { alert("Merci d'ajouter au moins une photo."); return; }
    setSubmitting(true);

    const { data, error } = await supabase
      .from("publications")
      .insert([{ team_name: photoForm.team_name, photos: [], published_by: currentUser.name, synced: false }])
      .select().single();

    if (error) { alert("Erreur : " + error.message); setSubmitting(false); return; }

    const photoUrls = await uploadPhotos(photoForm.files, data.id);
    await supabase.from("publications").update({ photos: photoUrls }).eq("id", data.id);

    setPublications((prev) => [{ ...data, photos: photoUrls }, ...prev]);
    setPhotoForm({ ...emptyPhoto, team_name: defaultTeam });
    setPreviewUrls([]);
    setShowForm(false);
    setSubmitting(false);
  }

  async function handlePhotoSync(pub) {
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

  async function handlePhotoDelete(id) {
    if (!confirm("Supprimer cette publication ?")) return;
    await supabase.from("publications").delete().eq("id", id);
    setPublications((prev) => prev.filter((p) => p.id !== id));
  }

  // ── News ──────────────────────────────────────────────────────────────────
  function handleIlluChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setNewsForm((f) => ({ ...f, illustration: file }));
    setIlluPreview(URL.createObjectURL(file));
  }

  async function uploadIllustration(file, newsId) {
    const ext  = file.name.split(".").pop();
    const path = `news/${newsId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("bcmf-media").upload(path, file);
    if (error) return null;
    const { data } = supabase.storage.from("bcmf-media").getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleNewsSubmit(e) {
    e.preventDefault();
    if (!newsForm.titre.trim()) { alert("Le titre est obligatoire."); return; }
    setSubmitting(true);

    const { data, error } = await supabase
      .from("news")
      .insert([{
        titre:        newsForm.titre,
        chapo:        newsForm.chapo,
        corps:        newsForm.corps,
        team_name:    newsForm.team_name || null,
        published_by: currentUser.name,
        synced:       false,
      }])
      .select().single();

    if (error) { alert("Erreur : " + error.message); setSubmitting(false); return; }

    let illuUrl = null;
    if (newsForm.illustration) {
      illuUrl = await uploadIllustration(newsForm.illustration, data.id);
      if (illuUrl) {
        await supabase.from("news").update({ illustration_url: illuUrl }).eq("id", data.id);
      }
    }

    setNewsList((prev) => [{ ...data, illustration_url: illuUrl }, ...prev]);
    setNewsForm({ ...emptyNews, team_name: defaultTeam });
    setIlluPreview(null);
    setShowForm(false);
    setSubmitting(false);
  }

  async function handleNewsSync(news) {
    setSyncing(news.id);
    const result = await publishNewsToSportsRegions(news);
    if (result.success) {
      await supabase.from("news").update({ synced: true }).eq("id", news.id);
      setNewsList((prev) => prev.map((n) => n.id === news.id ? { ...n, synced: true } : n));
    } else {
      alert("Erreur lors de la mise en ligne : " + result.error);
    }
    setSyncing(null);
  }

  async function handleNewsDelete(id) {
    if (!confirm("Supprimer cette actualité ?")) return;
    await supabase.from("news").delete().eq("id", id);
    setNewsList((prev) => prev.filter((n) => n.id !== id));
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
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 24, marginBottom: 16, flexWrap: "wrap" }}>
        <button onClick={onBack} style={styles.backButton}>← Retour</button>
        <h2 style={{ margin: 0, color: GREEN_DARK, fontSize: isMobile ? 20 : 26 }}>📣 Publications</h2>
        <span style={{ marginLeft: "auto" }}>
          <button
            onClick={() => setShowForm(!showForm)}
            style={{ background: GREEN, color: "white", border: "none", padding: "10px 20px", borderRadius: 12, fontWeight: "bold", cursor: "pointer", fontSize: 14 }}
          >
            {showForm ? "Annuler" : tab === "news" ? "+ Nouvelle actualité" : "+ Nouvelle publication"}
          </button>
        </span>
      </div>

      {/* Onglets */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {["photos", "news"].map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setShowForm(false); }}
            style={{
              padding: "8px 20px", borderRadius: 10, border: "none", cursor: "pointer",
              fontWeight: "bold", fontSize: 14,
              background: tab === t ? GREEN : "#f0fdf4",
              color: tab === t ? "white" : GREEN_DARK,
            }}
          >
            {t === "photos" ? "📸 Photos" : "📰 Actualités"}
          </button>
        ))}
      </div>

      {/* ── Formulaire Photos ── */}
      {showForm && tab === "photos" && (
        <form onSubmit={handlePhotoSubmit} style={formStyle}>
          <h3 style={{ margin: "0 0 18px", color: GREEN_DARK }}>Nouvelle publication photos</h3>
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <label style={labelStyle}>Équipe *</label>
              {userTeamNames.length === 1 ? (
                <div style={{ ...inputStyle, background: "#f3f4f6", color: "#374151", fontWeight: "bold" }}>{userTeamNames[0]}</div>
              ) : (
                <select required value={photoForm.team_name} onChange={(e) => setPhotoForm((f) => ({ ...f, team_name: e.target.value }))} style={inputStyle}>
                  <option value="">— Sélectionner une équipe —</option>
                  {userTeamNames.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              )}
            </div>
            <div>
              <label style={labelStyle}>Photos *</label>
              <div onClick={() => fileInputRef.current?.click()} style={{ border: "2px dashed #86efac", borderRadius: 12, padding: 20, textAlign: "center", cursor: "pointer", background: GREEN_LIGHT, color: GREEN_DARK, fontWeight: "bold" }}>
                📸 Cliquer pour ajouter des photos
              </div>
              <input ref={fileInputRef} type="file" multiple accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
              {previewUrls.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
                  {previewUrls.map((url, i) => (
                    <div key={i} style={{ position: "relative" }}>
                      <img src={url} alt="" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 10 }} />
                      <button type="button" onClick={() => removeFile(i)} style={{ position: "absolute", top: -6, right: -6, background: "#ef4444", color: "white", border: "none", borderRadius: "50%", width: 22, height: 22, cursor: "pointer", fontWeight: "bold", fontSize: 12, lineHeight: "22px" }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button type="submit" disabled={submitting} style={submitBtnStyle(submitting, isMobile)}>
            {submitting ? "Publication en cours..." : "Publier"}
          </button>
        </form>
      )}

      {/* ── Formulaire News (admin seulement) ── */}
      {showForm && tab === "news" && isAdmin && (
        <form onSubmit={handleNewsSubmit} style={formStyle}>
          <h3 style={{ margin: "0 0 18px", color: GREEN_DARK }}>Nouvelle actualité</h3>
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <label style={labelStyle}>Titre *</label>
              <input required value={newsForm.titre} onChange={(e) => setNewsForm((f) => ({ ...f, titre: e.target.value }))} placeholder="Titre de l'actualité" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Texte chapeau</label>
              <textarea value={newsForm.chapo} onChange={(e) => setNewsForm((f) => ({ ...f, chapo: e.target.value }))} placeholder="Texte d'accroche court..." rows={3} style={{ ...inputStyle, resize: "vertical" }} />
            </div>
            <div>
              <label style={labelStyle}>Texte principal</label>
              <textarea value={newsForm.corps} onChange={(e) => setNewsForm((f) => ({ ...f, corps: e.target.value }))} placeholder="Contenu de l'actualité..." rows={6} style={{ ...inputStyle, resize: "vertical" }} />
            </div>
            <div>
              <label style={labelStyle}>Équipe concernée</label>
              <select value={newsForm.team_name} onChange={(e) => setNewsForm((f) => ({ ...f, team_name: e.target.value }))} style={inputStyle}>
                <option value="">— Toutes les équipes —</option>
                {allTeams.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Illustration</label>
              <div onClick={() => illuInputRef.current?.click()} style={{ border: "2px dashed #86efac", borderRadius: 12, padding: 16, textAlign: "center", cursor: "pointer", background: GREEN_LIGHT, color: GREEN_DARK, fontWeight: "bold" }}>
                {illuPreview
                  ? <img src={illuPreview} alt="" style={{ maxHeight: 120, borderRadius: 8 }} />
                  : "🖼 Cliquer pour ajouter une illustration"}
              </div>
              <input ref={illuInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleIlluChange} />
            </div>
          </div>
          <button type="submit" disabled={submitting} style={submitBtnStyle(submitting, isMobile)}>
            {submitting ? "Publication en cours..." : "Publier"}
          </button>
        </form>
      )}

      {/* ── Liste Photos ── */}
      {tab === "photos" && (
        loading ? <p style={{ color: "#888", textAlign: "center" }}>Chargement...</p>
        : publications.length === 0 ? <EmptyState label="Aucune publication pour l'instant." />
        : (
          <div style={{ display: "grid", gap: 16 }}>
            {publications.map((pub) => (
              <div key={pub.id} style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: "bold", fontSize: 16, color: GREEN_DARK }}>{pub.team_name || "BCMF"}</div>
                    <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>Publié par {pub.published_by} · {formatDate(pub.created_at)}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {(isAdmin || isReferent) && !pub.synced && (
                      <button onClick={() => handlePhotoSync(pub)} disabled={syncing === pub.id} style={syncBtnStyle(syncing === pub.id)}>
                        {syncing === pub.id ? "⏳ Envoi..." : "🌐 Mettre en ligne"}
                      </button>
                    )}
                    {pub.synced && <span style={onlineBadge}>✅ En ligne</span>}
                    {isAdmin && (
                      <button onClick={() => handlePhotoDelete(pub.id)} style={deleteBtnStyle}>🗑 Supprimer</button>
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
                    <span style={{ alignSelf: "center", fontSize: 12, color: "#888" }}>{pub.photos.length} photo{pub.photos.length > 1 ? "s" : ""}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Liste News ── */}
      {tab === "news" && (
        loading ? <p style={{ color: "#888", textAlign: "center" }}>Chargement...</p>
        : newsList.length === 0 ? <EmptyState label="Aucune actualité pour l'instant." />
        : (
          <div style={{ display: "grid", gap: 16 }}>
            {newsList.map((news) => (
              <div key={news.id} style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: "bold", fontSize: 16, color: GREEN_DARK }}>{news.titre}</div>
                    {news.team_name && <div style={{ fontSize: 12, color: GREEN, fontWeight: "bold", marginTop: 2 }}>{news.team_name}</div>}
                    {news.chapo && <div style={{ fontSize: 13, color: "#555", marginTop: 6, fontStyle: "italic" }}>{news.chapo}</div>}
                    <div style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>Par {news.published_by} · {formatDate(news.created_at)}</div>
                  </div>
                  {news.illustration_url && (
                    <img src={news.illustration_url} alt="" style={{ width: 80, height: 60, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  {isAdmin && !news.synced && (
                    <button onClick={() => handleNewsSync(news)} disabled={syncing === news.id} style={syncBtnStyle(syncing === news.id)}>
                      {syncing === news.id ? "⏳ Envoi..." : "🌐 Mettre en ligne"}
                    </button>
                  )}
                  {news.synced && <span style={onlineBadge}>✅ En ligne</span>}
                  {isAdmin && (
                    <button onClick={() => handleNewsDelete(news.id)} style={deleteBtnStyle}>🗑 Supprimer</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function EmptyState({ label }) {
  return (
    <div style={{ background: "white", borderRadius: 16, padding: 30, textAlign: "center", color: "#888", boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
      <div style={{ fontSize: 40, marginBottom: 10 }}>📭</div>
      {label}
    </div>
  );
}

const labelStyle     = { display: "block", fontWeight: "bold", marginBottom: 6, color: "#374151", fontSize: 14 };
const inputStyle     = { width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #d1fae5", fontSize: 14, boxSizing: "border-box", outline: "none" };
const formStyle      = { background: "white", borderRadius: 20, padding: 24, boxShadow: "0 4px 20px rgba(0,0,0,.1)", marginBottom: 28, borderTop: "5px solid #16a34a" };
const cardStyle      = { background: "white", borderRadius: 18, padding: 20, boxShadow: "0 4px 14px rgba(0,0,0,.08)", borderLeft: "5px solid #16a34a" };
const onlineBadge    = { background: "#dcfce7", color: "#16a34a", padding: "7px 14px", borderRadius: 10, fontSize: 13, fontWeight: "bold" };
const deleteBtnStyle = { background: "#fee2e2", color: "#dc2626", border: "none", padding: "7px 14px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: "bold" };
const syncBtnStyle   = (loading) => ({ background: loading ? "#86efac" : "#16a34a", color: "white", border: "none", padding: "7px 14px", borderRadius: 10, cursor: loading ? "not-allowed" : "pointer", fontSize: 13, fontWeight: "bold" });
const submitBtnStyle = (loading, isMobile) => ({ marginTop: 20, background: loading ? "#86efac" : "#16a34a", color: "white", border: "none", padding: "12px 28px", borderRadius: 12, fontWeight: "bold", cursor: loading ? "not-allowed" : "pointer", fontSize: 15, width: isMobile ? "100%" : "auto" });
