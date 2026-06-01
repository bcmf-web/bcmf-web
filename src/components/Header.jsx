import { styles } from "../styles/styles.js";
import { supabase } from "../services/supabaseClient.js";

export default function Header({ currentUser, onProfileClick }) {
  return (
    <>
      <header style={styles.header}>
        <div style={styles.brand}>
          <img src="/logo-bcmf.svg" alt="BCMF" style={styles.logo} />

          <div>
            <h1 style={styles.title}>BCMF Crew</h1>
            <p style={styles.subtitle}>Missions bénévoles par équipe</p>
          </div>
        </div>

        <div
		  style={{
			...styles.userPill,
			cursor: "pointer",
		  }}
		  onClick={onProfileClick}
		>
          <strong>{currentUser.name}</strong>
          <br />
          <small>
            {currentUser.role} · {currentUser.team || "Club"}
          </small>
        </div>
      </header>

      <button
        style={styles.darkButton}
        onClick={() => supabase.auth.signOut()}
      >
        Déconnexion
      </button>
    </>
  );
}