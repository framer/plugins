import "./globals.css";

import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App.tsx";
import { framer } from "framer-plugin";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element not found");
}

void framer.showUI({
  position: "top right",
  width: 260,
  height: 500,
  resizable: "height",
  title: "Remix Icons",
});

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
