import React, { useEffect, useMemo, useState } from "react";

/** Open‑Meteo (no API key) for ZIP 20006 (approx lat/lon) */
const LAT = 38.900;
const LON = -77.040;

function labelFromCode(code: number): string {
  const map: Record<number, string> = {
    0: "Clear", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Fog",
    51: "Drizzle", 53: "Drizzle", 55: "Drizzle",
    61: "Rain", 63: "Rain", 65: "Heavy rain",
    71: "Snow", 73: "Snow", 75: "Snow",
    80: "Showers", 81: "Showers", 82: "Showers",
  };
  return map[code] ?? "—";
}

/** Probe a list of image URLs; use the first that loads */
function useFirstWorkingImage(candidates: string[]): string | null {
  const [src, setSrc] = useState<string | null>(null);
  const list = useMemo(() => candidates.filter(Boolean), [candidates]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const url of list) {
        try {
          await new Promise<void>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = reject;
            img.src = url;
          });
          if (!cancelled) {
            setSrc(url);
          }
          break;
        } catch {
          /* try next */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [list]);

  return src;
}

export default function TopBar() {
  const [wx, setWx] = useState<{ temp: number; label: string; time: string } | null>(null);

  // Venue logo: you said it's public/gcdc.jpg ➜ reference as /gcdc.jpg
  const venueLogo = "/gcdc.jpg";

  // InnoVue logo fallbacks (pick whichever exists in your repo)
  const innovueLogo = useFirstWorkingImage([
    "/innovue.svg",
    "/innovue.png",
    "/innovue-logo.png",
    "/assets/innovue.svg",
    "/assets/innovue.png",
  ]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=auto`;
        const r = await fetch(url);
        const j = await r.json();
        if (!alive) return;
        const temp = Math.round(j.current.temperature_2m);
        const label = labelFromCode(Number(j.current.weather_code));
        const time = new Date().toLocaleString(undefined, {
          weekday: "short",
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
        setWx({ temp, label, time });
      } catch {
        if (alive) setWx(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const css = `
    .topbar {
      background:#2A5376;            /* lighthouse blue */
      color:#fff;
      width:100%;
      padding: 6px 12px;              /* keep bar height tight */
    }
    .topbar-grid {
      display:grid;
      grid-template-columns: 1fr auto 1fr;  /* left | center | right */
      align-items:center;
      gap:12px;
      max-width:1200px;
      margin:0 auto;
    }

    /* Left: venue brand */
    .brand {
      display:flex; align-items:center; gap:10px; min-width:0;
    }
    .brand img {
      width:36px; height:36px; border-radius:8px; object-fit:cover; flex:0 0 auto;
    }
    .brand-name {
      font-weight:700;
      line-height:1.05;
      font-size: clamp(13px, 3.3vw, 18px);
      word-break:break-word;
    }

    /* Center: InnoVue lighthouse — bigger & crisp without raising bar height */
    .center-logo { display:flex; align-items:center; justify-content:center; }
    .center-logo img {
      height: clamp(68px, 11vw, 96px);  /* larger range than before */
      width:auto;
      border-radius:14px;               /* subtle rounding if PNG has a box */
      background: transparent;          /* no heavy white tile */
      padding:0;                        /* let the image breathe */
      filter: drop-shadow(0 2px 6px rgba(0,0,0,.25));
      image-rendering: -webkit-optimize-contrast;
      image-rendering: crisp-edges;
    }

    /* Right: weather/time */
    .wx {
      text-align:right; display:flex; flex-direction:column; gap:2px; min-width:0;
      font-size: clamp(11px, 2.6vw, 14px);
    }
    .wx .line1 { font-weight:700; }

    /* Ultra-narrow phones: keep center dominant */
    @media (max-width: 420px) {
      .brand-name { display:none; }           /* hide text, keep icon */
      .brand img { width:32px; height:32px; }
      .wx { font-size: 12px; }
    }
  `;

  return (
    <div className="topbar">
      <style>{css}</style>
      <div className="topbar-grid">
        {/* Left */}
        <div className="brand">
          <img src={venueLogo} alt="Venue" />
          <div className="brand-name">Grilled Cheese Bar</div>
        </div>

        {/* Center */}
        <div className="center-logo">
          {innovueLogo ? (
            <img src={innovueLogo} alt="InnoVue" />
          ) : (
            <div style={{ height: 80, width: 80 }} />
          )}
        </div>

        {/* Right */}
        <div className="wx">
          <div className="line1">{wx ? `${wx.temp}°F ${wx.label}` : "—"}</div>
          <div className="line2">{wx ? wx.time : ""}</div>
        </div>
      </div>
    </div>
  );
}
