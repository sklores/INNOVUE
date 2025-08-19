import React, { useEffect, useMemo, useRef, useState } from "react";
import { API_KEY, SPREADSHEET_ID, SHEET_NAME } from "../lib/sheets";

/** Weather for DC (20006-ish) */
const LAT = 38.9;
const LON = -77.04;

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

const asNumber = (x: unknown) => {
  if (x == null) return null;
  let s = String(x).trim();
  const parenNeg = /^\s*\(.*\)\s*$/.test(s);
  if (parenNeg) s = s.replace(/[()]/g, "");
  s = s.replace(/\$/g, "").replace(/,/g, "").replace(/[^\d.\-]/g, "");
  if (!s || s === "-" || s === "." || s === "-.") return null;
  const n = Number(s);
  return Number.isFinite(n) ? (parenNeg ? -n : n) : null;
};

/** Build a sine wave path to fill under a curve */
function buildWavePath({
  width, height, amp, baseline, period = 200, step = 10,
}: { width: number; height: number; amp: number; baseline: number; period?: number; step?: number; }) {
  const pts: string[] = [];
  pts.push(`M 0 ${baseline}`);
  for (let x = 0; x <= width + step; x += step) {
    const y = baseline + amp * Math.sin((2 * Math.PI * x) / period);
    pts.push(`L ${x} ${y.toFixed(2)}`);
  }
  pts.push(`L ${width} ${height}`, `L 0 ${height} Z`);
  return pts.join(" ");
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
          if (!cancelled) setSrc(url);
          break;
        } catch {}
      }
    })();
    return () => { cancelled = true; };
  }, [list]);
  return src;
}

/** Big sun / moon */
const BigSun = ({ size = 56 }: { size?: number }) => (
  <svg
    className="sun spin"
    width={size} height={size} viewBox="0 0 64 64" aria-hidden
    style={{ filter: "drop-shadow(0 3px 8px rgba(255,190,50,.6))" }}
  >
    <defs>
      <radialGradient id="sunCore" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#FFE58A" />
        <stop offset="60%" stopColor="#FFC94A" />
        <stop offset="100%" stopColor="#FFB120" />
      </radialGradient>
    </defs>
    <circle cx="32" cy="32" r="14" fill="url(#sunCore)" />
    {[...Array(12)].map((_, i) => {
      const a = (i * Math.PI * 2) / 12;
      const x1 = 32 + Math.cos(a) * 20;
      const y1 = 32 + Math.sin(a) * 20;
      const x2 = 32 + Math.cos(a) * 28;
      const y2 = 32 + Math.sin(a) * 28;
      return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#FFD467" strokeWidth="3" strokeLinecap="round" />;
    })}
  </svg>
);

const BigMoon = ({ size = 56 }: { size?: number }) => (
  <svg
    className="moon bob"
    width={size} height={size} viewBox="0 0 64 64" aria-hidden
    style={{ filter: "drop-shadow(0 3px 8px rgba(150,180,255,.55))" }}
  >
    <defs>
      <radialGradient id="moonCore" cx="35%" cy="35%" r="70%">
        <stop offset="0%" stopColor="#F0F4FF" />
        <stop offset="70%" stopColor="#C9D2F6" />
        <stop offset="100%" stopColor="#B0BCEB" />
      </radialGradient>
    </defs>
    <path d="M42 50a18 18 0 1 1-14-32 16 16 0 1 0 14 32z" fill="url(#moonCore)" />
    <circle cx="28" cy="30" r="3" fill="#AAB6E4" opacity=".6" />
    <circle cx="36" cy="38" r="2.5" fill="#AAB6E4" opacity=".6" />
    <circle cx="23" cy="40" r="2" fill="#AAB6E4" opacity=".5" />
  </svg>
);

