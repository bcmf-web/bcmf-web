import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../services/supabaseClient.js";
import { getStyles } from "../styles/styles.js";
import { useIsMobile } from "../hooks/useIsMobile.js";
import { sendPushNotification } from "../services/pushNotifications.js";
import { useNotify } from "../contexts/NotifyContext.jsx";
import {
  parseVolunteersFile,
  validateVolunteers,
  downloadTemplate,
  bulkAddVolunteers,
  exportCredentialsCSV,
  isPlaceholderEmail,
} from "../services/bulkImportVolunteers.js";



const roles = ["benevole", "joueuse", "referent", "admin"];
const statuses = ["pending", "approved", "rejected"];


export default function AdminUsersPage({ currentUser, onBack }) {
  const styles = getStyles(useIsMobile());
  const { toast } = useNotify();
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState(null);
  const [page, setPage] = useState(1);
  const [teams, setTeams] = useState([]);
  const [skills, setSkills] = useState([]);
  const [showTeams, setShowTeams] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkRows, setBulkRows] = useState([]);
  const [bulkFormatError, setBulkFormatError] = useState("");
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkResults, setBulkResults] = useState(null);
  const fileInputRef = useRef(null);

  const pageSize = 50;

  useEffect(() => {
    loadUsers();
	loadTeams();
	loadSkills();
  }, []);

  async function loadUsers() {
    const { data, error } = await supabase
      .from("users")
	  .select(`
	    *,
	    user_teams (
		  team_id,
		  teams (
		    id,
		    name,
		    category
		  )
	    )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      toast(error.message, "error");
      return;
    }

    const formattedUsers = (data || []).map((user) => ({
	  ...user,
	  teamsList: user.user_teams?.map((ut) => ut.teams) || [],
	}));

	setUsers(formattedUsers);
  }

  async function updateUser(userId, updates) {
    const { error } = await supabase
      .from("users")
      .update(updates)
      .eq("id", userId);

    if (error) {
      toast(error.message, "error");
      return;
    }

    setUsers((prev) =>
      prev.map((user) =>
        user.id === userId ? { ...user, ...updates } : user
      )
    );

    setSelectedUser((prev) =>
      prev && prev.id === userId ? { ...prev, ...updates } : prev
    );

    setMessage("✅ Modifications enregistrées");
    setTimeout(() => setMessage(""), 2000);

    // Notifier le bénévole si son compte vient d'être validé
    if (updates.status === "approved") {
      const user = users.find((u) => u.id === userId);
      if (user) {
        sendPushNotification({
          userIds: [userId],
          title: "✅ Compte validé !",
          body: `Bienvenue ${user.first_name || user.name} ! Vous pouvez maintenant vous inscrire sur les missions.`,
          url: "/",
        });
      }
    }
  }
  
  async function loadTeams() {
	  const { data, error } = await supabase
		.from("teams")
		.select("*")
		.eq("active", true)
		.order("name");

	  if (!error) {
		setTeams(data || []);
	  }
	}

	async function loadSkills() {
	  const { data, error } = await supabase
		.from("skills")
		.select("*")
		.eq("active", true)
		.order("name");

	  if (!error) {
		setSkills(data || []);
	  }
	}

	function openBulkImport() {
	  setBulkRows([]);
	  setBulkFormatError("");
	  setBulkResults(null);
	  setShowBulkImport(true);
	}

	function closeBulkImport() {
	  setShowBulkImport(false);
	}

	async function handleBulkFileChange(e) {
	  const file = e.target.files?.[0];
	  if (!file) return;

	  setBulkResults(null);
	  const { volunteers, formatError } = await parseVolunteersFile(file);

	  if (formatError) {
		setBulkFormatError(formatError);
		setBulkRows([]);
		return;
	  }

	  setBulkFormatError("");
	  setBulkRows(validateVolunteers(volunteers, teams.map((t) => t.name)));
	}

	async function runBulkImport() {
	  const validRows = bulkRows.filter((r) => r.valid);
	  if (validRows.length === 0) return;

	  setBulkImporting(true);
	  try {
		const result = await bulkAddVolunteers(validRows);
		setBulkResults(result.results || []);
		await loadUsers();
		toast(`✅ ${result.added} bénévole(s) importé(s)${result.errors ? `, ${result.errors} erreur(s)` : ""}`, result.errors ? "warning" : "success");
	  } catch (err) {
		toast(err.message, "error");
	  } finally {
		setBulkImporting(false);
	  }
	}

	async function toggleTeam(user, team) {
	  const currentTeams = user.teamsList || [];
	  const alreadyLinked = currentTeams.some((t) => t.id === team.id);

	  if (alreadyLinked) {
		const { error } = await supabase
		  .from("user_teams")
		  .delete()
		  .eq("user_id", user.id)
		  .eq("team_id", team.id);

		if (error) {
		  toast(error.message, "error");
		  return;
		}

		const updatedTeams = currentTeams.filter((t) => t.id !== team.id);

		setSelectedUser({
		  ...user,
		  teamsList: updatedTeams,
		});

		setUsers((prev) =>
		  prev.map((u) =>
			u.id === user.id ? { ...u, teamsList: updatedTeams } : u
		  )
		);
	  } else {
		const { error } = await supabase.from("user_teams").insert([
		  {
			user_id: user.id,
			team_id: team.id,
		  },
		]);

		if (error) {
		  toast(error.message, "error");
		  return;
		}

		const updatedTeams = [...currentTeams, team];

		setSelectedUser({
		  ...user,
		  teamsList: updatedTeams,
		});

		setUsers((prev) =>
		  prev.map((u) =>
			u.id === user.id ? { ...u, teamsList: updatedTeams } : u
		  )
		);
	  }

	  setMessage("✅ Équipes mises à jour");

	  setTimeout(() => {
		setMessage("");
	  }, 2000);
	}
  function toggleSkill(user, skill) {
    const currentSkills = user.skills || [];

    const newSkills = currentSkills.includes(skill)
      ? currentSkills.filter((s) => s !== skill)
      : [...currentSkills, skill];

    updateUser(user.id, { skills: newSkills });
  }

  const counts = useMemo(() => {
    return {
      total: users.length,
      pending: users.filter((u) => u.status === "pending").length,
      approved: users.filter((u) => u.status === "approved").length,
      rejected: users.filter((u) => u.status === "rejected").length,
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const search = query.toLowerCase();

		const fullName =
		  `${user.first_name || ""} ${user.last_name || ""}`.toLowerCase();

		const matchesSearch =
		  fullName.includes(search) ||
		  user.email?.toLowerCase().includes(search);

      const matchesStatus =
        statusFilter === "all" || user.status === statusFilter;

		const matchesTeam =
		  teamFilter === "all" ||
		  (user.teamsList || []).some(
			(team) => team.name === teamFilter
		  );

      const matchesRole =
        roleFilter === "all" || user.role === roleFilter;

      return matchesSearch && matchesStatus && matchesTeam && matchesRole;
    });
  }, [users, query, statusFilter, teamFilter, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));

  const paginatedUsers = filteredUsers.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  if (currentUser.role !== "admin") {
    return (
      <div>
        <button style={styles.backButton} onClick={onBack}>
          ← Retour
        </button>

        <h1>Accès refusé</h1>
        <p>Cette page est réservée aux administrateurs.</p>
      </div>
    );
  }

  return (
    <div>
      <button style={styles.backButton} onClick={onBack}>
        ← Retour
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <h1>Administration des utilisateurs</h1>
        <button style={styles.orangeButton} onClick={openBulkImport}>
          ⬆️ Importer des bénévoles en masse
        </button>
      </div>

      {message && (
        <div
          style={{
            background: "#d4edda",
            color: "#155724",
            padding: "10px",
            borderRadius: "8px",
            marginBottom: "15px",
            fontWeight: "bold",
          }}
        >
          {message}
        </div>
      )}

      <section style={styles.kpis}>
        <div style={styles.kpi}>
          <p>Total</p>
          <strong>{counts.total}</strong>
        </div>

        <div style={styles.kpi}>
          <p>🟡 En attente</p>
          <strong>{counts.pending}</strong>
        </div>

        <div style={styles.kpi}>
          <p>🟢 Validés</p>
          <strong>{counts.approved}</strong>
        </div>

        <div style={styles.kpi}>
          <p>🔴 Refusés</p>
          <strong>{counts.rejected}</strong>
        </div>
      </section>

      <section style={styles.panel}>
        <h2>Filtres</h2>

        <input
          placeholder="Rechercher par nom ou email..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          style={styles.input}
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            style={styles.input}
          >
            <option value="all">Tous les statuts</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <select
            value={teamFilter}
            onChange={(e) => {
              setTeamFilter(e.target.value);
              setPage(1);
            }}
            style={styles.input}
          >
            <option value="all">Toutes les équipes</option>
            {teams.map((team) => (
			  <option key={team.id} value={team.name}>
				{team.name}
			  </option>
			))}
          </select>

          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            style={styles.input}
          >
            <option value="all">Tous les rôles</option>
            {roles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section style={styles.panel}>
        <h2>
          Utilisateurs affichés : {filteredUsers.length}
        </h2>

        <div style={styles.tableWrapper}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              background: "white",
            }}
          >
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "2px solid #eee" }}>
                <th style={thStyle}>Nom</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Statut</th>
                <th style={thStyle}>Rôle</th>
                <th style={thStyle}>Équipe</th>
                <th style={thStyle}>Habilitations</th>
                <th style={thStyle}>Action</th>
              </tr>
            </thead>

            <tbody>
              {paginatedUsers.map((user) => (
                <tr key={user.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={tdStyle}>
                    <strong>{user.name}</strong>
                  </td>

                  <td style={tdStyle}>
                    {isPlaceholderEmail(user.email) ? (
                      <span style={{ color: "#94a3b8", fontStyle: "italic" }}>Sans compte (fiche seule)</span>
                    ) : (
                      user.email
                    )}
                  </td>

                  <td style={tdStyle}>
                    <StatusBadge status={user.status} />
                  </td>

                  <td style={tdStyle}>{user.role}</td>

					<td style={tdStyle}>
					  <div style={styles.badgesContainer}>
						{user.teamsList?.length > 0 ? (
						  user.teamsList.map((team) => (
							<span key={team.id} style={styles.teamBadge}>
							  {team.name}
							</span>
						  ))
						) : (
						  "-"
						)}
					  </div>
					</td>

                  <td style={tdStyle}>
                    {(user.skills || []).length} habilitation(s)
                  </td>

                  <td style={tdStyle}>
                    <button
                      style={styles.orangeButton}
                      onClick={() => setSelectedUser(user)}
                    >
                      Modifier
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 20,
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <button
            style={styles.darkButton}
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Page précédente
          </button>

          <strong>
            Page {page} / {totalPages}
          </strong>

          <button
            style={styles.darkButton}
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Page suivante →
          </button>
        </div>
      </section>

      {selectedUser && (
		  <div style={modalStyles.overlay}>
			<div style={modalStyles.modal}>
			  <h2>Modifier utilisateur</h2>

				<div
				  style={{
					background: "#f8fafc",
					border: "1px solid #e2e8f0",
					borderRadius: 16,
					padding: 16,
					marginBottom: 20,
				  }}
				>
				  <h3 style={{ marginTop: 0 }}>👤 Identité</h3>

				  <p>
					<strong>Nom :</strong> {selectedUser.name || "-"}
				  </p>

				  <p>
					<strong>Email :</strong>{" "}
					{isPlaceholderEmail(selectedUser.email) ? (
					  <em style={{ color: "#94a3b8" }}>Sans compte (fiche ajoutée sans email)</em>
					) : (
					  selectedUser.email || "-"
					)}
				  </p>

				  <p>
					<strong>Téléphone :</strong> {selectedUser.phone || "-"}
				  </p>
				</div>

				<h3>⚙️ Gestion club</h3>

			  <label>Statut</label>
			  <select
				value={selectedUser.status}
				onChange={(e) =>
				  updateUser(selectedUser.id, { status: e.target.value })
				}
				style={styles.input}
			  >
				{statuses.map((status) => (
				  <option key={status}>{status}</option>
				))}
			  </select>

			  <label>Rôle</label>
			  <select
				value={selectedUser.role}
				onChange={(e) =>
				  updateUser(selectedUser.id, { role: e.target.value })
				}
				style={styles.input}
			  >
				{roles.map((role) => (
				  <option key={role}>{role}</option>
				))}
			  </select>

			  <label>Équipes</label>
				<div style={{ position: "relative" }}>
				  <button
					type="button"
					style={{
					  ...styles.input,
					  width: "100%",
					  textAlign: "left",
					  cursor: "pointer",
					}}
					onClick={() => setShowTeams(!showTeams)}
				  >
					Sélectionner les équipes ▼
				  </button>

				  {showTeams && (
					<div
					  style={{
						position: "absolute",
						top: "100%",
						left: 0,
						right: 0,
						background: "white",
						border: "1px solid #ddd",
						borderRadius: 12,
						padding: 10,
						maxHeight: 250,
						overflowY: "auto",
						zIndex: 9999,
						boxShadow: "0 4px 12px rgba(0,0,0,.15)",
					  }}
					>
					{teams.map((team) => (
					  <label
						key={team.id}
						style={{
						  display: "flex",
						  alignItems: "center",
						  gap: 8,
						  marginBottom: 8,
						}}
					  >
						<input
						  type="checkbox"
						  checked={(selectedUser.teamsList || []).some(
							(selectedTeam) => selectedTeam.id === team.id
						  )}
						  onChange={() => toggleTeam(selectedUser, team)}
						/>

						{team.name}
					  </label>
					))}
					</div>
				  )}
				</div>

			  <h3>Habilitations</h3>

			  <div style={styles.checkboxGrid}>
				{skills.map((skill) => (
					<label key={skill.id} style={styles.checkboxLabel}>
						<input
						  type="checkbox"
						  checked={(selectedUser.skills || []).includes(skill.name)}
						  onChange={() => toggleSkill(selectedUser, skill.name)}
						/>
						{skill.name}
					  </label>
					))}
				
			  </div>

			  <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
				<button
				  style={styles.darkButton}
				  onClick={() => setSelectedUser(null)}
				>
				  Fermer
        </button>
			</div>
          </div>
        </div>
      )}

      {showBulkImport && (
        <div style={modalStyles.overlay}>
          <div style={modalStyles.modal}>
            <h2>Importer des bénévoles en masse</h2>

            <p style={{ color: "#64748b" }}>
              Fichier Excel avec les colonnes <strong>Nom, Prénom, Email, Téléphone, Équipe(s)</strong>.
              Nom et Prénom sont obligatoires, le reste est facultatif. Les bénévoles importés sont validés directement.
              Ceux avec un email reçoivent un compte + mot de passe temporaire ; ceux sans email sont ajoutés comme
              simple fiche (sans connexion possible), à compléter plus tard si besoin.
            </p>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
              <button style={styles.darkButton} onClick={downloadTemplate}>
                📄 Télécharger le modèle
              </button>
              <button style={styles.orangeButton} onClick={() => fileInputRef.current?.click()}>
                📁 Choisir un fichier Excel
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                style={{ display: "none" }}
                onChange={handleBulkFileChange}
              />
            </div>

            {bulkFormatError && (
              <div style={{ background: "#fdecea", color: "#c0392b", padding: 12, borderRadius: 12, marginBottom: 16 }}>
                {bulkFormatError}
              </div>
            )}

            {bulkRows.length > 0 && !bulkResults && (
              <>
                <p>
                  <strong>{bulkRows.filter((r) => r.valid).length}</strong> ligne(s) valide(s) sur {bulkRows.length}.
                </p>

                <div style={{ ...styles.tableWrapper, maxHeight: 300, overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", background: "white" }}>
                    <thead>
                      <tr style={{ textAlign: "left", borderBottom: "2px solid #eee" }}>
                        <th style={thStyle}>Nom</th>
                        <th style={thStyle}>Email</th>
                        <th style={thStyle}>Téléphone</th>
                        <th style={thStyle}>Équipe(s)</th>
                        <th style={thStyle}>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkRows.map((r) => (
                        <tr key={r.rowNumber} style={{ borderBottom: "1px solid #eee" }}>
                          <td style={tdStyle}>{r.first_name} {r.last_name}</td>
                          <td style={tdStyle}>
                            {r.email || <em style={{ color: "#94a3b8" }}>sans email → fiche seule</em>}
                          </td>
                          <td style={tdStyle}>{r.phone || "-"}</td>
                          <td style={tdStyle}>{r.teams.join(", ") || "-"}</td>
                          <td style={tdStyle}>
                            {r.valid ? (
                              <span style={{ color: "#27ae60", fontWeight: "bold" }}>OK</span>
                            ) : (
                              <span style={{ color: "#c0392b" }}>{r.issues.join(" · ")}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
                  <button
                    style={bulkImporting || bulkRows.filter((r) => r.valid).length === 0 ? styles.disabledButton : styles.orangeButton}
                    disabled={bulkImporting || bulkRows.filter((r) => r.valid).length === 0}
                    onClick={runBulkImport}
                  >
                    {bulkImporting ? "Import en cours…" : `Importer ${bulkRows.filter((r) => r.valid).length} bénévole(s)`}
                  </button>
                  <button style={styles.darkButton} onClick={closeBulkImport}>
                    Annuler
                  </button>
                </div>
              </>
            )}

            {bulkResults && (
              <>
                <div style={{ background: "#d4edda", color: "#155724", padding: 12, borderRadius: 12, marginBottom: 16, fontWeight: "bold" }}>
                  ✅ {bulkResults.filter((r) => r.status === "ok").length} bénévole(s) créé(s) — {bulkResults.filter((r) => r.status === "error").length} erreur(s)
                </div>

                <div style={{ ...styles.tableWrapper, maxHeight: 300, overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", background: "white" }}>
                    <thead>
                      <tr style={{ textAlign: "left", borderBottom: "2px solid #eee" }}>
                        <th style={thStyle}>Nom</th>
                        <th style={thStyle}>Compte</th>
                        <th style={thStyle}>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkResults.map((r, i) => (
                        <tr key={`${r.email || r.name}-${i}`} style={{ borderBottom: "1px solid #eee" }}>
                          <td style={tdStyle}>{r.name}</td>
                          <td style={tdStyle}>
                            {r.has_account ? (
                              <>
                                {r.email} — mot de passe : <code>{r.temp_password}</code>
                              </>
                            ) : (
                              <em style={{ color: "#64748b" }}>Sans connexion (fiche seule)</em>
                            )}
                            {r.unmatched_teams && (
                              <div style={{ color: "#f39c12", fontSize: 12 }}>
                                Équipe(s) non trouvée(s) : {r.unmatched_teams.join(", ")}
                              </div>
                            )}
                          </td>
                          <td style={tdStyle}>
                            {r.status === "ok" ? (
                              <span style={{ color: "#27ae60", fontWeight: "bold" }}>Créé</span>
                            ) : (
                              <span style={{ color: "#c0392b" }}>{r.error}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
                  <button style={styles.darkButton} onClick={() => exportCredentialsCSV(bulkResults)}>
                    📥 Exporter les identifiants (CSV)
                  </button>
                  <button style={styles.orangeButton} onClick={closeBulkImport}>
                    Terminer
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );

 }

function StatusBadge({ status }) {
  const color =
    status === "approved"
      ? "#27ae60"
      : status === "rejected"
      ? "#c0392b"
      : "#f39c12";

  const label =
    status === "approved"
      ? "Validé"
      : status === "rejected"
      ? "Refusé"
      : "En attente";

  return (
    <span
      style={{
        background: color,
        color: "white",
        padding: "5px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: "bold",
      }}
    >
      {label}
    </span>
  );
}

const thStyle = {
  padding: "12px",
  fontSize: 14,
  color: "#555",
};

const tdStyle = {
  padding: "12px",
  verticalAlign: "middle",
};



	const modalStyles = {
	  overlay: {
		position: "fixed",
		inset: 0,
		background: "rgba(0,0,0,.55)",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		padding: 20,
		zIndex: 999,
	  },

	  modal: {
		width: "95%",
		maxWidth: 1000,
		minHeight: "80vh",
		maxHeight: "95vh",
		overflowY: "auto",
		background: "white",
		borderRadius: 24,
		padding: 30,
		boxShadow: "0 20px 60px rgba(0,0,0,.35)",
	  },
};
