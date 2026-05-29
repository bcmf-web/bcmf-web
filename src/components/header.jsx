import { users } from "../data/initialData.js";
import { styles } from "../styles/styles.js";

export default function Header({ currentUser, currentUserId, setCurrentUserId }) {
  return (
    <header style={styles.header}>
      <div style={styles.brand}>
        <img src="/logo-bcmf.svg" alt="BCMF" style={styles.logo} />
        <div>
          <h1 style={styles.title}>BCMF Crew</h1>
          <p style={styles.subtitle}>Missions bénévoles par équipe</p>
        </div>
      </div>

      <select
        value={currentUserId}
        onChange={(e) => setCurrentUserId(e.target.value)}
        style={styles.select}
      >
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name} — {user.role}
          </option>
        ))}
      </select>

      <div style={styles.userPill}>
        {currentUser.role} · {currentUser.team || "club"}
      </div>
    </header>
  );
}