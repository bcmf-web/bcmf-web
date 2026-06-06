import React, { useEffect, useState } from "react";
import AdminUsersPage from "./pages/AdminUsersPage.jsx";
import AdminConfigPage from "./pages/AdminConfigPage.jsx";
import { supabase } from "./services/supabaseClient.js";
import Header from "./components/Header.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import EventPage from "./pages/EventPage.jsx";
import { styles } from "./styles/styles.js";
import LoginPage from "./pages/LoginPage.jsx";
import PartnersPage from "./pages/PartnersPage.jsx";
import ResetPasswordPage from "./pages/ResetPasswordPage.jsx";
import { useNotify } from "./contexts/NotifyContext.jsx";
import { getStyles } from "./styles/styles.js";
import { useIsMobile } from "./hooks/useIsMobile.js";

export default function App() {
  const styles = getStyles(useIsMobile());
  const { toast, confirm: confirmModal } = useNotify();

  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [showProfile, setShowProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
  });

  if (window.location.pathname === "/reset-password") {
    return <ResetPasswordPage />;
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    async function loadProfile() {
      if (!session?.user?.id) return;

      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (error) {
        console.error("Erreur profil:", error);
        return;
      }

      setProfile(data);
    }

    loadProfile();
  }, [session]);

  useEffect(() => {
    if (profile) {
      setProfileForm({
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        phone: profile.phone || "",
      });
    }
  }, [profile]);

  useEffect(() => {
    async function loadEvents() {
      const { data, error } = await supabase
        .from("events")
        .select(`
          *,
          event_teams (
            teams (
              id,
              name
            )
          ),
          missions (
            id,
            name,
            need,
            required_skill,
            time_start,
            time_end,
            assignments (
              id,
              user_name,
              slot_start,
              slot_end
            )
          )
        `)
        .order("date", { ascending: true });

      if (error) {
        toast("Erreur de chargement des événements : " + error.message, "error");
        return;
      }

      const formatted = data.map((event) => ({
        ...event,
        teamsList: event.event_teams?.map((et) => et.teams) || [],
        missions: event.missions.map((mission) => ({
          id: mission.id,
          name: mission.name,
          need: mission.need,
          requiredSkill: mission.required_skill,
          timeStart: mission.time_start,
          timeEnd: mission.time_end,
          assigned: mission.assignments.map((a) => ({
            name: a.user_name,
            slotStart: a.slot_start,
            slotEnd: a.slot_end,
          })),
        })),
      }));

      setEvents(formatted);
    }

    loadEvents();
  }, []);

  const currentUser = profile;
  const selectedEvent = events.find((e) => e.id === selectedEventId);

  function eventCoverage(event) {
    const total = event.missions.reduce((sum, m) => sum + m.need, 0);
    const assigned = event.missions.reduce((sum, m) => sum + m.assigned.length, 0);
    return total === 0 ? 0 : Math.round((assigned / total) * 100);
  }

  async function addEvent(newEvent) {
    if (!newEvent.teams || newEvent.teams.length === 0) {
      toast("Merci de sélectionner au moins une équipe.", "warning");
      return;
    }

    const firstTeam = newEvent.teams[0];

    const { data, error } = await supabase
      .from("events")
      .insert([
        {
          title: newEvent.title,
          team: firstTeam.name,
          category: newEvent.category,
          start_datetime: newEvent.start_datetime || null,
          end_datetime: newEvent.end_datetime || null,
          place: newEvent.place,
        },
      ])
      .select();

    if (error) {
      toast(error.message, "error");
      return;
    }

    const createdEvent = {
      ...data[0],
      teamsList: newEvent.teams,
      missions: [],
    };

    const eventTeams = newEvent.teams.map((team) => ({
      event_id: data[0].id,
      team_id: team.id,
    }));

    const { error: teamsError } = await supabase
      .from("event_teams")
      .insert(eventTeams);

    if (teamsError) {
      toast(teamsError.message, "error");
      return;
    }

    setEvents((prev) => [...prev, createdEvent]);
    toast("Événement créé avec succès !", "success");
  }

  async function updateEvent(eventId, updatedEvent) {
    // 1. Mise à jour des champs de l'événement
    const { error } = await supabase
      .from("events")
      .update({
        title: updatedEvent.title,
        start_datetime: updatedEvent.start_datetime || null,
        end_datetime: updatedEvent.end_datetime || null,
        place: updatedEvent.place,
        team: updatedEvent.teams?.[0]?.name || null,
      })
      .eq("id", eventId);

    if (error) {
      toast(error.message, "error");
      return;
    }

    // 2. Mise à jour des équipes si fournies
    if (updatedEvent.teams) {
      // Supprimer les anciennes liaisons
      const { error: delError } = await supabase
        .from("event_teams")
        .delete()
        .eq("event_id", eventId);

      if (delError) {
        toast(delError.message, "error");
        return;
      }

      // Insérer les nouvelles
      if (updatedEvent.teams.length > 0) {
        const { error: insError } = await supabase
          .from("event_teams")
          .insert(updatedEvent.teams.map((t) => ({ event_id: eventId, team_id: t.id })));

        if (insError) {
          toast(insError.message, "error");
          return;
        }
      }
    }

    setEvents((prev) =>
      prev.map((event) => {
        if (event.id !== eventId) return event;
        return {
          ...event,
          title: updatedEvent.title,
          start_datetime: updatedEvent.start_datetime,
          end_datetime: updatedEvent.end_datetime,
          place: updatedEvent.place,
          teamsList: updatedEvent.teams || event.teamsList,
          team: updatedEvent.teams?.[0]?.name || event.team,
        };
      })
    );
    toast("Événement mis à jour", "success");
  }

  async function updateMyProfile() {
    const { error } = await supabase
      .from("users")
      .update({
        first_name: profileForm.first_name,
        last_name: profileForm.last_name,
        name: `${profileForm.first_name} ${profileForm.last_name}`,
        phone: profileForm.phone,
      })
      .eq("id", currentUser.id);

    if (error) {
      toast(error.message, "error");
      return;
    }

    const { data, error: reloadError } = await supabase
      .from("users")
      .select("*")
      .eq("id", currentUser.id)
      .single();

    if (reloadError) {
      toast(reloadError.message, "error");
      return;
    }

    setProfile(data);
    setShowProfile(false);
    toast("Profil mis à jour", "success");
  }

  async function addMissionToEvent(eventId, newMission) {
    const { data, error } = await supabase
      .from("missions")
      .insert([
        {
          event_id: eventId,
          name: newMission.name,
          need: Number(newMission.need),
          required_skill: newMission.requiredSkill,
          time_start: newMission.timeStart || null,
          time_end: newMission.timeEnd || null,
        },
      ])
      .select();

    if (error) {
      toast(error.message, "error");
      return;
    }

    const createdMission = {
      id: data[0].id,
      name: data[0].name,
      need: data[0].need,
      requiredSkill: data[0].required_skill,
      timeStart: data[0].time_start,
      timeEnd: data[0].time_end,
      assigned: [],
    };

    setEvents((prev) =>
      prev.map((event) =>
        event.id === eventId
          ? { ...event, missions: [...event.missions, createdMission] }
          : event
      )
    );
    toast("Mission ajoutée", "success");
  }

  async function deleteEvent(eventId) {
    const ok = await confirmModal("Supprimer cet événement ?");
    if (!ok) return;

    const { error } = await supabase
      .from("events")
      .delete()
      .eq("id", eventId);

    if (error) {
      toast(error.message, "error");
      return;
    }

    setEvents((prev) => prev.filter((event) => event.id !== eventId));
    setSelectedEventId(null);
    toast("Événement supprimé", "success");
  }

  async function deleteMission(eventId, missionId) {
    const ok = await confirmModal("Supprimer cette mission ?");
    if (!ok) return;

    const { error } = await supabase
      .from("missions")
      .delete()
      .eq("id", missionId);

    if (error) {
      toast(error.message, "error");
      return;
    }

    setEvents((prev) =>
      prev.map((event) => {
        if (event.id !== eventId) return event;
        return {
          ...event,
          missions: event.missions.filter((mission) => mission.id !== missionId),
        };
      })
    );
    toast("Mission supprimée", "success");
  }

  async function updateMission(eventId, missionId, updatedMission) {
    const { error } = await supabase
      .from("missions")
      .update({
        name: updatedMission.name,
        need: Number(updatedMission.need),
        required_skill: updatedMission.requiredSkill,
        time_start: updatedMission.timeStart || null,
        time_end: updatedMission.timeEnd || null,
      })
      .eq("id", missionId);

    if (error) {
      toast(error.message, "error");
      return;
    }

    setEvents((prev) =>
      prev.map((event) => {
        if (event.id !== eventId) return event;
        return {
          ...event,
          missions: event.missions.map((mission) => {
            if (mission.id !== missionId) return mission;
            return {
              ...mission,
              name: updatedMission.name,
              need: Number(updatedMission.need),
              requiredSkill: updatedMission.requiredSkill,
              timeStart: updatedMission.timeStart,
              timeEnd: updatedMission.timeEnd,
            };
          }),
        };
      })
    );
    toast("Mission mise à jour", "success");
  }

  async function takeMission(eventId, missionId, slotStart, slotEnd) {
    if (currentUser.status !== "approved") {
      toast("Ton compte n'est pas encore validé.", "warning");
      return;
    }

    const event = events.find((e) => e.id === eventId);
    const mission = event.missions.find((m) => m.id === missionId);

    if (!currentUser.skills.includes(mission.requiredSkill)) {
      toast("Habilitation requise : " + mission.requiredSkill, "warning");
      return;
    }

    if (mission.assigned.some((a) => a.name === currentUser.name)) {
      toast("Tu es déjà inscrit sur cette mission.", "info");
      return;
    }

    if (mission.assigned.length >= mission.need) {
      toast("Mission complète.", "info");
      return;
    }

    const { error } = await supabase
      .from("assignments")
      .insert([{
        mission_id: missionId,
        user_name: currentUser.name,
        slot_start: slotStart || null,
        slot_end: slotEnd || null,
      }]);

    if (error) {
      toast(error.message, "error");
      return;
    }

    setEvents((prev) =>
      prev.map((event) => {
        if (event.id !== eventId) return event;
        return {
          ...event,
          missions: event.missions.map((mission) => {
            if (mission.id !== missionId) return mission;
            return {
              ...mission,
              assigned: [...mission.assigned, {
                name: currentUser.name,
                slotStart,
                slotEnd,
              }],
            };
          }),
        };
      })
    );
    toast("Inscription confirmée !", "success");
  }

  async function cancelMission(eventId, missionId) {
    const { error } = await supabase
      .from("assignments")
      .delete()
      .eq("mission_id", missionId)
      .eq("user_name", currentUser.name);

    if (error) {
      toast(error.message, "error");
      return;
    }

    setEvents((prev) =>
      prev.map((event) => {
        if (event.id !== eventId) return event;
        return {
          ...event,
          missions: event.missions.map((mission) => {
            if (mission.id !== missionId) return mission;
            return {
              ...mission,
              assigned: mission.assigned.filter((a) => a.name !== currentUser.name),
            };
          }),
        };
      })
    );
    toast("Désinscription effectuée", "success");
  }

  // Admin inscrit un bénévole sur une mission
  async function adminAssignMission(eventId, missionId, userName, slotStart, slotEnd) {
    const event = events.find((e) => e.id === eventId);
    const mission = event.missions.find((m) => m.id === missionId);

    if (mission.assigned.some((a) => a.name === userName)) {
      toast(`${userName} est déjà inscrit sur cette mission.`, "info");
      return;
    }

    if (mission.assigned.length >= mission.need) {
      toast("Mission complète.", "info");
      return;
    }

    const { error } = await supabase
      .from("assignments")
      .insert([{
        mission_id: missionId,
        user_name: userName,
        slot_start: slotStart || null,
        slot_end: slotEnd || null,
      }]);

    if (error) {
      toast(error.message, "error");
      return;
    }

    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== eventId) return e;
        return {
          ...e,
          missions: e.missions.map((m) => {
            if (m.id !== missionId) return m;
            return {
              ...m,
              assigned: [...m.assigned, { name: userName, slotStart, slotEnd }],
            };
          }),
        };
      })
    );
    toast(`${userName} inscrit sur la mission !`, "success");
  }

  // Admin désinscrit n'importe quel bénévole d'une mission
  async function adminUnassignMission(eventId, missionId, userName) {
    const { error } = await supabase
      .from("assignments")
      .delete()
      .eq("mission_id", missionId)
      .eq("user_name", userName);

    if (error) {
      toast(error.message, "error");
      return;
    }

    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== eventId) return e;
        return {
          ...e,
          missions: e.missions.map((m) => {
            if (m.id !== missionId) return m;
            return {
              ...m,
              assigned: m.assigned.filter((a) => a.name !== userName),
            };
          }),
        };
      })
    );
    toast(`${userName} désinscrit de la mission.`, "success");
  }

  if (!session) {
    return <LoginPage onLogin={() => {}} />;
  }

  if (!currentUser) {
    return <div style={styles.page}>Chargement du profil...</div>;
  }

  if (currentUser.status !== "approved") {
    return (
      <div style={styles.page}>
        <h1>BCMF Crew</h1>
        <h2>Compte en attente de validation</h2>
        <p>
          Votre compte a été créé avec succès.
          Un administrateur doit maintenant le valider.
        </p>
      </div>
    );
  }

  const visibleEvents =
    currentUser.role === "admin"
      ? events
      : currentUser.role === "referent"
      ? events.filter((e) => e.team === currentUser.team)
      : events;

  const profileModal = showProfile && (
    <div style={modalStyles.overlay}>
      <div style={modalStyles.modal}>
        <h2 style={{ marginTop: 0, color: "#14532d" }}>Mon profil</h2>

        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <label>Prénom</label>
            <input
              value={profileForm.first_name}
              onChange={(e) =>
                setProfileForm({ ...profileForm, first_name: e.target.value })
              }
              style={styles.input}
            />
          </div>

          <div>
            <label>Nom</label>
            <input
              value={profileForm.last_name}
              onChange={(e) =>
                setProfileForm({ ...profileForm, last_name: e.target.value })
              }
              style={styles.input}
            />
          </div>

          <div>
            <label>Email</label>
            <input value={currentUser.email} disabled style={styles.input} />
          </div>

          <div>
            <label>Téléphone</label>
            <input
              value={profileForm.phone}
              onChange={(e) =>
                setProfileForm({ ...profileForm, phone: e.target.value })
              }
              style={styles.input}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button style={styles.orangeButton} onClick={updateMyProfile}>
            Enregistrer
          </button>
          <button style={styles.darkButton} onClick={() => setShowProfile(false)}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );

  if (page === "admin-config") {
    return (
      <div style={styles.page}>
        <Header currentUser={currentUser} onProfileClick={() => setShowProfile(true)} />
        {profileModal}
        <AdminConfigPage onBack={() => setPage("dashboard")} />
      </div>
    );
  }

  if (page === "admin-users") {
    return (
      <div style={styles.page}>
        <Header currentUser={currentUser} onProfileClick={() => setShowProfile(true)} />
        {profileModal}
        <AdminUsersPage currentUser={currentUser} onBack={() => setPage("dashboard")} />
      </div>
    );
  }

  if (page === "partners") {
    return (
      <div style={styles.page}>
        <Header currentUser={currentUser} onProfileClick={() => setShowProfile(true)} />
        {profileModal}
        <PartnersPage currentUser={currentUser} onBack={() => setPage("dashboard")} />
      </div>
    );
  }

  if (selectedEvent) {
    return (
      <div style={styles.page}>
        <Header currentUser={currentUser} onProfileClick={() => setShowProfile(true)} />
        {profileModal}
        <EventPage
          event={selectedEvent}
          currentUser={currentUser}
          eventCoverage={eventCoverage}
          onBack={() => setSelectedEventId(null)}
          onTakeMission={takeMission}
          onCancelMission={cancelMission}
          onAddMission={addMissionToEvent}
          onDeleteEvent={deleteEvent}
          onDeleteMission={deleteMission}
          onUpdateEvent={updateEvent}
          onUpdateMission={updateMission}
          onAdminAssign={adminAssignMission}
          onAdminUnassign={adminUnassignMission}
        />
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <Header currentUser={currentUser} onProfileClick={() => setShowProfile(true)} />
      {profileModal}

<button style={styles.orangeButton} onClick={() => setPage("partners")}>
        Un Besoin une envie ? Pensez à nos partenaires
      </button>

      {currentUser.role === "admin" && (
        <>
          <button style={styles.orangeButton} onClick={() => setPage("admin-users")}>
            Administration utilisateurs
          </button>
          <button style={styles.orangeButton} onClick={() => setPage("admin-config")}>
            ⚙️ Équipes & Compétences
          </button>
        </>
      )}

      <DashboardPage
        currentUser={currentUser}
        visibleEvents={visibleEvents}
        eventCoverage={eventCoverage}
        onOpenEvent={setSelectedEventId}
        onAddEvent={addEvent}
      />
    </div>
  );
}

const modalStyles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    zIndex: 999,
  },
  modal: {
    width: "100%",
    maxWidth: 460,
    background: "white",
    borderRadius: 24,
    padding: 30,
    boxShadow: "0 20px 60px rgba(0,0,0,.35)",
  },
};
