import React from "react";
import { createRoot } from "react-dom/client";
import { CatPage } from "./pages/cat/CatPage";
import { DashboardPage } from "./pages/dashboard/DashboardPage";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

createRoot(root).render(
  <React.StrictMode>
    {window.location.hash === "#/cat" ? <CatPage /> : <DashboardPage />}
  </React.StrictMode>,
);
