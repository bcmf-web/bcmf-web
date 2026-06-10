import { formatTimeSlot } from "../utils/dateUtils.js";

// Convertit un datetime ISO en minutes absolues (depuis l'epoch)
function dtToAbsMin(dt) {
  if (!dt) return null;
  return Math.round(new Date(dt).getTime() / 60000);
}

// Convertit "HH:MM" ou "HH:MM:SS" en minutes absolues, ancré sur l'événement.
// Si le temps calculé est plus de 12h avant le début → passage minuit (+24h).
function timeStrToAbsMin(timeStr, eventStartAbsMin) {
  if (!timeStr || eventStartAbsMin == null) return null;
  const [h, m] = timeStr.split(":").map(Number);
  const refMs = eventStartAbsMin * 60000;
  const d = new Date(refMs);
  d.setHours(h, m, 0, 0);
  let absMin = Math.round(d.getTime() / 60000);
  // Si le créneau est plus de 12h avant le début de l'événement → lendemain
  if (absMin < eventStartAbsMin - 12 * 60) absMin += 24 * 60;
  return absMin;
}

// Génère les graduations horaires (ticks) entre deux minutes absolues
function buildHourTicks(startAbsMin, endAbsMin) {
  const ticks = [];
  const firstHour = Math.floor(startAbsMin / 60);
  const lastHour  = Math.ceil(endAbsMin / 60);
  for (let h = firstHour; h <= lastHour; h++) {
    const absMin  = h * 60;
    const wallHour = ((h % 24) + 24) % 24; // gère le passage minuit
    ticks.push({ absMin, label: `${String(wallHour).padStart(2, "0")}:00` });
  }
  return ticks;
}

// Calcule la couverture temporelle réelle d'une mission (minute par minute)
function getMissionCoverage(mission, eventStartAbsMin) {
  const mStart = timeStrToAbsMin(mission.timeStart, eventStartAbsMin);
  const mEnd   = timeStrToAbsMin(mission.timeEnd, eventStartAbsMin);

  if (mStart === null || mEnd === null || mEnd <= mStart) {
    if (mission.need === 0) return 100;
    return Math.min(100, Math.round((mission.assigned.length / mission.need) * 100));
  }

  const duration = mEnd - mStart;
  let coveredMinutes = 0;

  for (let t = mStart; t < mEnd; t++) {
    let count = 0;
    for (const a of mission.assigned) {
      if (!a.slotStart || !a.slotEnd) continue;
      const sStart = timeStrToAbsMin(a.slotStart, eventStartAbsMin);
      const sEnd   = timeStrToAbsMin(a.slotEnd, eventStartAbsMin);
      if (t >= sStart && t < sEnd) count++;
    }
    if (count >= mission.need) coveredMinutes++;
  }

  return Math.round((coveredMinutes / duration) * 100);
}

const COLORS = [
  "#16a34a", "#2563eb", "#d97706", "#7c3aed",
  "#db2777", "#0891b2", "#65a30d", "#dc2626",
];

export default function PlanningView({ event }) {
  const eventStartAbsMin = dtToAbsMin(event.start_datetime);
  const eventEndAbsMin   = dtToAbsMin(event.end_datetime);

  if (eventStartAbsMin === null || eventEndAbsMin === null) {
    return (
      <div style={msgStyle}>
        ℹ️ Définissez les horaires de début et de fin de l'événement pour afficher le planning.
      </div>
    );
  }

  const totalMin = eventEndAbsMin - eventStartAbsMin;
  if (totalMin <= 0) {
    return (
      <div style={msgStyle}>
        ⚠️ L'heure de fin doit être après l'heure de début.
      </div>
    );
  }

  const ticks = buildHourTicks(eventStartAbsMin, eventEndAbsMin);

  // % de position sur la timeline depuis des minutes absolues
  function pct(absMin) {
    return ((absMin - eventStartAbsMin) / totalMin) * 100;
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
        <div style={labelColStyle} />
        <div style={timelineColStyle}>
          <div style={rulerStyle}>
            {ticks.map(({ absMin, label }) => {
              const pos = pct(absMin);
              if (pos < 0 || pos > 100) return null;
              return (
                <div key={absMin} style={{ ...tickStyle, left: `${pos}%` }}>
                  <span style={tickLabelStyle}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Lignes de mission avec créneau */}
      {missionsWithSlots.map((mission, mIdx) => {
        const mStart  = timeStrToAbsMin(mission.timeStart, eventStartAbsMin);
        const mEnd    = timeStrToAbsMin(mission.timeEnd, eventStartAbsMin);
        const mLeft   = pct(mStart);
        const mWidth  = pct(mEnd) - mLeft;

        const coverage = getMissionCoverage(mission, eventStartAbsMin);
        const barColor =
          coverage === 100
            ? { bg: "#bbf7d0", border: "#86efac", text: "#14532d" }
            : coverage > 0
            ? { bg: "#fef3c7", border: "#fbbf24", text: "#92400e" }
            : { bg: "#fecaca", border: "#f87171", text: "#991b1b" };

        return (
          <div key={mission.id} style={rowStyle(mIdx)}>
            {/* Label mission */}
            <div style={labelColStyle}>
              <div style={missionLabelStyle}>
                <strong style={{ fontSize: 13 }}>{mission.name}</strong>
                <span style={skillBadgeStyle}>{mission.requiredSkill}</span>
                <span style={{
                  fontSize: 12,
                  color: coverage === 100 ? "#16a34a" : coverage > 0 ? "#d97706" : "#dc2626",
                  fontWeight: "bold"
                }}>
                  {mission.assigned.length}/{mission.need} · {coverage}%
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
                    background: barColor.bg,
                    border: `1px solid ${barColor.border}`,
                    display: "flex",
                    alignItems: "center",
                    paddingLeft: 8,
                    overflow: "hidden",
                  }}
                  title={`${mission.name} · ${formatTimeSlot(mission.timeStart)} → ${formatTimeSlot(mission.timeEnd)} · ${coverage}% couvert`}
                >
                  <span style={{ fontSize: 11, fontWeight: "bold", color: barColor.text, whiteSpace: "nowrap" }}>
                    {mission.name}
                  </span>
                </div>

                {/* Créneaux des bénévoles */}
                {mission.assigned.map((a, aIdx) => {
                  if (!a.slotStart || !a.slotEnd) return null;
                  const sStart = timeStrToAbsMin(a.slotStart, eventStartAbsMin);
                  const sEnd   = timeStrToAbsMin(a.slotEnd, eventStartAbsMin);
                  const sLeft  = pct(sStart);
                  const sWidth = pct(sEnd) - sLeft;
                  const color  = COLORS[aIdx % COLORS.length];

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
