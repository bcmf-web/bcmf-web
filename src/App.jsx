import React, { useEffect, useState } from "react";
import AdminUsersPage from "./pages/AdminUsersPage.jsx";
import { supabase } from "./services/supabaseClient.js";
import Header from "./components/Header.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import EventPage from "./pages/EventPage.jsx";
import { styles } from "./styles/styles.js";
import LoginPage from "./pages/LoginPage.jsx";
import PartnersPage from "./pages/PartnersPage.jsx";


export default function App() {
 

  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [page, setPage] = useState("dashboard");
  
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
  async function loadEvents() {
    const { data, error } = await supabase
      .from("events")
      .select(`
        *,
        missions (
          id,
          name,
          need,
          required_skill,
          assignments (
            id,
            user_name
          )
        )
      `);

    console.log("SUPABASE DATA:", data);
    console.log("SUPABASE ERROR:", error);

    if (error) {
      alert("Erreur Supabase : " + error.message);
      return;
    }

    const formatted = data.map((event) => ({
      ...event,
      missions: event.missions.map((mission) => ({
        id: mission.id,
        name: mission.name,
        need: mission.need,
        requiredSkill: mission.required_skill,
        assigned: mission.assignments.map((a) => a.user_name),
      })),
    }));

    setEvents(formatted);
  }

  loadEvents();
 }, []);

  //useEffect(() => {
    //localStorage.setItem("bcmf_events", JSON.stringify(events));
  //}, [events]);

  const currentUser = profile;
  const selectedEvent = events.find((e) => e.id === selectedEventId);



  function eventCoverage(event) {
    const total = event.missions.reduce((sum, mission) => sum + mission.need, 0);
    const assigned = event.missions.reduce(
      (sum, mission) => sum + mission.assigned.length,
      0
    );

    return total === 0 ? 0 : Math.round((assigned / total) * 100);
  }

  async function addEvent(newEvent) {

	  const { data, error } = await supabase
		.from("events")
		.insert([
		  {
			title: newEvent.title,
			team: newEvent.team,
			category: newEvent.category,
			date: newEvent.date,
			time: newEvent.time,
			place: newEvent.place,
		  },
		])
		.select();

	  if (error) {
		alert(error.message);
		return;
	  }

	  const createdEvent = {
		...data[0],
		missions: [],
	  };

	  setEvents((prev) => [...prev, createdEvent]);
	}
  
	async function updateEvent(eventId, updatedEvent) {
	  const { error } = await supabase
		.from("events")
		.update({
		  title: updatedEvent.title,
		  date: updatedEvent.date,
		  time: updatedEvent.time,
		  place: updatedEvent.place,
		})
		.eq("id", eventId);

	  if (error) {
		alert(error.message);
		return;
	  }

	  setEvents((prev) =>
		prev.map((event) => {
		  if (event.id !== eventId) return event;

		  return {
			...event,
			title: updatedEvent.title,
			date: updatedEvent.date,
			time: updatedEvent.time,
			place: updatedEvent.place,
		  };
		})
	  );
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
		  },
		])
		.select();

	  if (error) {
		alert(error.message);
		return;
	  }

	  const createdMission = {
		id: data[0].id,
		name: data[0].name,
		need: data[0].need,
		requiredSkill: data[0].required_skill,
		assigned: [],
	  };

	  setEvents((prev) =>
		prev.map((event) =>
		  event.id === eventId
			? { ...event, missions: [...event.missions, createdMission] }
			: event
		)
	  );
	}
  
	async function deleteEvent(eventId) {
	  if (!confirm("Supprimer cet événement ?")) return;

	  const { error } = await supabase
		.from("events")
		.delete()
		.eq("id", eventId);

	  if (error) {
		alert(error.message);
		return;
	  }

	  setEvents((prev) =>
		prev.filter((event) => event.id !== eventId)
	  );

	  setSelectedEventId(null);
	}

	async function deleteMission(eventId, missionId) {
	  if (!confirm("Supprimer cette mission ?")) return;

	  const { error } = await supabase
		.from("missions")
		.delete()
		.eq("id", missionId);

	  if (error) {
		alert(error.message);
		return;
	  }

	  setEvents((prev) =>
		prev.map((event) => {
		  if (event.id !== eventId) return event;

		  return {
			...event,
			missions: event.missions.filter(
			  (mission) => mission.id !== missionId
			),
		  };
		})
	  );
	}

	async function updateMission(eventId, missionId, updatedMission) {
	  const { error } = await supabase
		.from("missions")
		.update({
		  name: updatedMission.name,
		  need: Number(updatedMission.need),
		  required_skill: updatedMission.requiredSkill,
		})
		.eq("id", missionId);

	  if (error) {
		alert(error.message);
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
			  };
			}),
		  };
		})
	  );
	}

	async function takeMission(eventId, missionId) {
	  if (currentUser.status !== "approved") {
		alert("Ton compte n'est pas validé.");
		return;
	  }
	  
	  

	  const event = events.find((e) => e.id === eventId);
	  const mission = event.missions.find((m) => m.id === missionId);

	  if (!currentUser.skills.includes(mission.requiredSkill)) {
		alert("Habilitation requise : " + mission.requiredSkill);
		return;
	  }

	  if (mission.assigned.includes(currentUser.name)) {
		alert("Tu es déjà inscrit sur cette mission.");
		return;
	  }

	  if (mission.assigned.length >= mission.need) {
		alert("Mission complète.");
		return;
	  }

	  const { error } = await supabase
		.from("assignments")
		.insert([
		  {
			mission_id: missionId,
			user_name: currentUser.name,
		  },
		]);

	  if (error) {
		alert(error.message);
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
				assigned: [...mission.assigned, currentUser.name],
			  };
			}),
		  };
		})
	  );
	}

	async function cancelMission(eventId, missionId) {
	  const { error } = await supabase
		.from("assignments")
		.delete()
		.eq("mission_id", missionId)
		.eq("user_name", currentUser.name);

	  if (error) {
		alert(error.message);
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
				assigned: mission.assigned.filter(
				  (name) => name !== currentUser.name
				),
			  };
			}),
		  };
		})
	  );
	}

  if (!session) {
    return <LoginPage onLogin={() => {}} />;
  }

  if (!currentUser) {
    return (
      <div style={styles.page}>
        Chargement du profil...
      </div>
    );
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


if (page === "admin-users") {
  return (
    <div style={styles.page}>
      <Header currentUser={currentUser} />

      <AdminUsersPage
        currentUser={currentUser}
        onBack={() => setPage("dashboard")}
      />
    </div>
  );
}
  if (page === "partners") {
	  return (
		<div style={styles.page}>
		  <Header currentUser={currentUser} />

		  <PartnersPage
			currentUser={currentUser}
			onBack={() => setPage("dashboard")}
		  />
		</div>
	  );
	}
  if (selectedEvent) {
    return (
      <div style={styles.page}>
        <Header currentUser={currentUser} />

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
        />
      </div>
    );
	
  }
  
  

return (
  <div style={styles.page}>
    <Header currentUser={currentUser} />
	
	<div
      style={{
        background: "#fff8e1",
        border: "1px solid #facc15",
        color: "#92400e",
        padding: "15px",
        borderRadius: "12px",
        marginTop: "15px",
        marginBottom: "15px",
        fontWeight: "bold",
      }}
    >
      ⚠️ BCMF Flow – Bêta v0.1-beta
      <br />
      Cette application est actuellement en phase de test.
      Merci de remonter toute anomalie ou suggestion d'amélioration.
    </div>
	<button
	  style={styles.orangeButton}
	  onClick={() => setPage("partners")}
	>
	  Pensez à nos partenaires
	</button>
	
    {currentUser.role === "admin" && (
      <button
        style={styles.orangeButton}
        onClick={() => setPage("admin-users")}
      >
        Administration utilisateurs
      </button>
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