// Formate un datetime complet : "lundi 13 septembre 2026 à 09:00"
export function formatDatetime(dt) {
  if (!dt) return "-";
  return new Date(dt).toLocaleString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Formate uniquement la date : "lundi 13 septembre 2026"
export function formatDate(dt) {
  if (!dt) return "-";
  return new Date(dt).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Formate uniquement l'heure : "09:00"
export function formatTime(dt) {
  if (!dt) return "-";
  return new Date(dt).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Formate une heure TIME (ex: "09:00:00") en "09:00"
export function formatTimeSlot(t) {
  if (!t) return "-";
  return t.slice(0, 5);
}

// Convertit un datetime pour un input type="datetime-local"
export function toInputDatetime(dt) {
  if (!dt) return "";
  return new Date(dt).toISOString().slice(0, 16);
}

// Vérifie si deux plages horaires se chevauchent
export function slotsOverlap(start1, end1, start2, end2) {
  return start1 < end2 && end1 > start2;
}
