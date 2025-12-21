import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "@radix-ui/themes/styles.css";
import { Theme } from "@radix-ui/themes";

const container = document.getElementById("root");
if (!container) throw new Error("Root container missing");

createRoot(container).render(
  <React.StrictMode>
    <Theme appearance="dark" accentColor="violet" grayColor="slate" radius="large">
      <App />
    </Theme>
  </React.StrictMode>,
);
