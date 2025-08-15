// src/App.tsx
import React from "react";
import Dashboard from "./Dashboard";

// If you have these (you did earlier), keep the imports.
// If you don't, you can comment them out temporarily.
import TopBar from "./ui/TopBar";
import BottomBar from "./ui/BottomBar";

// Optional global styles (safe to leave even if the file doesn't exist)
import "./styles.css";

export default function App() {
  return (
    <div style={{ background: "#121314", minHeight: "100vh" }}>
      {/* Top navigation / logos / weather */}
      <TopBar />

      {/* Main dashboard */}
      <Dashboard />

      {/* Bottom actions/status bar */}
      <BottomBar />
    </div>
  );
}