import "framer-plugin/framer.css";
import "./reset.css";

import App from "./app.svelte";
import { framer } from "framer-plugin";
import { mount } from "svelte";

// Expose framer on the global scope for testing.
(window as any).framer = framer;

void framer.showUI({
  position: "top right",
  width: 260,
  height: 450,
  minWidth: 260,
  minHeight: 450,
  resizable: true,
});

const app = mount(App, {
  target: document.getElementById("app")!,
});

export default app;
