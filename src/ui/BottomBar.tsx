import React, { useEffect, useState } from "react";

/** Same brand color as TopBar */
const BRAND = "#264E7A";

export default function BottomBar() {
  const [now, setNow] = useState<Date>(new Date());
  const [online, setOnline] = useState<boolean>(navigator.onLine);
  const [lastSync, setLastSync] = useState<string>("—");

  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);

    const readSync = () => {
      const iso = localStorage.getItem("innovue_last_sync");
      if (iso) {
        try {
          const d = new Date(iso);
          setLastSync(
            d.toLocaleString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })
          );
        } catch { setLastSync("—"); }
      } else setLastSync("—");
    };
    readSync();
    const syncPoll = setInterval(readSync, 1000);

    return () => {
      clearInterval(clock);
      clearInterval(syncPoll);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const wrap: React.CSSProperties = {
    position: "sticky",
    bottom: 0,
    zIndex: 10,
    width: "100%",
    background: BRAND,
    color: "#fff",
    boxShadow: "0 -2px 10px rgba(0,0,0,0.05)",
    paddingBottom: "env(safe-area-inset-bottom)"
  };

  const inner: React.CSSProperties = {
    maxWidth: 1152,
    margin: "0 auto",
    padding: "10px 16px",
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    gap: 12
  };

  const left: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#fff" };
  const center: React.CSSProperties = { display: "flex", justifyContent: "center", gap: 8 };
  const right: React.CSSProperties = { display: "flex", justifyContent: "flex-end", gap: 10, alignItems: "center", fontSize: 13, color: "#fff" };

  const btn: React.CSSProperties = {
    appearance: "none",
    border: "1px solid rgba(255,255,255,0.45)",
    background: "rgba(255,255,255,0.15)",
    color: "#fff",
    fontWeight: 700,
    borderRadius: 10,
    padding: "10px 14px",
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
    backdropFilter: "blur(2px)"
  };

  const chip: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.35)",
    background: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    padding: "6px 10px",
    color: "#fff"
  };

  return (
    <footer style={wrap}>
      <div style={inner}>
        {/* Left */}
        <div style={left}>
          <span>Auto‑refresh every 1 minute</span>
          <span>•</span>
          <span>Last Sync: {lastSync}</span>
        </div>

        {/* Center buttons */}
        <div style={center}>
          <button style={btn} onClick={() => window.location.reload()} title="Refresh now">Refresh</button>
          <button style={btn} onClick={() => alert("Inventory — placeholder")} title="Inventory">Inventory</button>
          <button style={btn} onClick={() => alert("Log Book — placeholder")} title="Log Book">Log Book</button>
        </div>

        {/* Right */}
        <div style={right}>
          <span style={chip}>
            {now.toLocaleString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
          <span style={chip}>{online ? "Online" : "Offline"}</span>
        </div>
      </div>
    </footer>
  );
}