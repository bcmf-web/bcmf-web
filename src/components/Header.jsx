import { getStyles } from "../styles/styles.js";
import { useIsMobile } from "../hooks/useIsMobile.js";
import { supabase } from "../services/supabaseClient.js";

export default function Header({ currentUser, onProfileClick, pushEnabled, onTogglePush }) {
  const styles = getStyles(useIsMobile());

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

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* Bouton notifications */}
          {onTogglePush && (
            <button
              onClick={onTogglePush}
              style={{
                background: pushEnabled ? "rgba(255,255,255,.25)" : "rgba(255,255,255,.1)",
                border: "1px solid rgba(255,255,255,.3)",
                color: "white",
                padding: "8px 14px",
                borderRadius: 999,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: "bold",
              }}
              title={pushEnabled ? "Notifications activées" : "Activer les notifications"}
            >
              {pushEnabled ? "🔔" : "🔕"}
            </button>
          )}

          {/* Profil utilisateur */}
          <div
            style={{ ...styles.userPill, cursor: "pointer" }}
            onClick={onProfileClick}
          >
            <strong>{currentUser.name}</strong>
            <br />
            <small>{currentUser.role} · {currentUser.team || "Club"}</small>
          </div>
        </div>
      </header>

      <button style={styles.darkButton} onClick={() => supabase.auth.signOut()}>
        Déconnexion
      </button>
    </>
  );
}
