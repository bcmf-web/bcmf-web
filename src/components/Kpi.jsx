import { styles } from "../styles/styles.js";

export default function Kpi({ label, value }) {
  return (
    <div style={styles.kpi}>
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}