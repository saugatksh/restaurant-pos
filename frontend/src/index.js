import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import './pages/responsive.css';
import Main from "./Main";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<React.StrictMode><Main /></React.StrictMode>);

// Register Service Worker for offline-first support
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => console.log("SW registered:", reg.scope))
      .catch((err) => console.warn("SW registration failed:", err));
  });
}
