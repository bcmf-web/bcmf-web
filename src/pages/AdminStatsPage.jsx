import { useMemo } from "react";
import { getStyles } from "../styles/styles.js";
import { useIsMobile } from "../hooks/useIsMobile.js";
import Kpi from "../components/Kpi.jsx";
import { formatDate, formatTime, formatTimeSlot } from "../utils/dateUtils.js";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slotMinutes(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
}

function fmtHours(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m > 0 ? String(m).padStart(2, "0") : ""}` : `${m}min`;
}

function downloadCSV(filename, rows) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function AdminStatsPage({ events, onBack }) {
  const styles = getStyles(useIsMobile());

  // ── Calculs ──────────────────────────────────────────────────────────────

  const statsByVolunteer = useMemo(() => {
    const map = {};
    for (const ev of events) {
      for (const m of ev.missions) {
        for (const a of m.assigned) {
          if (!map[a.name]) map[a.name] = { name: a.name, missions: 0, minutes: 0, eventIds: new Set() };
          map[a.name].missions += 1;
          map[a.name].minutes += slotMinutes(a.slotStart, a.slotEnd);
          map[a.name].eventIds.add(ev.id);
        }
      }
    }
    return Object.values(map)
      .map((v) => ({ ...v, events: v.eventIds.size }))
      .sort((a, b) => b.missions - a.missions);
  }, [events]);

  const statsByEvent = useMemo(() => {
    return events.map((ev) => {
      const totalNeed = ev.missions.reduce((s, m) => s + m.need, 0);
      const totalAssigned = ev.missions.reduce((s, m) => s + m.assigned.length, 0);
      const coverage = totalNeed === 0 ? 0 : Math.round((totalAssigned / totalNeed) * 100);
      return { id: ev.id, title: ev.title, date: ev.start_datetime, missions: ev.missions.length, need: totalNeed, assigned: totalAssigned, coverage };
    });
  }, [events]);

  const totalMinutes = statsByVolunteer.reduce((s, v) => s + v.minutes, 0);
  const totalAssignments = statsByVolunteer.reduce((s, v) => s + v.missions, 0);

  // ── Exports ──────────────────────────────────────────────────────────────

  function exportGlobalCSV() {
    const rows = [["Événement", "Date", "Mission", "Habilitation", "Besoin", "Bénévole", "Début créneau", "Fin créneau", "Durée"]];
    for (const ev of events) {
      const dateStr = ev.start_datetime ? `${formatDate(ev.start_datetime)} ${formatTime(ev.start_datetime)}` : "—";
      for (const m of ev.missions) {
        if (m.assigned.length === 0) {
          rows.push([ev.title, dateStr, m.name, m.requiredSkill, m.need, "—", "—", "—", "—"]);
        } else {
          for (const a of m.assigned) {
            const mins = slotMinutes(a.slotStart, a.slotEnd);
            rows.push([ev.title, dateStr, m.name, m.requiredSkill, m.need, a.name, formatTimeSlot(a.slotStart), formatTimeSlot(a.slotEnd), mins > 0 ? fmtHours(mins) : "—"]);
          }
        }
      }
    }
    downloadCSV("BCMF_export_global.csv", rows);
  }

  function exportVolunteersCSV() {
    const rows = [["Bénévole", "Missions", "Événements", "Heures bénévolat"]];
    for (const v of statsByVolunteer) {
      rows.push([v.name, v.missions, v.events, v.minutes > 0 ? fmtHours(v.minutes) : "—"]);
    }
    downloadCSV("BCMF_benevoles.csv", rows);
  }

  function exportGlobalPDF() {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.setTextColor("#14532d");
    doc.text("BCMF Flow — Export global des missions", 14, 15);

    const body = [];
    for (const ev of events) {
      const dateStr = ev.start_datetime ? `${formatDate(ev.start_datetime)}` : "—";
      for (const m of ev.missions) {
        if (m.assigned.length === 0) {
          body.push([ev.title, dateStr, m.name, m.requiredSkill, m.need, "—", "—", "—"]);
        } else {
          for (const a of m.assigned) {
            const mins = slotMinutes(a.slotStart, a.slotEnd);
            body.push([ev.title, dateStr, m.name, m.requiredSkill, m.need, a.name, `${formatTimeSlot(a.slotStart)} → ${formatTimeSlot(a.slotEnd)}`, mins > 0 ? fmtHours(mins) : "—"]);
          }
        }
      }
    }

    autoTable(doc, {
      startY: 22,
      head: [["Événement", "Date", "Mission", "Habilitation", "Besoin", "Bénévole", "Créneau", "Durée"]],
      body,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [20, 83, 45], textColor: 255 },
      alternateRowStyles: { fillColor: [240, 253, 244] },
    });

    doc.save("BCMF_export_global.pdf");
  }

  function exportVolunteersPDF() {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setTextColor("#14532d");
    doc.text("BCMF Flow — Statistiques bénévoles", 14, 15);

    autoTable(doc, {
      startY: 22,
      head: [["Bénévole", "Missions", "Événements", "Heures bénévolat"]],
      body: statsByVolunteer.map((v) => [v.name, v.missions, v.events, v.minutes > 0 ? fmtHours(v.minutes) : "—"]),
      styles: { fontSize: 10 },
      headStyles: { fillColor: [20, 83, 45], textColor: 255 },
      alternateRowStyles: { fillColor: [240, 253, 244] },
    });

    doc.save("BCMF_benevoles.pdf");
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <>
      <button style={styles.backButton} onClick={onBack}>← Retour</button>

      <h1 style={{ marginTop: 24, color: "#14532d" }}>📊 Statistiques & Exports</h1>

      {/* KPIs globaux */}
      <section style={styles.kpis}>
        <Kpi label="Événements" value={events.length} />
        <Kpi label="Bénévoles actifs" value={statsByVolunteer.length} />
        <Kpi label="Inscriptions totales" value={totalAssignments} />
        <Kpi label="Heures bénévolat" value={totalMinutes > 0 ? fmtHours(totalMinutes) : "—"} />
      </section>

      {/* Export global */}
      <div style={sectionStyle}>
        <h2 style={h2Style}>📥 Export global</h2>
        <div style={btnRowStyle}>
          <button style={styles.orangeButton} onClick={exportGlobalCSV}>⬇️ Toutes les missions — CSV</button>
          <button style={styles.darkButton} onClick={exportGlobalPDF}>📄 Toutes les missions — PDF</button>
          <button style={styles.orangeButton} onClick={exportVolunteersCSV}>⬇️ Bénévoles — CSV</button>
          <button style={styles.darkButton} onClick={exportVolunteersPDF}>📄 Bénévoles — PDF</button>
        </div>
      </div>

      {/* Tableau bénévoles */}
      <div style={sectionStyle}>
        <h2 style={h2Style}>🙋 Par bénévole</h2>
        <div style={styles.tableWrapper}>
          <table style={tableStyle}>
            <thead>
              <tr>
                {["Bénévole", "Missions", "Événements", "Heures bénévolat"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {statsByVolunteer.map((v, i) => (
                <tr key={v.name} style={{ background: i % 2 === 0 ? "#f0fdf4" : "white" }}>
                  <td style={tdStyle}>{v.name}</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>{v.missions}</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>{v.events}</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>{v.minutes > 0 ? fmtHours(v.minutes) : "—"}</td>
                </tr>
              ))}
              {statsByVolunteer.length === 0 && (
                <tr><td colSpan={4} style={{ ...tdStyle, textAlign: "center", color: "#94a3b8" }}>Aucune inscription enregistrée</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tableau événements */}
      <div style={sectionStyle}>
        <h2 style={h2Style}>📅 Par événement</h2>
        <div style={styles.tableWrapper}>
          <table style={tableStyle}>
            <thead>
              <tr>
                {["Événement", "Date", "Missions", "Besoin", "Inscrits", "Couverture"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {statsByEvent.map((ev, i) => (
                <tr key={ev.id} style={{ background: i % 2 === 0 ? "#f0fdf4" : "white" }}>
                  <td style={tdStyle}>{ev.title}</td>
                  <td style={tdStyle}>{ev.date ? formatDate(ev.date) : "—"}</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>{ev.missions}</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>{ev.need}</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>{ev.assigned}</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <span style={{
                      fontWeight: "bold",
                      color: ev.coverage === 100 ? "#16a34a" : ev.coverage > 0 ? "#d97706" : "#dc2626",
                    }}>
                      {ev.coverage}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

const sectionStyle = {
  background: "white",
  borderRadius: 20,
  padding: 24,
  boxShadow: "0 4px 12px rgba(0,0,0,.08)",
  marginTop: 24,
};

const h2Style = { marginTop: 0, color: "#14532d" };

const btnRowStyle = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 14,
};

const thStyle = {
  background: "#14532d",
  color: "white",
  padding: "10px 14px",
  textAlign: "left",
  fontWeight: "bold",
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "10px 14px",
  borderBottom: "1px solid #e5e7eb",
};
