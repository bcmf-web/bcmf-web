import Progress from "./Progress.jsx";
import { getStyles } from "../styles/styles.js";
import { useIsMobile } from "../hooks/useIsMobile.js";
import { formatDate, formatTime } from "../utils/dateUtils.js";

export default function EventCard({ event, coverage, onOpen }) {
  const styles = getStyles(useIsMobile());
  const hasDatetime = !!event.start_datetime;
  const isMultiDay =
    hasDatetime &&
    event.end_datetime &&
    new Date(event.start_datetime).toDateString() !==
      new Date(event.end_datetime).toDateString();

  return (
    <div style={styles.card} onClick={() => onOpen(event.id)}>
      <div style={styles.badgesContainer}>
        {event.teamsList?.length > 0 ? (
          event.teamsList.map((team) => (
            <span key={team.id} style={styles.teamBadge}>
              {team.name}
            </span>
          ))
        ) : (
          <span style={styles.teamBadge}>{event.team}</span>
        )}
      </div>

      <h2 style={styles.eventTitle}>{event.title}</h2>

      {hasDatetime ? (
        isMultiDay ? (
          <>
            <p style={styles.eventInfo}>
              📅 Du {formatDate(event.start_datetime)} à {formatTime(event.start_datetime)}
            </p>
            <p style={styles.eventInfo}>
              🏁 Au {formatDate(event.end_datetime)} à {formatTime(event.end_datetime)}
            </p>
          </>
        ) : (
          <p style={styles.eventInfo}>
            📅 {formatDate(event.start_datetime)} · {formatTime(event.start_datetime)}
            {event.end_datetime && ` → ${formatTime(event.end_datetime)}`}
          </p>
        )
      ) : (
        <p style={styles.eventInfo}>📅 Date à définir</p>
      )}

      <p style={styles.eventInfo}>📍 {event.place || "-"}</p>
      <p style={styles.eventInfo}>👥 {event.missions.length} mission(s)</p>

      <Progress value={coverage} />

      <p style={styles.eventFooter}>Ouvrir l'événement →</p>
    </div>
  );
}
