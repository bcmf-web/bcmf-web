import { useState } from "react";
import { getStyles } from "../styles/styles.js";
import { useIsMobile } from "../hooks/useIsMobile.js";

export default function CollapsiblePanel({ title, children, defaultOpen = false }) {
  const styles = getStyles(useIsMobile());
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={styles.panel}>
      {/* En-tête cliquable */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={headerStyle}
        aria-expanded={open}
      >
        <span style={{ fontWeight: "bold", fontSize: 16 }}>{title}</span>
        <span style={chevronStyle(open)}>{open ? "▲" : "▼"}</span>
      </button>

      {/* Contenu pliable */}
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {children}
        </div>
      )}
    </div>
  );
}

const headerStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 0,
  textAlign: "left",
};

function chevronStyle(open) {
  return {
    fontSize: 13,
    color: "#64748b",
    transition: "transform 0.2s",
  };
}
