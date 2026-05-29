import { styles } from "../styles/styles.js";

export default function Progress({ value }) {
  const color = value >= 100 ? "#27ae60" : value >= 50 ? "#f39c12" : "#e74c3c";

  return (
    <>
      <div style={styles.progressBack}>
        <div
          style={{
            ...styles.progressFront,
            width: `${value}%`,
            background: color,
          }}
        />
      </div>
      <strong style={{ color }}>{value}% couvert</strong>
    </>
  );
}