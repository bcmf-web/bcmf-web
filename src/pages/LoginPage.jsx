import { useState } from "react";
import { supabase } from "../services/supabaseClient.js";


export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
			name: email.split("@")[0],
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

	  alert("Compte créé. En attente de validation par le club.");
	}

  return (
    <div style={{ padding: 40, fontFamily: "Arial" }}>
      <h1>BCMF Crew</h1>
      <h2>Connexion</h2>

      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ display: "block", padding: 12, marginBottom: 10, width: 300 }}
      />

      <input
        placeholder="Mot de passe"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ display: "block", padding: 12, marginBottom: 10, width: 300 }}
      />

      <button onClick={login}>Se connecter</button>
      <button onClick={signup} style={{ marginLeft: 10 }}>
        Créer un compte
      </button>
    </div>
  );
}