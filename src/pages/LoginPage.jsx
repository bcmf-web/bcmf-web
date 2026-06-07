import { useState } from "react";
import { supabase } from "../services/supabaseClient.js";
import { useNotify } from "../contexts/NotifyContext.jsx";
import { notifyAdmins } from "../services/pushNotifications.js";

export default function LoginPage({ onLogin }) {
  const { toast } = useNotify();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showSignup, setShowSignup] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [allTeams, setAllTeams] = useState([]);
  const [selectedTeams, setSelectedTeams] = useState([]);

  async function loadTeams() {
    const { data } = await supabase.from("teams").select("*").eq("active", true).order("name");
    setAllTeams(data || []);
  }

  function toggleTeam(team) {
    setSelectedTeams((prev) =>
      prev.some((t) => t.id === team.id)
        ? prev.filter((t) => t.id !== team.id)
        : [...prev, team]
    );
  }

  async function login() {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { toast(error.message, "error"); return; }
    onLogin();
  }

  async function resetPassword() {
    if (!resetEmail.trim()) { toast("Merci de saisir votre adresse email.", "warning"); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: "https://bcmf-web.vercel.app/reset-password",
    });
    if (error) { toast(error.message, "error"); return; }
    setShowResetPassword(false);
    setResetEmail("");
    toast("Un email de réinitialisation vient de vous être envoyé.", "success");
  }

  async function signup() {
    if (!firstName.trim() || !lastName.trim() || !phone.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      toast("Merci de compléter tous les champs.", "warning");
      return;
    }
    if (selectedTeams.length === 0) {
      toast("Merci de sélectionner au moins une équipe.", "warning");
      return;
    }
    if (password !== confirmPassword) {
      toast("Les mots de passe ne correspondent pas.", "warning");
      return;
    }
    if (phone.length < 10) {
      toast("Numéro de téléphone invalide.", "warning");
      return;
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) { toast(error.message, "error"); return; }

    const authUser = data.user;
    if (authUser) {
      const { error: profileError } = await supabase.from("users").insert([{
        id: authUser.id,
        email,
        name: `${firstName} ${lastName}`,
        first_name: firstName,
        last_name: lastName,
        phone,
        role: "benevole",
        team: selectedTeams[0]?.name || null,
        status: "pending",
        skills: [],
      }]);

      if (profileError) {
        toast("Compte créé, mais erreur profil : " + profileError.message, "error");
        return;
      }

      const { error: teamsError } = await supabase.from("user_teams").insert(
        selectedTeams.map((t) => ({ user_id: authUser.id, team_id: t.id }))
      );
      if (teamsError) console.error("Erreur user_teams:", teamsError.message);
    }

    setShowSignup(false);
    setFirstName(""); setLastName(""); setPhone("");
    setEmail(""); setPassword(""); setConfirmPassword("");
    setSelectedTeams([]);

    toast("Votre compte sera créé après validation par le club.", "info");
    notifyAdmins(
      "👤 Nouveau bénévole en attente",
      `${firstName} ${lastName} vient de s'inscrire et attend votre validation.`,
      "/"
    );
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logoBox}>
          <img src="/logo-bcmf.svg" alt="BCMF" style={s.logo} />
        </div>
        <h1 style={s.title}>BCMF Crew</h1>
        <p style={s.subtitle}>Gestion des missions bénévoles du club</p>

        <div style={s.form}>
          <label style={s.label}>Email</label>
          <input placeholder="exemple@mail.com" value={email} onChange={(e) => setEmail(e.target.value)} style={s.input} />

          <label style={s.label}>Mot de passe</label>
          <input placeholder="Votre mot de passe" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={s.input} />

          <button onClick={login} style={s.primaryButton}>Se connecter</button>

          <div onClick={() => { setResetEmail(email); setShowResetPassword(true); }}
            style={{ textAlign: "center", marginTop: 12, cursor: "pointer", color: "#16a34a", fontWeight: "bold" }}>
            Mot de passe oublié ?
          </div>

          <button onClick={() => { setShowSignup(true); loadTeams(); }} style={s.secondaryButton}>
            Créer un compte
          </button>
        </div>

        <p style={s.footerText}>Votre compte devra être validé par un administrateur du club.</p>
      </div>

      {/* Modal inscription */}
      {showSignup && (
        <div style={s.modalOverlay}>
          <div style={s.modal}>
            <h2 style={s.modalTitle}>Créer un compte bénévole</h2>

            <label style={s.label}>Nom</label>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} style={s.input} />

            <label style={s.label}>Prénom</label>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} style={s.input} />

            <label style={s.label}>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} style={s.input} />

            <label style={s.label}>Téléphone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} style={s.input} />

            <label style={s.label}>Équipe(s)</label>
            <div style={s.checkboxGrid}>
              {allTeams.map((team) => (
                <label key={team.id} style={s.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={selectedTeams.some((t) => t.id === team.id)}
                    onChange={() => toggleTeam(team)}
                  />
                  {team.name}
                </label>
              ))}
              {allTeams.length === 0 && (
                <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>Chargement des équipes…</p>
              )}
            </div>

            <label style={s.label}>Mot de passe</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={s.input} />

            <label style={s.label}>Confirmer le mot de passe</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={s.input} />

            <button onClick={signup} style={s.primaryButton}>Créer mon compte</button>
            <button onClick={() => setShowSignup(false)} style={s.secondaryButton}>Annuler</button>
          </div>
        </div>
      )}

      {/* Modal mot de passe oublié */}
      {showResetPassword && (
        <div style={s.modalOverlay}>
          <div style={s.modal}>
            <h2 style={s.modalTitle}>Mot de passe oublié</h2>
            <p style={{ color: "#64748b", marginTop: 0 }}>
              Saisissez votre adresse email. Vous recevrez un lien pour choisir un nouveau mot de passe.
            </p>
            <label style={s.label}>Email</label>
            <input placeholder="exemple@mail.com" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} style={s.input} />
            <button onClick={resetPassword} style={s.primaryButton}>Réinitialiser le mot de passe</button>
            <button onClick={() => setShowResetPassword(false)} style={s.secondaryButton}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #052e16 0%, #14532d 50%, #16a34a 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    fontFamily: "Arial, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    background: "white",
    borderRadius: 28,
    padding: 35,
    boxShadow: "0 20px 50px rgba(0,0,0,.25)",
    textAlign: "center",
  },
  logoBox: { display: "flex", justifyContent: "center", marginBottom: 20 },
  logo: { width: 100, height: 100, objectFit: "contain", background: "white", borderRadius: 24, padding: 8, boxShadow: "0 6px 20px rgba(0,0,0,.12)" },
  title: { margin: 0, fontSize: 34, color: "#14532d" },
  subtitle: { marginTop: 8, marginBottom: 30, color: "#64748b", fontSize: 15 },
  form: { textAlign: "left" },
  label: { display: "block", fontWeight: "bold", color: "#334155", marginBottom: 6, marginTop: 14 },
  input: { width: "100%", boxSizing: "border-box", padding: "14px 16px", borderRadius: 14, border: "1px solid #cbd5e1", fontSize: 15, outline: "none", marginBottom: 8 },
  primaryButton: { width: "100%", marginTop: 18, background: "#16a34a", color: "white", border: "none", padding: "14px 18px", borderRadius: 14, cursor: "pointer", fontWeight: "bold", fontSize: 16 },
  secondaryButton: { width: "100%", marginTop: 10, background: "#dcfce7", color: "#14532d", border: "1px solid #86efac", padding: "14px 18px", borderRadius: 14, cursor: "pointer", fontWeight: "bold", fontSize: 16 },
  footerText: { marginTop: 22, color: "#64748b", fontSize: 13 },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 999 },
  modal: { width: "100%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto", background: "white", borderRadius: 24, padding: 30, boxShadow: "0 20px 60px rgba(0,0,0,.35)" },
  modalTitle: { marginTop: 0, color: "#14532d" },
  checkboxGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginTop: 6, marginBottom: 8 },
  checkboxLabel: { display: "flex", alignItems: "center", gap: 8, background: "#f8fafc", padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 14, cursor: "pointer" },
};