export default function TopBar() {
  const [wx, setWx] = useState<{ temp: number; label: string; time: string } | null>(null);

  // images
  const venueLogo = "/gcdc.jpg";
  const innovueLogo = useFirstWorkingImage([
    "/innovue.svg", "/innovue.png", "/innovue-logo.png",
    "/assets/innovue.svg", "/assets/innovue.png",
  ]);

  // wave state
  const [amp, setAmp] = useState(12);
  const [period, setPeriod] = useState(220);
  const barRef = useRef<HTMLDivElement | null>(null);
  const [barW, setBarW] = useState(1200);
  const [barH, setBarH] = useState(104);

  // Day / night
  const [isDay, setIsDay] = useState<boolean>(() => {
    const h = new Date().getHours();
    return h >= 6 && h < 18;
  });
  useEffect(() => {
    const t = setInterval(() => {
      const h = new Date().getHours();
      setIsDay(h >= 6 && h < 18);
    }, 60_000);
    return () => clearInterval(t);
  }, []);

  // weather
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
      } catch { if (alive) setWx(null); }
    })();
    return () => { alive = false; };
  }, []);

  // sales -> wave amplitude
  useEffect(() => {
    let alive = true;
    const encoded = encodeURIComponent(`${SHEET_NAME}!A2:D2`);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encoded}?key=${API_KEY}`;
    (async () => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error("Sheets fetch failed");
        const json = await res.json();
        const r: string[] = (json.values && json.values[0]) || [];
        const sales = asNumber(r[1]) ?? 0;   // B2
        const green = asNumber(r[2]) ?? 100; // C2
        const red = asNumber(r[3]) ?? 0;     // D2
        const denom = (green - red) || 1;
        let t = (sales - red) / denom; // 0=red, 1=green
        t = Math.max(0, Math.min(1, t));
        const eased = 1 - Math.pow(1 - t, 2);
        const minAmp = 7, maxAmp = 30;
        const nextAmp = Math.round(minAmp + eased * (maxAmp - minAmp));
        const nextPeriod = 180 + Math.round((1 - t) * 90);
        if (alive) { setAmp(nextAmp); setPeriod(nextPeriod); }
      } catch {}
    })();
    return () => { alive = false; };
  }, []);

  // resize
  useEffect(() => {
    const recalc = () => {
      if (!barRef.current) return;
      const rect = barRef.current.getBoundingClientRect();
      setBarW(Math.max(600, Math.round(rect.width)));
      setBarH(Math.round(rect.height));
    };
    recalc();
    const ro = new ResizeObserver(recalc);
    if (barRef.current) ro.observe(barRef.current);
    window.addEventListener("resize", recalc);
    return () => { ro.disconnect(); window.removeEventListener("resize", recalc); };
  }, []);

  const baseline = Math.max(54, Math.min(80, Math.round(barH * 0.66)));
  const pathBack  = buildWavePath({ width: barW * 2, height: barH, amp, baseline, period });
  const pathFront = buildWavePath({ width: barW * 2, height: barH, amp: Math.max(5, amp - 4), baseline: baseline + 5, period: period * 0.9 });

  const css = `
    .topbar {
      position: relative;
      background: #2A5376;
      color:#fff;
      width:100%;
      height: 104px;
      display:flex; align-items:center;
      overflow:hidden;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    @media (max-width: 640px) { .topbar { height: 96px; } }

    .wave-wrap { position:absolute; inset:0; pointer-events:none; overflow:hidden; }
    .wave-svg { position:absolute; top:0; left:0; width:200%; height:100%; animation: waveSlide 18s linear infinite; }
    .wave-svg.front { animation-duration: 12s; opacity: .9; }
    @keyframes waveSlide { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }

    .topbar-grid {
      position:relative; z-index:2;
      width:100%; max-width:1200px; margin:0 auto;
      padding: 6px 12px 2px;
      display:grid;
      grid-template-columns: 1fr auto 1fr;
      align-items:end; gap:12px;
    }

    .brand { display:flex; align-items:center; gap:10px; min-width:0; }
    .brand img { width:38px; height:38px; border-radius:8px; object-fit:cover; }
    .brand-name { font-weight:800; line-height:1.05; font-size: clamp(14px, 4.2vw, 20px); white-space:nowrap; text-shadow: 0 1px 2px rgba(0,0,0,.35); }

    .center-logo { display:flex; align-items:center; justify-content:center; }
    .center-logo img { height: clamp(70px, 12vw, 100px); width:auto; filter: drop-shadow(0 2px 6px rgba(0,0,0,.25)); }

    .right { display:flex; align-items:flex-end; justify-content:flex-end; gap:10px; min-width:0; }
    .sky { align-self:flex-start; margin-top:-12px; }
    .spin { animation: spin 40s linear infinite; transform-origin: 50% 50%; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .bob { animation: bob 4.6s ease-in-out infinite; transform-origin: 50% 50%; }
    @keyframes bob { 0% { transform: translateY(0px); } 50% { transform: translateY(-6px); } 100% { transform: translateY(0px); } }

    .wx { text-align:right; display:flex; flex-direction:column; gap:2px; min-width:0;
          font-size: clamp(11px, 2.7vw, 14px); text-shadow: 0 1px 2px rgba(0,0,0,.35);
          align-self:flex-end; margin-bottom:2px; }
    .wx .line1 { font-weight:800; }

    /* tighten the gap below the bar */
    .afterTopBar { height: 8px; }
  `;

  return (
    <>
      <div className="topbar" ref={barRef}>
        <style>{css}</style>

        {/* Waves */}
        <div className="wave-wrap" aria-hidden>
          <svg className="wave-svg back" viewBox={`0 0 ${barW * 2} ${barH}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id="grad-back" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#244B6B" />
                <stop offset="100%" stopColor="#1E3F59" />
              </linearGradient>
            </defs>
            <path d={pathBack} fill="url(#grad-back)" />
          </svg>
          <svg className="wave-svg front" viewBox={`0 0 ${barW * 2} ${barH}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id="grad-front" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2E5E85" />
                <stop offset="100%" stopColor="#254C6B" />
              </linearGradient>
            </defs>
            <path d={pathFront} fill="url(#grad-front)" />
          </svg>
        </div>

        {/* Foreground */}
        <div className="topbar-grid">
          {/* Left */}
          <div className="brand">
            <img src={venueLogo} alt="Venue" />
            <div className="brand-name">GCDC</div>
          </div>

          {/* Center */}
          <div className="center-logo">
            {innovueLogo ? <img src={innovueLogo} alt="InnoVue" /> : <div style={{height:80,width:80}} />}
          </div>

          {/* Right */}
          <div className="right">
            <div className="sky" aria-hidden>{isDay ? <BigSun /> : <BigMoon />}</div>
            <div className="wx">
              <div className="line1">{wx ? `${wx.temp}°F ${wx.label}` : "—"}</div>
              <div className="line2">{wx ? wx.time : ""}</div>
            </div>
          </div>
        </div>
      </div>

      {/* small spacer, tighter than before */}
      <div className="afterTopBar" />
    </>
  );
}