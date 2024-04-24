import "./globals.css";

import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App.tsx";
import { framer } from "framer-plugin";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

import.meta.hot?.dispose(() => {
  void framer.closePlugin();
});

void framer.showUI({
  title: "Get Colors",
  position: "top right",
  width: 240,
  height: 120,
});

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
