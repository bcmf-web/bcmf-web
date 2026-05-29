import { styles } from "../styles/styles.js";
import { useState } from "react";

export default function MissionCard({
  mission,
  currentUser,
  onTakeMission,
  onCancelMission,
  onDeleteMission,
  canManage,
  onUpdateMission,
}) {
  const isAssigned = mission.assigned.includes(currentUser.name);
  const hasSkill = currentUser.skills.includes(mission.requiredSkill);
  const full = mission.assigned.length >= mission.need;
  const [editing, setEditing] = useState(false);

  const [editMission, setEditMission] = useState({
	  name: mission.name,
	  need: mission.need,
	  requiredSkill: mission.requiredSkill,
	});

  return (
    <div style={styles.card}>
      <h3>{mission.name}</h3>
      <p>Habilitation : <strong>{mission.requiredSkill}</strong></p>
      <p>Affectés : <strong>{mission.assigned.length}/{mission.need}</strong></p>
      <p>{mission.assigned.length ? mission.assigned.join(", ") : "Personne pour l’instant"}</p>

      {["benevole", "referent", "admin"].includes(currentUser.role) && (
        <>
          {isAssigned ? (
            <button style={styles.darkButton} onClick={onCancelMission}>
              Me désinscrire
            </button>
          ) : (
            <button
              style={!hasSkill || full ? styles.disabledButton : styles.orangeButton}
              disabled={!hasSkill || full}
              onClick={onTakeMission}
            >
              {!hasSkill ? "Non habilité" : full ? "Mission complète" : "Je me propose"}
            </button>
          )}
        </>
      )}
	  {canManage && (
		  <button
			onClick={onDeleteMission}
			style={styles.redButton}
		  >
			Supprimer mission
		  </button>
		)}
		
	  {canManage && (
		  <>
			<button
			  onClick={() => setEditing(!editing)}
			  style={styles.orangeButton}
			>
			  {editing ? "Fermer" : "Modifier mission"}
			</button>

			{editing && (
			  <div style={{ marginTop: 15 }}>
				<input
				  value={editMission.name}
				  onChange={(e) =>
					setEditMission({
					  ...editMission,
					  name: e.target.value,
					})
				  }
				  style={styles.input}
				/>

				<input
				  type="number"
				  value={editMission.need}
				  onChange={(e) =>
					setEditMission({
					  ...editMission,
					  need: e.target.value,
					})
				  }
				  style={styles.input}
				/>

				<input
				  value={editMission.requiredSkill}
				  onChange={(e) =>
					setEditMission({
					  ...editMission,
					  requiredSkill: e.target.value,
					})
				  }
				  style={styles.input}
				/>

				<button
				  onClick={() => {
					onUpdateMission(editMission);
					setEditing(false);
				  }}
				  style={styles.orangeButton}
				>
				  Sauvegarder mission
				</button>
      </div>
    )}
  </>
)}
    </div>
  );
}