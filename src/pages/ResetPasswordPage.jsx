import { useState } from "react";
import { supabase } from "../services/supabaseClient";
import { useNotify } from "../contexts/NotifyContext.jsx";

export default function ResetPasswordPage() {
  const { toast } = useNotify();
  const [password, setPassword] = useState("");

  async function updatePassword() {
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast(error.message, "error");
      return;
    }

    toast("Mot de passe modifié avec succès !", "success");
    setTimeout(() => {
      window.location.href = "/";
    }, 1500);
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

      <button onClick={updatePassword}>Enregistrer</button>
    </div>
  );
}
