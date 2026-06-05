import { useState, useEffect } from "react";
import Progress from "../components/Progress.jsx";
import MissionCard from "../components/MissionCard.jsx";
import { styles } from "../styles/styles.js";
import { canManageEvent } from "../services/permissions.js";
import { skills } from "../data/InitialData.js";
import { useNotify } from "../contexts/NotifyContext.jsx";
import { formatDate, formatTime, toInputDatetime } from "../utils/dateUtils.js";
import PlanningView from "../components/PlanningView.jsx";
import { supabase } from "../services/supabaseClient.js";

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
    start_datetime: toInputDatetime(event.start_datetime),
    end_datetime: toInputDatetime(event.end_datetime),
    place: event.place,
    teams: event.teamsList || [],
  });
  const [allTeams, setAllTeams] = useState([]);

  useEffect(() => {
    supabase.from("teams").select("*").eq("active", true).order("name")
      .then(({ data }) => setAllTeams(data || []));
  }, []);

  const canSeePlanning = ["admin", "referent"].includes(currentUser.role);
  const [viewMode, setViewMode] = useState("liste"); // "liste" | "planning"

  const [newMission, setNewMission] = useState({
    name: "",
    need: 1,
    requiredSkill: skills[0] || "",
    timeStart: "",
    timeEnd: "",
  });

  const hasDatetime = !!event.start_datetime;
  const isMultiDay =
    hasDatetime &&
    event.end_datetime &&
    new Date(event.start_datetime).toDateString() !==
      new Date(event.end_datetime).toDateString();

  function submitMission() {
    if (!newMission.name.trim()) {
      toast("Le nom de la mission est obligatoire.", "warning");
      return;
    }
    onAddMission(event.id, { ...newMission, need: Number(newMission.need) });
    setNewMission({ name: "", need: 1, requiredSkill: skills[0] || "", timeStart: "", timeEnd: "" });
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
              <span key={team.id} style={styles.teamBadge}>{team.name}</span>
            ))
          ) : (
            <span style={styles.teamBadge}>{event.team}</span>
          )}
        </div>

        <h1 style={styles.eventHeroTitle}>{event.title}</h1>

        {hasDatetime ? (
          isMultiDay ? (
            <>
              <p style={styles.eventHeroInfo}>
                📅 Début : {formatDate(event.start_datetime)} à {formatTime(event.start_datetime)}
              </p>
              <p style={styles.eventHeroInfo}>
                🏁 Fin : {formatDate(event.end_datetime)} à {formatTime(event.end_datetime)}
              </p>
            </>
          ) : (
            <p style={styles.eventHeroInfo}>
              📅 {formatDate(event.start_datetime)} · {formatTime(event.start_datetime)}
              {event.end_datetime && ` → ${formatTime(event.end_datetime)}`}
            </p>
          )
        ) : (
          <p style={styles.eventHeroInfo}>📅 Date à définir</p>
        )}

        <p style={styles.eventHeroInfo}>📍 {event.place || "-"}</p>

        <Progress value={eventCoverage(event)} />

        {manageAllowed && (
          <button onClick={() => onDeleteEvent(event.id)} style={styles.redButton}>
            Supprimer événement
          </button>
        )}
      </section>

      {manageAllowed && (
        <section style={styles.panel}>
          <h2>Modifier l'événement</h2>

          <input
            placeholder="Titre"
            value={editEvent.title}
            onChange={(e) => setEditEvent({ ...editEvent, title: e.target.value })}
            style={styles.input}
          />

          <label style={{ fontWeight: "bold" }}>Début</label>
          <input
            type="datetime-local"
            value={editEvent.start_datetime}
            onChange={(e) => setEditEvent({ ...editEvent, start_datetime: e.target.value })}
            style={styles.input}
          />

          <label style={{ fontWeight: "bold" }}>Fin</label>
          <input
            type="datetime-local"
            value={editEvent.end_datetime}
            min={editEvent.start_datetime}
            onChange={(e) => setEditEvent({ ...editEvent, end_datetime: e.target.value })}
            style={styles.input}
          />

          <input
            placeholder="Lieu"
            value={editEvent.place}
            onChange={(e) => setEditEvent({ ...editEvent, place: e.target.value })}
            style={styles.input}
          />

          <label style={{ fontWeight: "bold" }}>Équipes concernées</label>
          <div style={styles.checkboxGrid}>
            {allTeams.map((team) => (
              <label key={team.id} style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={editEvent.teams.some((t) => t.id === team.id)}
                  onChange={() => {
                    const already = editEvent.teams.some((t) => t.id === team.id);
                    const updated = already
                      ? editEvent.teams.filter((t) => t.id !== team.id)
                      : [...editEvent.teams, team];
                    setEditEvent({ ...editEvent, teams: updated });
                  }}
                />
                {team.name}
              </label>
            ))}
          </div>

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
            onChange={(e) => setNewMission({ ...newMission, name: e.target.value })}
            style={styles.input}
          />

          <input
            type="number"
            min="1"
            placeholder="Nombre de bénévoles"
            value={newMission.need}
            onChange={(e) => setNewMission({ ...newMission, need: e.target.value })}
            style={styles.input}
          />

          <select
            value={newMission.requiredSkill}
            onChange={(e) => setNewMission({ ...newMission, requiredSkill: e.target.value })}
            style={styles.input}
          >
            {skills.map((skill) => (
              <option key={skill} value={skill}>{skill}</option>
            ))}
          </select>

          <label style={{ fontWeight: "bold" }}>Plage horaire de la mission</label>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 13, color: "#64748b" }}>Début</label>
              <input
                type="time"
                value={newMission.timeStart}
                onChange={(e) => setNewMission({ ...newMission, timeStart: e.target.value })}
                style={styles.input}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 13, color: "#64748b" }}>Fin</label>
              <input
                type="time"
                value={newMission.timeEnd}
                onChange={(e) => setNewMission({ ...newMission, timeEnd: e.target.value })}
                style={styles.input}
              />
            </div>
          </div>

          <button onClick={submitMission} style={styles.orangeButton}>
            Ajouter mission
          </button>
        </section>
      )}

      {/* Toggle vue liste / planning */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginTop: 30 }}>
        <h2 style={{ ...styles.sectionTitle, margin: 0 }}>Missions</h2>
        {canSeePlanning && (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              style={viewMode === "liste" ? styles.orangeButton : styles.darkButton}
              onClick={() => setViewMode("liste")}
            >
              📋 Liste
            </button>
            <button
              style={viewMode === "planning" ? styles.orangeButton : styles.darkButton}
              onClick={() => setViewMode("planning")}
            >
              📅 Planning
            </button>
          </div>
        )}
      </div>

      {viewMode === "planning" && canSeePlanning ? (
        <PlanningView event={event} />
      ) : (
        <div style={styles.grid}>
          {event.missions.map((mission) => (
            <MissionCard
              key={mission.id}
              mission={mission}
              currentUser={currentUser}
              onTakeMission={(slotStart, slotEnd) => onTakeMission(event.id, mission.id, slotStart, slotEnd)}
              onCancelMission={() => onCancelMission(event.id, mission.id)}
              canManage={manageAllowed}
              onDeleteMission={() => onDeleteMission(event.id, mission.id)}
              onUpdateMission={(updated) => onUpdateMission(event.id, mission.id, updated)}
            />
          ))}
        </div>
      )}
    </>
  );
}
