import React from "react";
import { createRoot } from "react-dom/client";
import { CatWindow } from "./features/cat/CatWindow";
import { Dashboard } from "./features/dashboard/Dashboard";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

createRoot(root).render(
  <React.StrictMode>
    {window.location.hash === "#/cat" ? <CatWindow /> : <Dashboard />}
  </React.StrictMode>,
);
