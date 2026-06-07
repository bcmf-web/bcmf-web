import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDate, formatTime, formatTimeSlot } from "./dateUtils.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function downloadCSV(filename, rows) {
  const csv = rows.map((r) => r.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function eventHeader(event) {
  const date = event.start_datetime
    ? `${formatDate(event.start_datetime)} ${formatTime(event.start_datetime)}${event.end_datetime ? " → " + formatTime(event.end_datetime) : ""}`
    : "Date à définir";
  return `${event.title} — ${date} — ${event.place || "-"}`;
}

// ─── Export CSV événement (missions + inscrits) ────────────────────────────────

export function exportEventCSV(event) {
  const rows = [["Mission", "Habilitation", "Besoin", "Bénévole", "Créneau début", "Créneau fin"]];

  for (const m of event.missions) {
    if (m.assigned.length === 0) {
      rows.push([m.name, m.requiredSkill, m.need, "—", formatTimeSlot(m.timeStart), formatTimeSlot(m.timeEnd)]);
    } else {
      for (const a of m.assigned) {
        rows.push([m.name, m.requiredSkill, m.need, a.name, formatTimeSlot(a.slotStart), formatTimeSlot(a.slotEnd)]);
      }
    }
  }

  downloadCSV(`${event.title}_missions.csv`, rows);
}

// ─── Export CSV planning (par bénévole) ───────────────────────────────────────

export function exportPlanningCSV(event) {
  const rows = [["Bénévole", "Mission", "Habilitation", "Début mission", "Fin mission", "Début créneau", "Fin créneau"]];

  const lines = [];
  for (const m of event.missions) {
    for (const a of m.assigned) {
      lines.push({
        name: a.name,
        mission: m.name,
        skill: m.requiredSkill,
        mStart: m.timeStart,
        mEnd: m.timeEnd,
        sStart: a.slotStart,
        sEnd: a.slotEnd,
      });
    }
  }

  lines.sort((a, b) => (a.sStart || a.mStart || "").localeCompare(b.sStart || b.mStart || ""));

  for (const l of lines) {
    rows.push([l.name, l.mission, l.skill, formatTimeSlot(l.mStart), formatTimeSlot(l.mEnd), formatTimeSlot(l.sStart), formatTimeSlot(l.sEnd)]);
  }

  downloadCSV(`${event.title}_planning.csv`, rows);
}

// ─── Export PDF événement (missions + inscrits) ────────────────────────────────

export function exportEventPDF(event) {
  const doc = new jsPDF({ orientation: "landscape" });

  doc.setFontSize(16);
  doc.setTextColor("#14532d");
  doc.text("BCMF Flow — Missions", 14, 15);

  doc.setFontSize(11);
  doc.setTextColor("#334155");
  doc.text(eventHeader(event), 14, 23);

  const body = [];
  for (const m of event.missions) {
    if (m.assigned.length === 0) {
      body.push([m.name, m.requiredSkill, m.need, "—", "—", "—"]);
    } else {
      for (const a of m.assigned) {
        body.push([m.name, m.requiredSkill, m.need, a.name, formatTimeSlot(a.slotStart), formatTimeSlot(a.slotEnd)]);
      }
    }
  }

  autoTable(doc, {
    startY: 28,
    head: [["Mission", "Habilitation", "Besoin", "Bénévole", "Créneau début", "Créneau fin"]],
    body,
    styles: { fontSize: 10 },
    headStyles: { fillColor: [20, 83, 45], textColor: 255 },
    alternateRowStyles: { fillColor: [240, 253, 244] },
  });

  doc.save(`${event.title}_missions.pdf`);
}

// ─── Export PDF planning (par bénévole) ───────────────────────────────────────

export function exportPlanningPDF(event) {
  const doc = new jsPDF({ orientation: "landscape" });

  doc.setFontSize(16);
  doc.setTextColor("#14532d");
  doc.text("BCMF Flow — Planning bénévoles", 14, 15);

  doc.setFontSize(11);
  doc.setTextColor("#334155");
  doc.text(eventHeader(event), 14, 23);

  const lines = [];
  for (const m of event.missions) {
    for (const a of m.assigned) {
      lines.push({
        name: a.name,
        mission: m.name,
        skill: m.requiredSkill,
        mStart: m.timeStart,
        mEnd: m.timeEnd,
        sStart: a.slotStart,
        sEnd: a.slotEnd,
      });
    }
  }

  lines.sort((a, b) => (a.sStart || a.mStart || "").localeCompare(b.sStart || b.mStart || ""));

  const body = lines.map((l) => [
    l.name,
    l.mission,
    l.skill,
    formatTimeSlot(l.mStart),
    formatTimeSlot(l.mEnd),
    formatTimeSlot(l.sStart),
    formatTimeSlot(l.sEnd),
  ]);

  autoTable(doc, {
    startY: 28,
    head: [["Bénévole", "Mission", "Habilitation", "Début mission", "Fin mission", "Début créneau", "Fin créneau"]],
    body,
    styles: { fontSize: 10 },
    headStyles: { fillColor: [20, 83, 45], textColor: 255 },
    alternateRowStyles: { fillColor: [240, 253, 244] },
  });

  doc.save(`${event.title}_planning.pdf`);
}
