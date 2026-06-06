import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { NotifyProvider } from "./contexts/NotifyContext.jsx";

// Enregistrement du Service Worker (PWA)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <NotifyProvider>
      <App />
    </NotifyProvider>
  </React.StrictMode>
);