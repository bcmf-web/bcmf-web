import { useState } from "react";
import Progress from "../components/Progress.jsx";
import MissionCard from "../components/MissionCard.jsx";
import { styles } from "../styles/styles.js";
import { canManageEvent } from "../services/permissions.js";
import { skills } from "../data/InitialData.js";
import { useNotify } from "../contexts/NotifyContext.jsx";

export default function EventPage({
  event,
  currentUser,
  eventCoverage,
  onBack,
  onTakeMission,
  onCancelMission,
  onAddMission,
  onDeleteEvent,
  onDeleteMission,
  onUpdateEvent,
  onUpdateMission,
}) {
  const { toast } = useNotify();
  const manageAllowed = canManageEvent(currentUser, event);

  const [editEvent, setEditEvent] = useState({
   title: event.title,
   date: event.date,
   time: event.time,
   place: event.place,
  });

  const [newMission, setNewMission] = useState({
    name: "",
    need: 1,
    requiredSkill: "Buvette",
  });

  function submitMission() {
	onAddMission(event.id, {
	  ...newMission,
	  need: Number(newMission.need),
	});

    setNewMission({
      name: "",
      need: 1,
      requiredSkill: "Buvette",
    });
  }
  
  function submitEventUpdate() {
    onUpdateEvent(event.id, editEvent);
  }

  return (
    <>
      <button style={styles.backButton} onClick={onBack}>
        ← Retour aux événements
      </button>

      <section style={styles.hero}>
		<div style={styles.badgesContainer}>
		  {event.teamsList?.length > 0 ? (
			event.teamsList.map((team) => (
			  <span key={team.id} style={styles.teamBadge}>
				{team.name}
			  </span>
			))
		  ) : (
			<span style={styles.teamBadge}>
			  {event.team}
			</span>
		  )}
		</div>
		<h1 style={styles.eventHeroTitle}>{event.title}</h1>

		<p style={styles.eventHeroInfo}>
		  📅 {event.date} · {event.time}
		</p>

		<p style={styles.eventHeroInfo}>
		  📍 {event.place}
		</p>
        <Progress value={eventCoverage(event)} />
		{manageAllowed && (
		  <button
			onClick={() => onDeleteEvent(event.id)}
			style={styles.redButton}
		  >
			Supprimer événement
		  </button>
		)}
		
      </section>
	  {manageAllowed && (
		  <section style={styles.panel}>
			<h2>Modifier l’événement</h2>

			<input
			  value={editEvent.title}
			  onChange={(e) =>
				setEditEvent({ ...editEvent, title: e.target.value })
			  }
			  style={styles.input}
			/>

			<input
			  type="date"
			  value={editEvent.date}
			  onChange={(e) =>
				setEditEvent({ ...editEvent, date: e.target.value })
			  }
			  style={styles.input}
			/>

			<input
			  type="time"
			  value={editEvent.time}
			  onChange={(e) =>
				setEditEvent({ ...editEvent, time: e.target.value })
			  }
			  style={styles.input}
			/>

			<input
			  value={editEvent.place}
			  onChange={(e) =>
				setEditEvent({ ...editEvent, place: e.target.value })
			  }
			  style={styles.input}
			/>

			<button onClick={submitEventUpdate} style={styles.orangeButton}>
			  Enregistrer modifications
			</button>
		  </section>
		)}
      {manageAllowed && (
        <section style={styles.panel}>
          <h2>Ajouter une mission</h2>

          <input
            placeholder="Nom de la mission"
            value={newMission.name}
            onChange={(e) =>
              setNewMission({ ...newMission, name: e.target.value })
            }
            style={styles.input}
          />

          <input
            type="number"
            min="1"
            value={newMission.need}
            onChange={(e) =>
              setNewMission({ ...newMission, need: e.target.value })
            }
            style={styles.input}
          />

          <select
            value={newMission.requiredSkill}
            onChange={(e) =>
              setNewMission({
                ...newMission,
                requiredSkill: e.target.value,
              })
            }
            style={styles.input}
          >
            {skills.map((skill) => (
              <option key={skill} value={skill}>
                {skill}
              </option>
            ))}
          </select>

          <button onClick={submitMission} style={styles.orangeButton}>
            Ajouter mission
          </button>
        </section>
      )}

      <h2 style={styles.sectionTitle}>Missions</h2>

      <div style={styles.grid}>
	  {event.missions.map((mission) => (
		<MissionCard
		  key={mission.id}
		  mission={mission}
		  currentUser={currentUser}
		  onTakeMission={() => onTakeMission(event.id, mission.id)}
		  onCancelMission={() => onCancelMission(event.id, mission.id)}
		  canManage={manageAllowed}
		  onDeleteMission={() => onDeleteMission(event.id, mission.id)}
		  onUpdateMission={(updatedMission) =>
			  onUpdateMission(event.id, mission.id, updatedMission)
			}
		/>
	  ))}
	</div>
    </>
  );
}