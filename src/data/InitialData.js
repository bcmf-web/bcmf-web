export const users = [
  {
    id: 1,
    name: "Admin Club",
    role: "admin",
    team: null,
    status: "approved",
    skills: [],
  },

  {
    id: 2,
    name: "Référent U11",
    role: "referent",
    team: "U11",
    status: "approved",
    skills: ["Table de marque", "Buvette"],
  },

  {
    id: 3,
    name: "Sophie Martin",
    role: "benevole",
    team: "U11",
    status: "approved",
    skills: ["Buvette", "Accueil"],
  },
];
export const events = [
  {
    id: 1,
    title: "U11F vs Haguenau",
    team: "U11",
    category: "Match Amateur",
    date: "2026-05-10",
    time: "14:00",
    place: "Gymnase BCMF",

    missions: [
      {
        id: 101,
        name: "Buvette",
        need: 3,
        requiredSkill: "Buvette",
        assigned: ["Sophie Martin"],
      },

      {
        id: 102,
        name: "Table de marque",
        need: 2,
        requiredSkill: "Table de marque",
        assigned: [],
      },
    ],
  },

  {
    id: 2,
    title: "BCMF vs Strasbourg",
    team: "Seniors",
    category: "Match Pro",
    date: "2026-05-11",
    time: "18:00",
    place: "Salle principale",

    missions: [
      {
        id: 201,
        name: "Accueil",
        need: 4,
        requiredSkill: "Accueil",
        assigned: [],
      },
    ],
  },
];

export const skills = [
  "Buvette",
  "Table de marque",
  "Arbitrage",
  "Accueil",
  "Installation",
  "Rangement",
];