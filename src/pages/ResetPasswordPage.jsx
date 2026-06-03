import { useState } from "react";
import { supabase } from "../services/supabaseClient";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");

  async function updatePassword() {
    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Mot de passe modifié avec succès");
    window.location.href = "/";
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Nouveau mot de passe</h1>

      <input
        type="password"
        placeholder="Nouveau mot de passe"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <br />
      <br />

      <button onClick={updatePassword}>
        Enregistrer
      </button>
    </div>
  );
}