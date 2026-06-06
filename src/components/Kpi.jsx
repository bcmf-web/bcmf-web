import { getStyles } from "../styles/styles.js";
import { useIsMobile } from "../hooks/useIsMobile.js";

export default function Kpi({ label, value }) {
  const styles = getStyles(useIsMobile());
  return (
    <div style={styles.kpi}>
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}