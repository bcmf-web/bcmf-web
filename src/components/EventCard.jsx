import Progress from "./Progress.jsx";
import { styles } from "../styles/styles.js";

export default function EventCard({ event, coverage, onOpen }) {
  return (
    <div style={styles.card} onClick={() => onOpen(event.id)}>
      <span style={styles.badge}>{event.team}</span>
      <h2>{event.title}</h2>
      <p>📅 {event.date} · {event.time}</p>
      <p>📍 {event.place}</p>
      <p>{event.missions.length} missions</p>
      <Progress value={coverage} />
      <p style={styles.link}>Ouvrir l’événement →</p>
    </div>
  );
}