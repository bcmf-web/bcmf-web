import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../services/supabaseClient.js";
import { styles } from "../styles/styles.js";
import { useNotify } from "../contexts/NotifyContext.jsx";

const categories = ["Commerces", "Restauration", "Industriels", "loisirs", "BTP"];

const BUCKET = "partner-logos";

export default function PartnersPage({ currentUser, onBack }) {
  const { toast, confirm: confirmModal } = useNotify();
  const [partners, setPartners] = useState([]);
  const [activeCategory, setActiveCategory] = useState("Commerces");
  const [uploading, setUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const fileInputRef = useRef(null);

  const [newPartner, setNewPartner] = useState({
    name: "",
    category: "Commerces",
    description: "",
    website: "",
    phone: "",
    email: "",
    logo_url: "",
    active: true,
  });

  const isAdmin = currentUser.role === "admin";

  useEffect(() => {
    loadPartners();
  }, []);

  async function loadPartners() {
    const { data, error } = await supabase
      .from("partners")
      .select("*")
      .order("category", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      toast(error.message, "error");
      return;
    }

    setPartners(data || []);
  }

  function handleLogoSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast("Veuillez sélectionner une image (JPG, PNG, SVG…)", "warning");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast("L'image ne doit pas dépasser 2 Mo.", "warning");
      return;
    }

    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function uploadLogo(file) {
    const ext = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, file, { upsert: false });

    if (error) throw error;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
    return data.publicUrl;
  }

  async function addPartner() {
    if (!newPartner.name.trim()) {
      toast("Le nom du partenaire est obligatoire.", "warning");
      return;
    }

    setUploading(true);

    let logo_url = "";

    if (logoFile) {
      try {
        logo_url = await uploadLogo(logoFile);
      } catch (err) {
        toast("Erreur upload logo : " + err.message, "error");
        setUploading(false);
        return;
      }
    }

    const { data, error } = await supabase
      .from("partners")
      .insert([{ ...newPartner, logo_url }])
      .select();

    setUploading(false);

    if (error) {
      toast(error.message, "error");
      return;
    }

    setPartners((prev) => [...prev, data[0]]);
    resetForm();
    toast("Partenaire ajouté !", "success");
  }

  function resetForm() {
    setNewPartner({
      name: "",
      category: "Commerces",
      description: "",
      website: "",
      phone: "",
      email: "",
      logo_url: "",
      active: true,
    });
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function deletePartner(id) {
    const ok = await confirmModal("Supprimer ce partenaire ?");
    if (!ok) return;

    const { error } = await supabase.from("partners").delete().eq("id", id);

    if (error) {
      toast(error.message, "error");
      return;
    }

    setPartners((prev) => prev.filter((p) => p.id !== id));
    toast("Partenaire supprimé", "success");
  }

  async function toggleActive(partner) {
    const { error } = await supabase
      .from("partners")
      .update({ active: !partner.active })
      .eq("id", partner.id);

    if (error) {
      toast(error.message, "error");
      return;
    }

    setPartners((prev) =>
      prev.map((p) =>
        p.id === partner.id ? { ...p, active: !partner.active } : p
      )
    );
  }

  const visiblePartners = isAdmin ? partners : partners.filter((p) => p.active);

  return (
    <div>
      <button style={styles.backButton} onClick={onBack}>
        ← Retour
      </button>

      <section style={styles.hero}>
        <h1>Nos partenaires</h1>
        <p>Retrouvez les entreprises et commerçants qui soutiennent le BCMF.</p>
      </section>

      {isAdmin && (
        <section style={styles.panel}>
          <h2>Ajouter un partenaire</h2>

          <input
            placeholder="Nom du partenaire"
            value={newPartner.name}
            onChange={(e) => setNewPartner({ ...newPartner, name: e.target.value })}
            style={styles.input}
          />

          <select
            value={newPartner.category}
            onChange={(e) => setNewPartner({ ...newPartner, category: e.target.value })}
            style={styles.input}
          >
            {categories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>

          <input
            placeholder="Description courte"
            value={newPartner.description}
            onChange={(e) => setNewPartner({ ...newPartner, description: e.target.value })}
            style={styles.input}
          />

          <input
            placeholder="Site web https://..."
            value={newPartner.website}
            onChange={(e) => setNewPartner({ ...newPartner, website: e.target.value })}
            style={styles.input}
          />

          <input
            placeholder="Téléphone"
            value={newPartner.phone}
            onChange={(e) => setNewPartner({ ...newPartner, phone: e.target.value })}
            style={styles.input}
          />

          <input
            placeholder="Email"
            value={newPartner.email}
            onChange={(e) => setNewPartner({ ...newPartner, email: e.target.value })}
            style={styles.input}
          />

          {/* Upload logo */}
          <div>
            <label style={{ display: "block", fontWeight: "bold", marginBottom: 8 }}>
              Logo du partenaire
            </label>

            <div
              style={logoZoneStyle}
              onClick={() => fileInputRef.current?.click()}
            >
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Prévisualisation"
                  style={{ maxHeight: 100, maxWidth: "100%", objectFit: "contain" }}
                />
              ) : (
                <div style={{ color: "#64748b", textAlign: "center" }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>📁</div>
                  <div style={{ fontWeight: "bold" }}>Cliquez pour choisir une image</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>JPG, PNG, SVG — max 2 Mo</div>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleLogoSelect}
            />

            {logoPreview && (
              <button
                type="button"
                style={{ ...styles.darkButton, marginTop: 8, fontSize: 13 }}
                onClick={() => {
                  setLogoFile(null);
                  setLogoPreview(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                Supprimer le logo
              </button>
            )}
          </div>

          <button
            style={uploading ? styles.disabledButton : styles.orangeButton}
            onClick={addPartner}
            disabled={uploading}
          >
            {uploading ? "Envoi en cours…" : "Ajouter partenaire"}
          </button>
        </section>
      )}

      <section style={styles.panel}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {categories.map((category) => (
            <button
              key={category}
              style={activeCategory === category ? styles.orangeButton : styles.darkButton}
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </section>

      <section style={styles.panel}>
        <h2>{activeCategory}</h2>

        {visiblePartners.filter((p) => p.category === activeCategory).length === 0 && (
          <p>Aucun partenaire dans cette catégorie pour le moment.</p>
        )}

        <div style={styles.grid}>
          {visiblePartners
            .filter((p) => p.category === activeCategory)
            .map((partner) => (
              <div key={partner.id} style={styles.card}>
                {partner.logo_url && (
                  <img
                    src={partner.logo_url}
                    alt={partner.name}
                    style={{
                      width: "100%",
                      height: 120,
                      objectFit: "contain",
                      marginBottom: 15,
                    }}
                  />
                )}

                <h3>{partner.name}</h3>

                {partner.description && <p>{partner.description}</p>}

                {partner.website && (
                  <a
                    href={partner.website}
                    target="_blank"
                    rel="noreferrer"
                    style={styles.link}
                  >
                    Voir le site →
                  </a>
                )}

                {partner.phone && <p>📞 {partner.phone}</p>}
                {partner.email && <p>✉️ {partner.email}</p>}

                {isAdmin && (
                  <div style={{ marginTop: 15, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button style={styles.darkButton} onClick={() => toggleActive(partner)}>
                      {partner.active ? "Désactiver" : "Activer"}
                    </button>

                    <button style={styles.redButton} onClick={() => deletePartner(partner.id)}>
                      Supprimer
                    </button>
                  </div>
                )}
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}

const logoZoneStyle = {
  border: "2px dashed #d1d5db",
  borderRadius: 14,
  padding: 24,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  minHeight: 120,
  background: "#f8fafc",
  transition: "border-color 0.2s",
};
