import { useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient.js";
import { getStyles } from "../styles/styles.js";
import { useIsMobile } from "../hooks/useIsMobile.js";
import { useNotify } from "../contexts/NotifyContext.jsx";

const TEAM_CATEGORIES = ["Jeunes", "Seniors", "Loisirs", "Pro"];

export default function AdminConfigPage({ onBack }) {
  const styles = getStyles(useIsMobile());
  const { toast, confirm: confirmModal } = useNotify();
  const [tab, setTab] = useState("teams"); // "teams" | "skills"

  // ── Équipes ──────────────────────────────────────────────
  const [teams, setTeams] = useState([]);
  const [newTeam, setNewTeam] = useState({ name: "", category: "Jeunes" });
  const [editingTeam, setEditingTeam] = useState(null);

  // ── Compétences ──────────────────────────────────────────
  const [skills, setSkills] = useState([]);
  const [newSkill, setNewSkill] = useState({ name: "", description: "" });
  const [editingSkill, setEditingSkill] = useState(null);

  useEffect(() => {
    loadTeams();
    loadSkills();
  }, []);

  // ────────────────────────────────────────────────────────
  // ÉQUIPES
  // ────────────────────────────────────────────────────────
  async function loadTeams() {
    const { data, error } = await supabase
      .from("teams").select("*").order("category").order("name");
    if (error) { toast(error.message, "error"); return; }
    setTeams(data || []);
  }

  async function addTeam() {
    if (!newTeam.name.trim()) { toast("Le nom est obligatoire.", "warning"); return; }
    const { data, error } = await supabase
      .from("teams").insert([{ name: newTeam.name.trim(), category: newTeam.category, active: true }]).select();
    if (error) { toast(error.message, "error"); return; }
    setTeams((prev) => [...prev, data[0]]);
    setNewTeam({ name: "", category: "Jeunes" });
    toast("Équipe ajoutée !", "success");
  }

  async function saveTeam(team) {
    const { error } = await supabase
      .from("teams").update({ name: team.name, category: team.category }).eq("id", team.id);
    if (error) { toast(error.message, "error"); return; }
    setTeams((prev) => prev.map((t) => t.id === team.id ? { ...t, ...team } : t));
    setEditingTeam(null);
    toast("Équipe mise à jour", "success");
  }

  async function toggleTeamActive(team) {
    const { error } = await supabase
      .from("teams").update({ active: !team.active }).eq("id", team.id);
    if (error) { toast(error.message, "error"); return; }
    setTeams((prev) => prev.map((t) => t.id === team.id ? { ...t, active: !team.active } : t));
  }

  async function deleteTeam(team) {
    const ok = await confirmModal(`Supprimer l'équipe "${team.name}" ? Cette action est irréversible.`);
    if (!ok) return;
    const { error } = await supabase.from("teams").delete().eq("id", team.id);
    if (error) { toast(error.message, "error"); return; }
    setTeams((prev) => prev.filter((t) => t.id !== team.id));
    toast("Équipe supprimée", "success");
  }

  // ────────────────────────────────────────────────────────
  // COMPÉTENCES
  // ────────────────────────────────────────────────────────
  async function loadSkills() {
    const { data, error } = await supabase
      .from("skills").select("*").order("name");
    if (error) { toast(error.message, "error"); return; }
    setSkills(data || []);
  }

  async function addSkill() {
    if (!newSkill.name.trim()) { toast("Le nom est obligatoire.", "warning"); return; }
    const { data, error } = await supabase
      .from("skills").insert([{ name: newSkill.name.trim(), description: newSkill.description.trim(), active: true }]).select();
    if (error) { toast(error.message, "error"); return; }
    setSkills((prev) => [...prev, data[0]]);
    setNewSkill({ name: "", description: "" });
    toast("Compétence ajoutée !", "success");
  }

  async function saveSkill(skill) {
    const { error } = await supabase
      .from("skills").update({ name: skill.name, description: skill.description }).eq("id", skill.id);
    if (error) { toast(error.message, "error"); return; }
    setSkills((prev) => prev.map((s) => s.id === skill.id ? { ...s, ...skill } : s));
    setEditingSkill(null);
    toast("Compétence mise à jour", "success");
  }

  async function toggleSkillActive(skill) {
    const { error } = await supabase
      .from("skills").update({ active: !skill.active }).eq("id", skill.id);
    if (error) { toast(error.message, "error"); return; }
    setSkills((prev) => prev.map((s) => s.id === skill.id ? { ...s, active: !skill.active } : s));
  }

  async function deleteSkill(skill) {
    const ok = await confirmModal(`Supprimer la compétence "${skill.name}" ? Cette action est irréversible.`);
    if (!ok) return;
    const { error } = await supabase.from("skills").delete().eq("id", skill.id);
    if (error) { toast(error.message, "error"); return; }
    setSkills((prev) => prev.filter((s) => s.id !== skill.id));
    toast("Compétence supprimée", "success");
  }

  // ────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────
  return (
    <div>
      <button style={styles.backButton} onClick={onBack}>← Retour</button>
      <h1>Configuration du club</h1>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        <button
          style={tab === "teams" ? styles.orangeButton : styles.darkButton}
          onClick={() => setTab("teams")}
        >
          🏀 Équipes
        </button>
        <button
          style={tab === "skills" ? styles.orangeButton : styles.darkButton}
          onClick={() => setTab("skills")}
        >
          🎓 Compétences
        </button>
      </div>

      {/* ── ÉQUIPES ── */}
      {tab === "teams" && (
        <>
          {/* Formulaire ajout */}
          <section style={styles.panel}>
            <h2>Ajouter une équipe</h2>
            <input
              placeholder="Nom de l'équipe (ex: U13-1)"
              value={newTeam.name}
              onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
              style={styles.input}
            />
            <select
              value={newTeam.category}
              onChange={(e) => setNewTeam({ ...newTeam, category: e.target.value })}
              style={styles.input}
            >
              {TEAM_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <button style={styles.orangeButton} onClick={addTeam}>
              Ajouter
            </button>
          </section>

          {/* Liste des équipes groupées par catégorie */}
          {TEAM_CATEGORIES.map((cat) => {
            const catTeams = teams.filter((t) => t.category === cat);
            if (!catTeams.length) return null;
            return (
              <section key={cat} style={styles.panel}>
                <h2 style={{ marginTop: 0 }}>{cat}</h2>
                {catTeams.map((team) => (
                  <div key={team.id} style={rowStyle}>
                    {editingTeam?.id === team.id ? (
                      /* Mode édition */
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                        <input
                          value={editingTeam.name}
                          onChange={(e) => setEditingTeam({ ...editingTeam, name: e.target.value })}
                          style={styles.input}
                        />
                        <select
                          value={editingTeam.category}
                          onChange={(e) => setEditingTeam({ ...editingTeam, category: e.target.value })}
                          style={styles.input}
                        >
                          {TEAM_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                        </select>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button style={styles.orangeButton} onClick={() => saveTeam(editingTeam)}>
                            Enregistrer
                          </button>
                          <button style={styles.darkButton} onClick={() => setEditingTeam(null)}>
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Mode affichage */
                      <>
                        <div style={{ flex: 1 }}>
                          <strong>{team.name}</strong>
                          <span style={{ ...activeBadge(team.active), marginLeft: 10 }}>
                            {team.active ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button style={styles.orangeButton} onClick={() => setEditingTeam({ ...team })}>
                            Modifier
                          </button>
                          <button style={styles.darkButton} onClick={() => toggleTeamActive(team)}>
                            {team.active ? "Désactiver" : "Activer"}
                          </button>
                          <button style={styles.redButton} onClick={() => deleteTeam(team)}>
                            Supprimer
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </section>
            );
          })}
        </>
      )}

      {/* ── COMPÉTENCES ── */}
      {tab === "skills" && (
        <>
          {/* Formulaire ajout */}
          <section style={styles.panel}>
            <h2>Ajouter une compétence</h2>
            <input
              placeholder="Nom (ex: Chronométrage)"
              value={newSkill.name}
              onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })}
              style={styles.input}
            />
            <input
              placeholder="Description (facultatif)"
              value={newSkill.description}
              onChange={(e) => setNewSkill({ ...newSkill, description: e.target.value })}
              style={styles.input}
            />
            <button style={styles.orangeButton} onClick={addSkill}>
              Ajouter
            </button>
          </section>

          {/* Liste des compétences */}
          <section style={styles.panel}>
            <h2 style={{ marginTop: 0 }}>Toutes les compétences ({skills.length})</h2>
            {skills.map((skill) => (
              <div key={skill.id} style={rowStyle}>
                {editingSkill?.id === skill.id ? (
                  /* Mode édition */
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                    <input
                      value={editingSkill.name}
                      onChange={(e) => setEditingSkill({ ...editingSkill, name: e.target.value })}
                      style={styles.input}
                    />
                    <input
                      value={editingSkill.description}
                      onChange={(e) => setEditingSkill({ ...editingSkill, description: e.target.value })}
                      style={styles.input}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button style={styles.orangeButton} onClick={() => saveSkill(editingSkill)}>
                        Enregistrer
                      </button>
                      <button style={styles.darkButton} onClick={() => setEditingSkill(null)}>
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Mode affichage */
                  <>
                    <div style={{ flex: 1 }}>
                      <strong>{skill.name}</strong>
                      {skill.description && (
                        <span style={{ color: "#64748b", fontSize: 13, marginLeft: 10 }}>
                          {skill.description}
                        </span>
                      )}
                      <span style={{ ...activeBadge(skill.active), marginLeft: 10 }}>
                        {skill.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button style={styles.orangeButton} onClick={() => setEditingSkill({ ...skill })}>
                        Modifier
                      </button>
                      <button style={styles.darkButton} onClick={() => toggleSkillActive(skill)}>
                        {skill.active ? "Désactiver" : "Activer"}
                      </button>
                      <button style={styles.redButton} onClick={() => deleteSkill(skill)}>
                        Supprimer
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}

const rowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 0",
  borderBottom: "1px solid #f1f5f9",
  gap: 12,
  flexWrap: "wrap",
};

function activeBadge(active) {
  return {
    display: "inline-block",
    background: active ? "#dcfce7" : "#fee2e2",
    color: active ? "#16a34a" : "#dc2626",
    fontSize: 12,
    fontWeight: "bold",
    padding: "2px 8px",
    borderRadius: 999,
  };
}
