import { styles } from "../styles/styles.js";
import { useState } from "react";
import { formatTimeSlot } from "../utils/dateUtils.js";

export default function MissionCard({
  mission,
  currentUser,
  onTakeMission,
  onCancelMission,
  onDeleteMission,
  canManage,
  onUpdateMission,
}) {
  const isAssigned = mission.assigned.some((a) => a.name === currentUser.name);
  const hasSkill = currentUser.skills.includes(mission.requiredSkill);
  const full = mission.assigned.length >= mission.need;
  const [editing, setEditing] = useState(false);
  const [showSlotPicker, setShowSlotPicker] = useState(false);
  const [slotStart, setSlotStart] = useState(mission.timeStart?.slice(0, 5) || "");
  const [slotEnd, setSlotEnd] = useState(mission.timeEnd?.slice(0, 5) || "");

  const [editMission, setEditMission] = useState({
    name: mission.name,
    need: mission.need,
    requiredSkill: mission.requiredSkill,
    timeStart: mission.timeStart?.slice(0, 5) || "",
    timeEnd: mission.timeEnd?.slice(0, 5) || "",
  });

  const hasMissionSlot = mission.timeStart && mission.timeEnd;

  function handleTakeMission() {
    if (hasMissionSlot) {
      // Afficher le sélecteur de créneau
      setShowSlotPicker(true);
    } else {
      // Pas de plage définie → inscription directe
      onTakeMission(null, null);
    }
  }

  function confirmSlot() {
    if (!slotStart || !slotEnd) {
      return;
    }
    if (slotStart >= slotEnd) {
      return;
    }
    onTakeMission(slotStart, slotEnd);
    setShowSlotPicker(false);
  }

  return (
    <div style={styles.card}>
      <h3 style={styles.missionTitle}>{mission.name}</h3>

      <p style={styles.missionInfo}>
        Habilitation : <strong>{mission.requiredSkill}</strong>
      </p>

      <p style={styles.missionInfo}>
        Affectés : <strong>{mission.assigned.length}/{mission.need}</strong>
      </p>

      {hasMissionSlot && (
        <p style={styles.missionInfo}>
          🕐 Plage disponible : <strong>{formatTimeSlot(mission.timeStart)} → {formatTimeSlot(mission.timeEnd)}</strong>
        </p>
      )}

      {/* Liste des bénévoles inscrits avec leur créneau */}
      <div style={styles.assignedList}>
        {mission.assigned.length ? (
          mission.assigned.map((a, i) => (
            <div key={i} style={{ marginBottom: 4 }}>
              👤 <strong>{a.name}</strong>
              {a.slotStart && a.slotEnd && (
                <span style={{ color: "#16a34a", marginLeft: 8, fontSize: 13 }}>
                  {formatTimeSlot(a.slotStart)} → {formatTimeSlot(a.slotEnd)}
                </span>
              )}
            </div>
          ))
        ) : (
          "Personne pour l'instant"
        )}
      </div>

      {/* Sélecteur de créneau */}
      {showSlotPicker && (
        <div style={slotPickerStyle}>
          <p style={{ margin: "0 0 10px", fontWeight: "bold", color: "#14532d" }}>
            Choisissez votre créneau
          </p>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "#64748b" }}>
            Plage disponible : {formatTimeSlot(mission.timeStart)} → {formatTimeSlot(mission.timeEnd)}
          </p>
          <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 13, display: "block", marginBottom: 4 }}>De</label>
              <input
                type="time"
                value={slotStart}
                min={mission.timeStart?.slice(0, 5)}
                max={mission.timeEnd?.slice(0, 5)}
                onChange={(e) => setSlotStart(e.target.value)}
                style={styles.input}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 13, display: "block", marginBottom: 4 }}>À</label>
              <input
                type="time"
                value={slotEnd}
                min={slotStart || mission.timeStart?.slice(0, 5)}
                max={mission.timeEnd?.slice(0, 5)}
                onChange={(e) => setSlotEnd(e.target.value)}
                style={styles.input}
              />
            </div>
          </div>
          {slotStart && slotEnd && slotStart >= slotEnd && (
            <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 8 }}>
              ⚠️ L'heure de fin doit être après l'heure de début.
            </p>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              style={(!slotStart || !slotEnd || slotStart >= slotEnd) ? styles.disabledButton : styles.orangeButton}
              disabled={!slotStart || !slotEnd || slotStart >= slotEnd}
              onClick={confirmSlot}
            >
              Confirmer mon créneau
            </button>
            <button style={styles.darkButton} onClick={() => setShowSlotPicker(false)}>
              Annuler
            </button>
          </div>
        </div>
      )}

      <div style={styles.buttonRow}>
        {["benevole", "referent", "admin"].includes(currentUser.role) && !showSlotPicker && (
          <>
            {isAssigned ? (
              <button style={styles.darkButton} onClick={onCancelMission}>
                Me désinscrire
              </button>
            ) : (
              <button
                style={!hasSkill || full ? styles.disabledButton : styles.orangeButton}
                disabled={!hasSkill || full}
                onClick={handleTakeMission}
              >
                {!hasSkill ? "Non habilité" : full ? "Mission complète" : "Je me propose"}
              </button>
            )}
          </>
        )}

        {canManage && (
          <>
            <button onClick={onDeleteMission} style={styles.redButton}>
              Supprimer
            </button>
            <button onClick={() => setEditing(!editing)} style={styles.orangeButton}>
              {editing ? "Fermer" : "Modifier"}
            </button>
          </>
        )}
      </div>

      {canManage && editing && (
        <div style={styles.editBox}>
          <input
            placeholder="Nom de la mission"
            value={editMission.name}
            onChange={(e) => setEditMission({ ...editMission, name: e.target.value })}
            style={styles.input}
          />

          <input
            type="number"
            min="1"
            value={editMission.need}
            onChange={(e) => setEditMission({ ...editMission, need: e.target.value })}
            style={styles.input}
          />

          <input
            placeholder="Habilitation"
            value={editMission.requiredSkill}
            onChange={(e) => setEditMission({ ...editMission, requiredSkill: e.target.value })}
            style={styles.input}
          />

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 13 }}>Début plage</label>
              <input
                type="time"
                value={editMission.timeStart}
                onChange={(e) => setEditMission({ ...editMission, timeStart: e.target.value })}
                style={styles.input}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 13 }}>Fin plage</label>
              <input
                type="time"
                value={editMission.timeEnd}
                onChange={(e) => setEditMission({ ...editMission, timeEnd: e.target.value })}
                style={styles.input}
              />
            </div>
          </div>

          <button
            onClick={() => {
              onUpdateMission({ ...editMission, need: Number(editMission.need) });
              setEditing(false);
            }}
            style={styles.orangeButton}
          >
            Sauvegarder
          </button>
        </div>
      )}
    </div>
  );
}

const slotPickerStyle = {
  background: "#f0fdf4",
  border: "1px solid #86efac",
  borderRadius: 14,
  padding: 16,
  marginTop: 12,
  marginBottom: 8,
};
