const BCMF_GREEN = "#16a34a";
const BCMF_GREEN_DARK = "#14532d";
const BCMF_GREEN_LIGHT = "#dcfce7";

export const styles = {
  page: {
    minHeight: "100vh",
    background: "#f4f6fb",
    padding: 30,
    fontFamily: "Arial, sans-serif",
  },

  header: {
    background: `linear-gradient(135deg, #0f172a 0%, ${BCMF_GREEN_DARK} 60%, ${BCMF_GREEN} 100%)`,
    color: "white",
    borderRadius: 25,
    padding: 25,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 20,
  },

  brand: {
    display: "flex",
    alignItems: "center",
    gap: 18,
  },

  logo: {
    height: 80,
    width: 80,
    objectFit: "contain",
    background: "white",
    borderRadius: 18,
    padding: 8,
  },

  title: {
    margin: 0,
    fontSize: 36,
  },

  subtitle: {
    margin: "5px 0 0",
  },

  select: {
    padding: 12,
    borderRadius: 12,
    border: "none",
    fontWeight: "bold",
  },

  userPill: {
    background: "rgba(255,255,255,.18)",
    padding: "10px 15px",
    borderRadius: 999,
    fontWeight: "bold",
  },

  kpis: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 18,
    marginTop: 25,
  },

  kpi: {
    background: "white",
    padding: 20,
    borderRadius: 18,
    boxShadow: "0 4px 12px rgba(0,0,0,.08)",
    borderTop: `5px solid ${BCMF_GREEN}`,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))",
    gap: 20,
    marginTop: 20,
  },

  card: {
    background: "white",
    padding: 22,
    borderRadius: 20,
    boxShadow: "0 4px 12px rgba(0,0,0,.08)",
    cursor: "pointer",
  },

  hero: {
    background: "white",
    padding: 30,
    borderRadius: 25,
    boxShadow: "0 4px 12px rgba(0,0,0,.08)",
    marginTop: 25,
    borderTop: `6px solid ${BCMF_GREEN}`,
  },

  badge: {
    display: "inline-block",
    background: BCMF_GREEN,
    color: "white",
    padding: "6px 12px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: "bold",
  },

  progressBack: {
    width: "100%",
    height: 12,
    background: "#eee",
    borderRadius: 20,
    overflow: "hidden",
    margin: "12px 0",
  },

  progressFront: {
    height: "100%",
    borderRadius: 20,
  },

  link: {
    marginTop: 15,
    color: BCMF_GREEN,
    fontWeight: "bold",
  },

  backButton: {
    marginTop: 25,
    background: "#222",
    color: "white",
    border: "none",
    padding: "12px 18px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: "bold",
  },

  orangeButton: {
    background: BCMF_GREEN,
    color: "white",
    border: "none",
    padding: "12px 18px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: "bold",
  },

  darkButton: {
    background: "#222",
    color: "white",
    border: "none",
    padding: "12px 18px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: "bold",
  },

  disabledButton: {
    background: "#aaa",
    color: "white",
    border: "none",
    padding: "12px 18px",
    borderRadius: 12,
    cursor: "not-allowed",
    fontWeight: "bold",
  },

  adminNotice: {
    background: BCMF_GREEN_LIGHT,
    border: `1px solid ${BCMF_GREEN}`,
    color: BCMF_GREEN_DARK,
    padding: 15,
    borderRadius: 15,
    marginTop: 20,
    fontWeight: "bold",
  },

  redButton: {
    background: "#c0392b",
    color: "white",
    border: "none",
    padding: "12px 18px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: "bold",
  },
};