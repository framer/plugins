import "./globals.css";

import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App.tsx";
import { framer } from "@framerjs/plugin-api";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element not found");
}

import.meta.hot?.dispose(() => {
  void framer.closePlugin();
});

void framer.showUI({
  position: "top left",
  width: 240,
  height: 9000,
  resizable: true,
});

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
