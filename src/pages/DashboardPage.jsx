
import Kpi from "../components/Kpi.jsx";
import EventCard from "../components/EventCard.jsx";
import { styles } from "../styles/styles.js";
import { useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient.js";

function parseDate(dateStr) {
  if (!dateStr) return null;
  // Format DD/MM/YYYY
  if (dateStr.includes("/")) {
    const [day, month, year] = dateStr.split("/");
    return new Date(year, month - 1, day);
  }
  // Format YYYY-MM-DD
  return new Date(dateStr);
}

export default function DashboardPage({
  currentUser,
  visibleEvents,
  eventCoverage,
  onOpenEvent,
  onAddEvent,
}) {
  const [showPast, setShowPast] = useState(false);
  const [newEvent, setNewEvent] = useState({
	  title: "",
	  team: "",
	  teams: [],
	  category: "Match Amateur",
	  date: "",
	  time: "",
	  place: "",
	});

  const canCreateEvent =
    currentUser.role === "admin" || currentUser.role === "referent";
	
  const [teams, setTeams] = useState([]);
  
    useEffect(() => {
	  loadTeams();
	}, []);

  function submitEvent() {
    onAddEvent(newEvent);

	setNewEvent({
	  title: "",
	  team: "",
	  teams: [],
	  category: "Match Amateur",
	  date: "",
	  time: "",
	  place: "",
	});
  }
  
	async function loadTeams() {
	  const { data, error } = await supabase
		.from("teams")
		.select("*")
		.eq("active", true)
		.order("name");

	  if (!error) {
		setTeams(data || []);
	  }
	}  

  return (
    <>
      <section style={styles.kpis}>
        <Kpi label="Événements visibles" value={visibleEvents.length} />
        <Kpi
          label="Missions visibles"
          value={visibleEvents.reduce((sum, e) => sum + e.missions.length, 0)}
        />
        <Kpi label="Rôle" value={currentUser.role} />
		<Kpi
		  label="Équipes"
		  value={
			currentUser.teamsList?.length
			  ? currentUser.teamsList.map((team) => team.name).join(", ")
			  : "Toutes"
		  }
		/>
      </section>

      {canCreateEvent && (
        <section style={styles.panel}>
          <h2>Créer un événement</h2>

          <input
            placeholder="Nom de l'événement"
            value={newEvent.title}
            onChange={(e) =>
              setNewEvent({ ...newEvent, title: e.target.value })
            }
            style={styles.input}
          />

			<label>Équipes concernées</label>

			<div style={styles.checkboxGrid}>
			  {teams.map((team) => (
				<label key={team.id} style={styles.checkboxLabel}>
				  <input
					type="checkbox"
					checked={newEvent.teams.some((t) => t.id === team.id)}
					onChange={() => {
					  const alreadySelected = newEvent.teams.some(
						(t) => t.id === team.id
					  );

					  const updatedTeams = alreadySelected
						? newEvent.teams.filter((t) => t.id !== team.id)
						: [...newEvent.teams, team];

					  setNewEvent({
						...newEvent,
						teams: updatedTeams,
						team: updatedTeams[0]?.name || "",
					  });
					}}
				  />
				  {team.name}
				</label>
			  ))}
			</div>			

          <select
            value={newEvent.category}
            onChange={(e) =>
              setNewEvent({ ...newEvent, category: e.target.value })
            }
            style={styles.input}
          >
            <option value="Match Amateur">Match Amateur</option>
            <option value="Match Pro">Match Pro</option>
            <option value="Tournoi">Tournoi</option>
            <option value="Événement club">Événement club</option>
          </select>

          <input
            type="date"
            value={newEvent.date}
            onChange={(e) =>
              setNewEvent({ ...newEvent, date: e.target.value })
            }
            style={styles.input}
          />

          <input
            type="time"
            value={newEvent.time}
            onChange={(e) =>
              setNewEvent({ ...newEvent, time: e.target.value })
            }
            style={styles.input}
          />

          <input
            placeholder="Lieu"
            value={newEvent.place}
            onChange={(e) =>
              setNewEvent({ ...newEvent, place: e.target.value })
            }
            style={styles.input}
          />

          <button onClick={submitEvent} style={styles.orangeButton}>
            Ajouter événement
          </button>
        </section>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginTop: 35 }}>
        <h2 style={{ margin: 0 }}>Événements</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            style={!showPast ? styles.orangeButton : styles.darkButton}
            onClick={() => setShowPast(false)}
          >
            À venir
          </button>
          <button
            style={showPast ? styles.orangeButton : styles.darkButton}
            onClick={() => setShowPast(true)}
          >
            Passés
          </button>
        </div>
      </div>

      <div style={styles.grid}>
        {visibleEvents
          .filter((e) => {
            const d = parseDate(e.date);
            if (!d) return true;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return showPast ? d < today : d >= today;
          })
          .map((event) => (
            <EventCard
              key={event.id}
              event={event}
              coverage={eventCoverage(event)}
              onOpen={onOpenEvent}
            />
          ))}
      </div>
    </>
  );
}