import { useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabaseClient.js";
import { styles } from "../styles/styles.js";

const categories = ["Commerces", "Restauration", "Industriels", "BTP"];

export default function PartnersPage({ currentUser, onBack }) {
  const [partners, setPartners] = useState([]);
  const [message, setMessage] = useState("");

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
      alert(error.message);
      return;
    }

    setPartners(data || []);
  }

  async function addPartner() {
    if (!newPartner.name.trim()) {
      alert("Le nom du partenaire est obligatoire.");
      return;
    }

    const { data, error } = await supabase
      .from("partners")
      .insert([newPartner])
      .select();

    if (error) {
      alert(error.message);
      return;
    }

    setPartners((prev) => [...prev, data[0]]);

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

    setMessage("✅ Partenaire ajouté");

    setTimeout(() => setMessage(""), 2000);
  }

  async function deletePartner(id) {
    if (!confirm("Supprimer ce partenaire ?")) return;

    const { error } = await supabase
      .from("partners")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    setPartners((prev) => prev.filter((p) => p.id !== id));

    setMessage("🗑️ Partenaire supprimé");

    setTimeout(() => setMessage(""), 2000);
  }

  async function toggleActive(partner) {
    const { error } = await supabase
      .from("partners")
      .update({ active: !partner.active })
      .eq("id", partner.id);

    if (error) {
      alert(error.message);
      return;
    }

    setPartners((prev) =>
      prev.map((p) =>
        p.id === partner.id ? { ...p, active: !partner.active } : p
      )
    );
  }

  const visiblePartners = isAdmin
    ? partners
    : partners.filter((p) => p.active);

  const grouped = useMemo(() => {
    return categories.map((category) => ({
      category,
      items: visiblePartners.filter((p) => p.category === category),
    }));
  }, [visiblePartners]);

  return (
    <div>
      <button style={styles.backButton} onClick={onBack}>
        ← Retour
      </button>

      <section style={styles.hero}>
        <h1>Nos partenaires</h1>
        <p>
          Retrouvez les entreprises et commerçants qui soutiennent le BCMF.
        </p>
      </section>

      {message && (
        <div
          style={{
            background: "#d4edda",
            color: "#155724",
            padding: "10px",
            borderRadius: "8px",
            marginTop: "15px",
            marginBottom: "15px",
            fontWeight: "bold",
          }}
        >
          {message}
        </div>
      )}

      {isAdmin && (
        <section style={styles.panel}>
          <h2>Ajouter un partenaire</h2>

          <input
            placeholder="Nom du partenaire"
            value={newPartner.name}
            onChange={(e) =>
              setNewPartner({ ...newPartner, name: e.target.value })
            }
            style={styles.input}
          />

          <select
            value={newPartner.category}
            onChange={(e) =>
              setNewPartner({ ...newPartner, category: e.target.value })
            }
            style={styles.input}
          >
            {categories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>

          <input
            placeholder="Description courte"
            value={newPartner.description}
            onChange={(e) =>
              setNewPartner({
                ...newPartner,
                description: e.target.value,
              })
            }
            style={styles.input}
          />

          <input
            placeholder="Site web https://..."
            value={newPartner.website}
            onChange={(e) =>
              setNewPartner({ ...newPartner, website: e.target.value })
            }
            style={styles.input}
          />

          <input
            placeholder="Téléphone"
            value={newPartner.phone}
            onChange={(e) =>
              setNewPartner({ ...newPartner, phone: e.target.value })
            }
            style={styles.input}
          />

          <input
            placeholder="Email"
            value={newPartner.email}
            onChange={(e) =>
              setNewPartner({ ...newPartner, email: e.target.value })
            }
            style={styles.input}
          />

          <input
            placeholder="URL du logo"
            value={newPartner.logo_url}
            onChange={(e) =>
              setNewPartner({ ...newPartner, logo_url: e.target.value })
            }
            style={styles.input}
          />

          <button style={styles.orangeButton} onClick={addPartner}>
            Ajouter partenaire
          </button>
        </section>
      )}

      {grouped.map((group) => (
        <section key={group.category} style={styles.panel}>
          <h2>{group.category}</h2>

          {group.items.length === 0 && (
            <p>Aucun partenaire dans cette catégorie pour le moment.</p>
          )}

          <div style={styles.grid}>
            {group.items.map((partner) => (
              <div key={partner.id} style={styles.card}>
                {!partner.active && isAdmin && (
                  <p style={{ color: "#c0392b", fontWeight: "bold" }}>
                    Inactif
                  </p>
                )}

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
                    <button
                      style={styles.darkButton}
                      onClick={() => toggleActive(partner)}
                    >
                      {partner.active ? "Désactiver" : "Activer"}
                    </button>

                    <button
                      style={styles.redButton}
                      onClick={() => deletePartner(partner.id)}
                    >
                      Supprimer
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}