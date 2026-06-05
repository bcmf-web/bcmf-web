import Kpi from "../components/Kpi.jsx";
import EventCard from "../components/EventCard.jsx";
import { styles } from "../styles/styles.js";
import { useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient.js";

const EMPTY_EVENT = {
  title: "",
  teams: [],
  team: "",
  category: "Match Amateur",
  start_datetime: "",
  end_datetime: "",
  place: "",
};

export default function DashboardPage({
  currentUser,
  visibleEvents,
  eventCoverage,
  onOpenEvent,
  onAddEvent,
}) {
  const [showPast, setShowPast] = useState(false);
  const [newEvent, setNewEvent] = useState(EMPTY_EVENT);
  const [teams, setTeams] = useState([]);

  const canCreateEvent =
    currentUser.role === "admin" || currentUser.role === "referent";

  useEffect(() => {
    loadTeams();
  }, []);

  async function loadTeams() {
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .eq("active", true)
      .order("name");
    if (!error) setTeams(data || []);
  }

  function submitEvent() {
    onAddEvent(newEvent);
    setNewEvent(EMPTY_EVENT);
  }

  // Filtre événements à venir / passés selon start_datetime
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filteredEvents = visibleEvents.filter((e) => {
    const d = e.start_datetime ? new Date(e.start_datetime) : null;
    if (!d) return !showPast; // pas de date → on affiche dans "à venir" par défaut
    return showPast ? d < today : d >= today;
  });

  return (
    <>
      <section style={styles.kpis}>
        <Kpi label="Événements visibles" value={filteredEvents.length} />
        <Kpi
          label="Missions visibles"
          value={filteredEvents.reduce((sum, e) => sum + e.missions.length, 0)}
        />
        <Kpi label="Rôle" value={currentUser.role} />
        <Kpi
          label="Équipes"
          value={
            currentUser.teamsList?.length
              ? currentUser.teamsList.map((t) => t.name).join(", ")
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
            onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
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
                    const already = newEvent.teams.some((t) => t.id === team.id);
                    const updated = already
                      ? newEvent.teams.filter((t) => t.id !== team.id)
                      : [...newEvent.teams, team];
                    setNewEvent({ ...newEvent, teams: updated, team: updated[0]?.name || "" });
                  }}
                />
                {team.name}
              </label>
            ))}
          </div>

          <select
            value={newEvent.category}
            onChange={(e) => setNewEvent({ ...newEvent, category: e.target.value })}
            style={styles.input}
          >
            <option value="Match Amateur">Match Amateur</option>
            <option value="Match Pro">Match Pro</option>
            <option value="Tournoi">Tournoi</option>
            <option value="Événement club">Événement club</option>
          </select>

          <label style={{ fontWeight: "bold" }}>Début de l'événement</label>
          <input
            type="datetime-local"
            value={newEvent.start_datetime}
            onChange={(e) => setNewEvent({ ...newEvent, start_datetime: e.target.value })}
            style={styles.input}
          />

          <label style={{ fontWeight: "bold" }}>Fin de l'événement</label>
          <input
            type="datetime-local"
            value={newEvent.end_datetime}
            min={newEvent.start_datetime}
            onChange={(e) => setNewEvent({ ...newEvent, end_datetime: e.target.value })}
            style={styles.input}
          />

          <input
            placeholder="Lieu"
            value={newEvent.place}
            onChange={(e) => setNewEvent({ ...newEvent, place: e.target.value })}
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
        {filteredEvents.map((event) => (
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
