
import Kpi from "../components/Kpi.jsx";
import EventCard from "../components/EventCard.jsx";
import { styles } from "../styles/styles.js";
import { useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient.js";

export default function DashboardPage({
  currentUser,
  visibleEvents,
  eventCoverage,
  onOpenEvent,
  onAddEvent,
}) {
  const [newEvent, setNewEvent] = useState({
    title: "",
    team: currentUser.team || "U11",
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
      team: currentUser.team || "U11",
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
        <Kpi label="Équipe" value={currentUser.team || "Toutes"} />
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

			<select
			  value={newEvent.team}
			  onChange={(e) =>
				setNewEvent({ ...newEvent, team: e.target.value })
			  }
			  style={styles.input}
			  disabled={currentUser.role === "referent"}
			>
			  <option value="">Choisir une équipe</option>

			  {teams.map((team) => (
				<option
				  key={team.id}
				  value={team.name}
				>
				  {team.name}
				</option>
			  ))}
			</select>

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
            placeholder="Date"
            value={newEvent.date}
            onChange={(e) =>
              setNewEvent({ ...newEvent, date: e.target.value })
            }
            style={styles.input}
          />

          <input
            placeholder="Heure"
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

      <h2 style={{ marginTop: 35 }}>Événements</h2>

      <div style={styles.grid}>
        {visibleEvents.map((event) => (
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