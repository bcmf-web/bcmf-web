import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { NotifyProvider } from "./contexts/NotifyContext.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <NotifyProvider>
      <App />
    </NotifyProvider>
  </React.StrictMode>
);