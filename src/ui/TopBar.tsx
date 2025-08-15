import React, { useEffect, useState } from "react";

/** Brand color (Innovue lighthouse blue‑purple) */
const BRAND = "#264E7A";

/** Approx lat/lon for ZIP 20006 (DC) */
const LAT = 38.900;
const LON = -77.040;

function labelFromCode(code: number): string {
  const map: Record<number, string> = {
    0: "Clear", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Fog", 51: "Drizzle", 53: "Drizzle", 55: "Drizzle",
    61: "Rain", 63: "Rain", 65: "Heavy rain",
    71: "Snow", 73: "Snow", 75: "Heavy snow",
    95: "Thunderstorm"
  };
  return map[code] ?? "—";
}

export default function TopBar() {
  const [tempF, setTempF] = useState<number | null>(null);
  const [desc, setDesc] = useState<string>("—");
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`;
    fetch(url).then(r => r.json()).then(j => {
      const t = j?.current?.temperature_2m;
      const wc = j?.current?.weather_code;
      if (typeof t === "number") setTempF(Math.round(t));
      if (typeof wc === "number") setDesc(labelFromCode(wc));
    }).catch(() => {});
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const container: React.CSSProperties = {
    position: "sticky",
    top: 0,
    zIndex: 10,
    width: "100%",
    background: BRAND,
    color: "#fff"
  };

  const inner: React.CSSProperties = {
    maxWidth: 1152,
    margin: "0 auto",
    padding: "16px 20px",
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    gap: 16
  };

  const left: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, minWidth: 0 };
  const center: React.CSSProperties = { textAlign: "center" };
  const right: React.CSSProperties = { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, fontSize: 14 };

  const brandTxt: React.CSSProperties = { fontWeight: 700, letterSpacing: 0.2, color: "#fff" };
  const logo: React.CSSProperties = { height: 96, width: 96, objectFit: "contain", borderRadius: 12 };

  return (
    <header style={container}>
      <div style={inner}>
        <div style={left}>
          <img src="/gcdc.jpg" alt="GCDC Logo" height={46} width={46} style={{ borderRadius: 8, objectFit: "cover", background: "#fff" }} />
          <div style={brandTxt}>Grilled Cheese Bar</div>
        </div>

        <div style={center}>
          <img src="/innovue.png" alt="Innovue" style={logo} />
        </div>

        <div style={right}>
          <div style={{ fontWeight: 700 }}>{tempF != null ? `${tempF}°F ${desc}` : "—"}</div>
          <div style={{ color: "rgba(255,255,255,0.85)" }}>
            {now.toLocaleString(undefined, { weekday: "short", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      </div>
    </header>
  );
}