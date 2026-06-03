import Progress from "./Progress.jsx";
import { styles } from "../styles/styles.js";

export default function EventCard({ event, coverage, onOpen }) {
  return (
    <div style={styles.card} onClick={() => onOpen(event.id)}>

      <div style={styles.badgesContainer}>
        {event.teamsList?.length > 0 ? (
          event.teamsList.map((team) => (
            <span
              key={team.id}
              style={styles.teamBadge}
            >
              {team.name}
            </span>
          ))
        ) : (
          <span style={styles.teamBadge}>
            {event.team}
          </span>
        )}
      </div>

		<h2 style={styles.eventTitle}>
		  {event.title}
		</h2>

		<p style={styles.eventInfo}>
		  📅 {event.date} · {event.time}
		</p>

		<p style={styles.eventInfo}>
		  📍 {event.place}
		</p>

		<p style={styles.eventInfo}>
		  👥 {event.missions.length} mission(s)
		</p>

      <Progress value={coverage} />

		<p style={styles.eventFooter}>
		  Ouvrir l'événement →
		</p>
    </div>
  );
}