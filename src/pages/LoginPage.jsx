import { useState } from "react";
import { supabase } from "../services/supabaseClient.js";

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showSignup, setShowSignup] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function login() {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    onLogin();
  }

  async function signup() {
	  
	if (
	  !firstName.trim() ||
	  !lastName.trim() ||
	  !phone.trim() ||
	  !email.trim() ||
	  !password.trim() ||
	  !confirmPassword.trim()
	) {
	  alert("Merci de compléter tous les champs.");
	  return;
	}
	  
	if (password !== confirmPassword) {
	  alert("Les mots de passe ne correspondent pas");
	  return;
	}

	if (!phone || phone.length < 10) {
	  alert("Numéro de téléphone invalide");
	  return;
	}
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    const authUser = data.user;

    if (authUser) {
      const { error: profileError } = await supabase.from("users").insert([
        {
          id: authUser.id,
          email: email,
          name: `${firstName} ${lastName}`,
		  first_name: firstName,
		  last_name: lastName,
		  phone: phone,
          role: "benevole",
          team: null,
          status: "pending",
          skills: [],
        },
      ]);

      if (profileError) {
        alert("Compte créé, mais erreur profil : " + profileError.message);
        return;
      }
    }
    setShowSignup(false);
	setFirstName("");
	setLastName("");
	setPhone("");
	setEmail("");
	setPassword("");
	setConfirmPassword("");
	
    alert("Votre compte sera créé aprés validation par le club.");
	
  }

  return (
    <div style={loginStyles.page}>
      <div style={loginStyles.card}>
        <div style={loginStyles.logoBox}>
          <img src="/logo-bcmf.svg" alt="BCMF" style={loginStyles.logo} />
        </div>

        <h1 style={loginStyles.title}>BCMF Crew</h1>
        <p style={loginStyles.subtitle}>
          Gestion des missions bénévoles du club
        </p>

        <div style={loginStyles.form}>
          <label style={loginStyles.label}>Email</label>
          <input
            placeholder="exemple@mail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={loginStyles.input}
          />

          <label style={loginStyles.label}>Mot de passe</label>
          <input
            placeholder="Votre mot de passe"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={loginStyles.input}
          />

          <button onClick={login} style={loginStyles.primaryButton}>
            Se connecter
          </button>

          <button
			  onClick={() => setShowSignup(true)}
			  style={loginStyles.secondaryButton}
		  >
			  Créer un compte
		  </button>
        </div>

        <p style={loginStyles.footerText}>
          Votre compte devra être validé par un administrateur du club.
        </p>
      </div>
	  {showSignup && (
		  <div style={loginStyles.modalOverlay}>
			<div style={loginStyles.modal}>
			  <h2 style={loginStyles.modalTitle}>Créer un compte bénévole</h2>

			  <label style={loginStyles.label}>Nom</label>
			  <input
				value={lastName}
				onChange={(e) => setLastName(e.target.value)}
				style={loginStyles.input}
			  />

			  <label style={loginStyles.label}>Prénom</label>
			  <input
				value={firstName}
				onChange={(e) => setFirstName(e.target.value)}
				style={loginStyles.input}
			  />

			  <label style={loginStyles.label}>Email</label>
			  <input
				value={email}
				onChange={(e) => setEmail(e.target.value)}
				style={loginStyles.input}
			  />

			  <label style={loginStyles.label}>Téléphone</label>
			  <input
				value={phone}
				onChange={(e) => setPhone(e.target.value)}
				style={loginStyles.input}
			  />

			  <label style={loginStyles.label}>Mot de passe</label>
			  <input
				type="password"
				value={password}
				onChange={(e) => setPassword(e.target.value)}
				style={loginStyles.input}
			  />

			  <label style={loginStyles.label}>Confirmer le mot de passe</label>
			  <input
				type="password"
				value={confirmPassword}
				onChange={(e) => setConfirmPassword(e.target.value)}
				style={loginStyles.input}
			  />

			  <button onClick={signup} style={loginStyles.primaryButton}>
				Créer mon compte
			  </button>

			  <button
				onClick={() => setShowSignup(false)}
				style={loginStyles.secondaryButton}
			  >
				Annuler
			  </button>
			</div>
		  </div>
		)}
    </div>
  );
}

const loginStyles = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(135deg, #052e16 0%, #14532d 50%, #16a34a 100%)",
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

  logoBox: {
    display: "flex",
    justifyContent: "center",
    marginBottom: 20,
  },

  logo: {
    width: 100,
    height: 100,
    objectFit: "contain",
    background: "white",
    borderRadius: 24,
    padding: 8,
    boxShadow: "0 6px 20px rgba(0,0,0,.12)",
  },

  title: {
    margin: 0,
    fontSize: 34,
    color: "#14532d",
  },

  subtitle: {
    marginTop: 8,
    marginBottom: 30,
    color: "#64748b",
    fontSize: 15,
  },

  form: {
    textAlign: "left",
  },

  label: {
    display: "block",
    fontWeight: "bold",
    color: "#334155",
    marginBottom: 6,
    marginTop: 14,
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "14px 16px",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    fontSize: 15,
    outline: "none",
    marginBottom: 8,
  },

  primaryButton: {
    width: "100%",
    marginTop: 18,
    background: "#16a34a",
    color: "white",
    border: "none",
    padding: "14px 18px",
    borderRadius: 14,
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: 16,
  },

  secondaryButton: {
    width: "100%",
    marginTop: 10,
    background: "#dcfce7",
    color: "#14532d",
    border: "1px solid #86efac",
    padding: "14px 18px",
    borderRadius: 14,
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: 16,
  },

  footerText: {
    marginTop: 22,
    color: "#64748b",
    fontSize: 13,
  },
  
  modalOverlay: {
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
	  width: "100%",
	  maxWidth: 460,
	  maxHeight: "90vh",
	  overflowY: "auto",
	  background: "white",
	  borderRadius: 24,
	  padding: 30,
	  boxShadow: "0 20px 60px rgba(0,0,0,.35)",
	},

	modalTitle: {
	  marginTop: 0,
	  color: "#14532d",
	},
  
};