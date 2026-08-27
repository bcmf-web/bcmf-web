import * as XLSX from "xlsx";
import { supabase } from "./supabaseClient.js";

const FUNCTION_URL = "https://lvxlewregtqilzraoxkl.supabase.co/functions/v1/bulk-add-volunteers";

// Doit correspondre à NO_ACCOUNT_DOMAIN côté edge function bulk-add-volunteers
const NO_ACCOUNT_DOMAIN = "sans-compte.bcmf.local";

// Un bénévole importé sans email n'a pas de compte de connexion — repérable par ce domaine technique
export function isPlaceholderEmail(email) {
  return typeof email === "string" && email.endsWith(`@${NO_ACCOUNT_DOMAIN}`);
}

// Normalise un en-tête de colonne : minuscules, sans accents, sans espaces superflus
function normalizeHeader(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

const HEADER_ALIASES = {
  last_name: ["nom"],
  first_name: ["prenom", "prénom"],
  email: ["email", "e-mail", "mail"],
  phone: ["telephone", "téléphone", "tel", "portable"],
  teams: ["equipe", "équipe", "equipes", "équipes"],
};

function buildColumnMap(headerRow) {
  const normalized = headerRow.map(normalizeHeader);
  const map = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const idx = normalized.findIndex((h) => aliases.includes(h));
    if (idx !== -1) map[field] = idx;
  }
  return map;
}

// Lit un fichier .xlsx/.csv et retourne les bénévoles bruts + erreurs de format
export async function parseVolunteersFile(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defaultValue: "" });

  const dataRows = rows.filter((r) => r.some((cell) => String(cell ?? "").trim() !== ""));
  if (dataRows.length === 0) {
    return { volunteers: [], formatError: "Le fichier est vide." };
  }

  const columnMap = buildColumnMap(dataRows[0]);
  if (columnMap.last_name === undefined || columnMap.first_name === undefined) {
    return {
      volunteers: [],
      formatError: "Colonnes attendues introuvables. Le fichier doit contenir au minimum : Nom, Prénom.",
    };
  }

  const volunteers = dataRows.slice(1).map((row, i) => {
    const teamsRaw = columnMap.teams !== undefined ? String(row[columnMap.teams] ?? "") : "";
    return {
      rowNumber: i + 2,
      last_name: String(row[columnMap.last_name] ?? "").trim(),
      first_name: String(row[columnMap.first_name] ?? "").trim(),
      email: columnMap.email !== undefined ? String(row[columnMap.email] ?? "").trim().toLowerCase() : "",
      phone: columnMap.phone !== undefined ? String(row[columnMap.phone] ?? "").trim() : "",
      teams: teamsRaw.split(/[,;/]/).map((t) => t.trim()).filter(Boolean),
    };
  });

  return { volunteers, formatError: null };
}

// Valide chaque ligne (champs requis, email correct, doublons) avant import
export function validateVolunteers(volunteers, knownTeamNames) {
  const emailSeen = new Set();
  const knownLower = new Set(knownTeamNames.map((t) => t.toLowerCase()));

  return volunteers.map((v) => {
    const issues = [];
    if (!v.last_name) issues.push("Nom manquant");
    if (!v.first_name) issues.push("Prénom manquant");
    if (v.email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) issues.push("Email invalide");
      else if (emailSeen.has(v.email)) issues.push("Email en double dans le fichier");
      emailSeen.add(v.email);
    }

    const unknownTeams = v.teams.filter((t) => !knownLower.has(t.toLowerCase()));
    if (unknownTeams.length > 0) issues.push(`Équipe(s) inconnue(s) : ${unknownTeams.join(", ")}`);

    return { ...v, issues, valid: issues.length === 0 };
  });
}

// Télécharge un modèle de fichier Excel à remplir
export function downloadTemplate() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["Nom", "Prénom", "Email", "Téléphone", "Équipe(s)"],
    ["Dupont", "Marie", "marie.dupont@example.com", "0601020304", "U15F"],
    ["Martin", "Julien", "", "0611223344", "U15F"],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, "Bénévoles");
  XLSX.writeFile(wb, "modele_import_benevoles.xlsx");
}

// Appelle l'edge function d'import en masse
export async function bulkAddVolunteers(volunteers) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      volunteers: volunteers.map((v) => ({
        first_name: v.first_name,
        last_name: v.last_name,
        email: v.email,
        phone: v.phone || null,
        teams: v.teams,
      })),
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || `Échec de l'import (HTTP ${res.status})`);
  }
  return json;
}

// Exporte les identifiants générés (email + mot de passe temporaire) en CSV pour l'admin
export function exportCredentialsCSV(results) {
  const rows = [["Nom", "Email", "Mot de passe temporaire", "Compte", "Statut", "Détail"]];
  for (const r of results) {
    rows.push([
      r.name,
      r.email || "",
      r.temp_password || "",
      r.has_account ? "Avec connexion" : "Sans connexion (fiche seule)",
      r.status,
      r.error || (r.unmatched_teams ? `Équipe(s) non trouvée(s) : ${r.unmatched_teams.join(", ")}` : ""),
    ]);
  }
  const csv = rows.map((r) => r.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "identifiants_benevoles.csv";
  a.click();
  URL.revokeObjectURL(url);
}
