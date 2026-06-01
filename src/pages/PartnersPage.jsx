import { useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabaseClient.js";
import { styles } from "../styles/styles.js";

const categories = ["Commerces", "Restauration", "Industriels", "BTP"];

export default function PartnersPage({ currentUser, onBack }) {
  const [partners, setPartners] = useState([]);

  useEffect(() => {
    loadPartners();
  }, []);

  async function loadPartners() {
    const { data, error } = await supabase
      .from("partners")
      .select("*")
      .eq("active", true)
      .order("category", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setPartners(data || []);
  }

  const grouped = useMemo(() => {
    return categories.map((category) => ({
      category,
      items: partners.filter((p) => p.category === category),
    }));
  }, [partners]);

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

      {grouped.map((group) => (
        <section key={group.category} style={styles.panel}>
          <h2>{group.category}</h2>

          {group.items.length === 0 && (
            <p>Aucun partenaire dans cette catégorie pour le moment.</p>
          )}

          <div style={styles.grid}>
            {group.items.map((partner) => (
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
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}