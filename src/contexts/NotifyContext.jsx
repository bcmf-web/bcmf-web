import { createContext, useCallback, useContext, useState } from "react";

const NotifyContext = createContext(null);

export function NotifyProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);

  const toast = useCallback((message, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const confirm = useCallback((message) => {
    return new Promise((resolve) => {
      setConfirmState({ message, resolve });
    });
  }, []);

  function handleConfirm(result) {
    if (confirmState) {
      confirmState.resolve(result);
      setConfirmState(null);
    }
  }

  return (
    <NotifyContext.Provider value={{ toast, confirm }}>
      {children}

      <div style={toasterStyle}>
        {toasts.map((t) => (
          <div key={t.id} style={toastItemStyle(t.type)}>
            {t.type === "error" && "❌ "}
            {t.type === "success" && "✅ "}
            {t.type === "warning" && "⚠️ "}
            {t.type === "info" && "ℹ️ "}
            {t.message}
          </div>
        ))}
      </div>

      {confirmState && (
        <div style={overlayStyle}>
          <div style={confirmBoxStyle}>
            <p style={{ marginTop: 0, fontSize: 16, color: "#1e293b" }}>
              {confirmState.message}
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button style={cancelStyle} onClick={() => handleConfirm(false)}>
                Annuler
              </button>
              <button style={okStyle} onClick={() => handleConfirm(true)}>
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </NotifyContext.Provider>
  );
}

export function useNotify() {
  return useContext(NotifyContext);
}

const toasterStyle = {
  position: "fixed",
  bottom: 24,
  right: 24,
  display: "flex",
  flexDirection: "column",
  gap: 10,
  zIndex: 9999,
  maxWidth: 360,
  pointerEvents: "none",
};

function toastItemStyle(type) {
  const palette = {
    success: { background: "#16a34a", color: "white" },
    error:   { background: "#dc2626", color: "white" },
    warning: { background: "#d97706", color: "white" },
    info:    { background: "#2563eb", color: "white" },
  };
  return {
    padding: "13px 18px",
    borderRadius: 14,
    fontWeight: "bold",
    fontSize: 14,
    lineHeight: 1.4,
    boxShadow: "0 6px 20px rgba(0,0,0,.25)",
    pointerEvents: "auto",
    ...(palette[type] || palette.info),
  };
}

const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 10000,
  padding: 20,
};

const confirmBoxStyle = {
  background: "white",
  borderRadius: 20,
  padding: "28px 30px",
  maxWidth: 380,
  width: "100%",
  boxShadow: "0 20px 60px rgba(0,0,0,.3)",
};

const cancelStyle = {
  background: "#f1f5f9",
  color: "#334155",
  border: "none",
  padding: "11px 22px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: 14,
};

const okStyle = {
  background: "#dc2626",
  color: "white",
  border: "none",
  padding: "11px 22px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: 14,
};
