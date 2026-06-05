import { formatTimeSlot } from "../utils/dateUtils.js";

// Convertit "HH:MM" ou "HH:MM:SS" en minutes depuis minuit
function toMinutes(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

// Convertit un datetime en minutes depuis minuit
function datetimeToMinutes(dt) {
  if (!dt) return null;
  const d = new Date(dt);
  return d.getHours() * 60 + d.getMinutes();
}

// Génère les heures à afficher sur la timeline
function buildHourTicks(startMin, endMin) {
  const ticks = [];
  const firstHour = Math.floor(startMin / 60);
  const lastHour = Math.ceil(endMin / 60);
  for (let h = firstHour; h <= lastHour; h++) {
    ticks.push(h);
  }
  return ticks;
}

const COLORS = [
  "#16a34a", "#2563eb", "#d97706", "#7c3aed",
  "#db2777", "#0891b2", "#65a30d", "#dc2626",
];

export default function PlanningView({ event }) {
  const eventStart = datetimeToMinutes(event.start_datetime);
  const eventEnd = datetimeToMinutes(event.end_datetime);

  if (eventStart === null || eventEnd === null) {
    return (
      <div style={msgStyle}>
        ℹ️ Définissez les horaires de début et de fin de l'événement pour afficher le planning.
      </div>
    );
  }

  const totalMin = eventEnd - eventStart;
  if (totalMin <= 0) {
    return (
      <div style={msgStyle}>
        ⚠️ L'heure de fin doit être après l'heure de début.
      </div>
    );
  }

  const ticks = buildHourTicks(eventStart, eventEnd);

  // % position et largeur depuis des minutes absolues
  function pct(min) {
    return ((min - eventStart) / totalMin) * 100;
  }

  const missionsWithSlots = event.missions.filter(
    (m) => m.timeStart && m.timeEnd
  );
  const missionsNoSlot = event.missions.filter(
    (m) => !m.timeStart || !m.timeEnd
  );

  return (
    <div style={containerStyle}>
      <h3 style={{ margin: "0 0 20px", color: "#14532d" }}>Vue planning</h3>

      {/* Règle horaire */}
      <div style={rulerWrapStyle}>
        <div style={labelColStyle} /> {/* espace pour les labels */}
        <div style={timelineColStyle}>
          <div style={rulerStyle}>
            {ticks.map((h) => {
              const posMin = h * 60;
              const pos = pct(posMin);
              if (pos < 0 || pos > 100) return null;
              return (
                <div
                  key={h}
                  style={{ ...tickStyle, left: `${pos}%` }}
                >
                  <span style={tickLabelStyle}>{String(h).padStart(2, "0")}:00</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Lignes de mission avec créneau */}
      {missionsWithSlots.map((mission, mIdx) => {
        const mStart = toMinutes(mission.timeStart);
        const mEnd = toMinutes(mission.timeEnd);
        const mLeft = pct(mStart);
        const mWidth = pct(mEnd) - mLeft;

        return (
          <div key={mission.id} style={rowStyle(mIdx)}>
            {/* Label mission */}
            <div style={labelColStyle}>
              <div style={missionLabelStyle}>
                <strong style={{ fontSize: 13 }}>{mission.name}</strong>
                <span style={skillBadgeStyle}>{mission.requiredSkill}</span>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  {mission.assigned.length}/{mission.need}
                </span>
              </div>
            </div>

            {/* Timeline */}
            <div style={timelineColStyle}>
              <div style={trackStyle}>
                {/* Barre de disponibilité de la mission */}
                <div
                  style={{
                    ...missionBarStyle,
                    left: `${Math.max(0, mLeft)}%`,
                    width: `${Math.min(100 - Math.max(0, mLeft), mWidth)}%`,
                  }}
                  title={`${formatTimeSlot(mission.timeStart)} → ${formatTimeSlot(mission.timeEnd)}`}
                />

                {/* Créneaux des bénévoles */}
                {mission.assigned.map((a, aIdx) => {
                  if (!a.slotStart || !a.slotEnd) return null;
                  const sStart = toMinutes(a.slotStart);
                  const sEnd = toMinutes(a.slotEnd);
                  const sLeft = pct(sStart);
                  const sWidth = pct(sEnd) - sLeft;
                  const color = COLORS[aIdx % COLORS.length];

                  return (
                    <div
                      key={aIdx}
                      style={{
                        ...slotBarStyle,
                        left: `${Math.max(0, sLeft)}%`,
                        width: `${Math.min(100 - Math.max(0, sLeft), sWidth)}%`,
                        background: color,
                        top: `${28 + aIdx * 26}px`,
                      }}
                      title={`${a.name} · ${formatTimeSlot(a.slotStart)} → ${formatTimeSlot(a.slotEnd)}`}
                    >
                      <span style={slotNameStyle}>
                        {a.name} · {formatTimeSlot(a.slotStart)}→{formatTimeSlot(a.slotEnd)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}

      {/* Missions sans créneau */}
      {missionsNoSlot.length > 0 && (
        <div style={{ marginTop: 20, padding: "12px 16px", background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0" }}>
          <p style={{ margin: "0 0 8px", fontWeight: "bold", fontSize: 14, color: "#64748b" }}>
            Missions sans plage horaire définie :
          </p>
          {missionsNoSlot.map((m) => (
            <div key={m.id} style={{ fontSize: 14, padding: "4px 0" }}>
              • <strong>{m.name}</strong> — {m.assigned.length}/{m.need} bénévole(s)
            </div>
          ))}
        </div>
      )}

      {/* Légende */}
      {missionsWithSlots.some((m) => m.assigned.length > 0) && (
        <div style={{ marginTop: 16, fontSize: 12, color: "#64748b" }}>
          <strong>Légende :</strong> barre verte = plage disponible · barres colorées = créneaux des bénévoles
        </div>
      )}
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const LABEL_WIDTH = 160;

const containerStyle = {
  background: "white",
  borderRadius: 20,
  padding: 24,
  boxShadow: "0 4px 12px rgba(0,0,0,.08)",
  marginTop: 25,
  overflowX: "auto",
};

const msgStyle = {
  background: "#f8fafc",
  borderRadius: 14,
  padding: 20,
  color: "#64748b",
  marginTop: 20,
  textAlign: "center",
};

const rulerWrapStyle = {
  display: "flex",
  alignItems: "flex-end",
  marginBottom: 8,
};

const labelColStyle = {
  width: LABEL_WIDTH,
  flexShrink: 0,
  paddingRight: 12,
};

const timelineColStyle = {
  flex: 1,
  minWidth: 400,
  position: "relative",
};

const rulerStyle = {
  position: "relative",
  height: 24,
  borderBottom: "2px solid #e2e8f0",
};

const tickStyle = {
  position: "absolute",
  transform: "translateX(-50%)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
};

const tickLabelStyle = {
  fontSize: 11,
  color: "#94a3b8",
  fontWeight: "bold",
  whiteSpace: "nowrap",
};

function rowStyle(idx) {
  return {
    display: "flex",
    alignItems: "flex-start",
    marginBottom: 12,
    background: idx % 2 === 0 ? "#f8fafc" : "white",
    borderRadius: 10,
    padding: "10px 0",
  };
}

const missionLabelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 3,
  paddingRight: 12,
};

const skillBadgeStyle = {
  display: "inline-block",
  background: "#16a34a",
  color: "white",
  fontSize: 11,
  padding: "2px 8px",
  borderRadius: 999,
  fontWeight: "bold",
};

const trackStyle = {
  position: "relative",
  height: 24,
  background: "#f1f5f9",
  borderRadius: 8,
  marginTop: 4,
};

const missionBarStyle = {
  position: "absolute",
  top: 0,
  height: "100%",
  background: "#bbf7d0",
  borderRadius: 8,
  border: "1px solid #86efac",
};

const slotBarStyle = {
  position: "absolute",
  height: 22,
  borderRadius: 6,
  display: "flex",
  alignItems: "center",
  overflow: "hidden",
  cursor: "default",
};

const slotNameStyle = {
  color: "white",
  fontSize: 11,
  fontWeight: "bold",
  paddingLeft: 6,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};
