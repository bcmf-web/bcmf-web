export function canManageEvent(user, event) {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role === "referent" && user.team === event.team) return true;
  return false;
}

export function canSeeEvent(user, event) {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role === "referent" && user.team === event.team) return true;
  return true; // les bénévoles peuvent voir les missions ouvertes
}