import React, { useEffect, useMemo, useState } from "react";
import { API_KEY, SPREADSHEET_ID, SHEET_NAME } from "./lib/sheets";

/**
 * Read A2:G17:
 * - KPIs (9 tiles) from rows: 0..5, 8, 9, 10  => A2..A7, A10..A12
 *   For each KPI row, we use:
 *     A = label, B = value, C = greenAt, D = redAt, F = unit
 * - Marquee text:
 *     B8  = rows[6][1]  (Questions)
 *     B9  = rows[7][1]  (Reviews)
 *     B15 = rows[13][1] (Banking)
 *     B16 = rows[14][1] (Social)
 *     B17 = rows[15][1] (News)
 * - Speed control: G12 = rows[10][6] (1–100; higher = slower)
 */
const RANGE_LOCAL = "A2:G17";

type LoadState = "idle" | "loading" | "ok" | "error";

const CONFIG = {
  fallbackLabels: [
    "Tile 1",
    "Tile 2",
    "Tile 3",
    "Tile 4",
    "Tile 5",
    "Tile 6",
    "Tile 7",
    "Tile 8",
    "Tile 9",
  ],
  defaultGreenAt: 100,
  defaultRedAt: 0,
};

function apiUrl() {
  const encoded = encodeURIComponent(`${SHEET_NAME}!${RANGE_LOCAL}`);
  return `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encoded}?key=${API_KEY}`;
}

const asNumber = (x: unknown) => {
  if (x == null) return null;
  let s = String(x).trim();
  if (!s || s === "—" || s === "--") return null;
  const isPercent = s.includes("%");
  let negative = false;
  if (/^\s*\(.*\)\s*$/.test(s)) {
    negative = true;
    s = s.replace(/[()]/g, "");
  }
  s = s.replace(/\$/g, "").replace(/,/g, "").replace(/[^\d.\-]/g, "");
  if (!s || s === "-" || s === "." || s === "-.") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n * 1 + (isPercent ? 0 : 0);
};

function valueToColorByTargets(value: number | null, greenAt: number, redAt: number) {
  if (value == null) return "#5b5b5b";
  const G = Number.isFinite(greenAt) ? greenAt : CONFIG.defaultGreenAt;
  const R = Number.isFinite(redAt) ? redAt : CONFIG.defaultRedAt;
  const denom = G - R;
  let t = denom === 0 ? 0.5 : (value - R) / denom;
  t = Math.max(0, Math.min(1, t));
  const hue = t * 120; // 0 red -> 120 green
  return `hsl(${hue}, 70%, 45%)`;
}

/** Format per unit token from col F: "$", "%", or blank */
function formatByUnit(n: number | null, unitToken?: string) {
  if (n == null) return "—";
  const u = (unitToken || "").trim();
  if (u === "$" || u.toLowerCase() === "usd" || u.toLowerCase() === "dollar") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);
  }
  if (u === "%") {
    return `${Math.round(n)}%`;
  }
  // default = plain integer (no decimals)
  return String(Math.round(n));
}

/** Single smooth marquee (no long pause; slower by default). */
function Marquee({ text, speedSec = 60 }: { text: string; speedSec?: number }) {
  if (!text?.trim()) return null;

  const styleTag = `
    @keyframes innovue_marquee_loop {
      0%   { transform: translateX(0%); }
      100% { transform: translateX(-100%); }
    }
  `;

  // We render two identical lanes back-to-back for seamless scroll
  const shell: React.CSSProperties = {
    marginTop: 12,
    borderRadius: 14,
    background: "#0d2a48",
    color: "#fff",
    boxShadow: "0 2px 10px rgba(0,0,0,0.18)",
    overflow: "hidden",
  };

  const trackWrap: React.CSSProperties = {
    position: "relative",
    overflow: "hidden",
    padding: "12px 0",
  };

  const lane: React.CSSProperties = {
    display: "inline-block",
    whiteSpace: "nowrap",
    paddingRight: "80px",
    fontSize: 16,
    fontWeight: 600,
    letterSpacing: 0.2,
  };

  const scroller: React.CSSProperties = {
    display: "inline-block",
    whiteSpace: "nowrap",
    willChange: "transform",
    animation: `innovue_marquee_loop ${speedSec}s linear infinite`,
  };

  return (
    <div style={shell}>
      <style>{styleTag}</style>
      <div style={trackWrap}>
        <div style={scroller}>
          <span style={lane}>{text}</span>
          <span style={lane}>{text}</span>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [status, setStatus] = useState<LoadState>("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // KPI state
  const [labels, setLabels] = useState<string[]>(CONFIG.fallbackLabels);
  const [values, setValues] = useState<(number | null)[]>(Array(9).fill(null));
  const [greens, setGreens] = useState<number[]>(
    Array(9).fill(CONFIG.defaultGreenAt)
  );
  const [reds, setReds] = useState<number[]>(Array(9).fill(CONFIG.defaultRedAt));
  const [units, setUnits] = useState<string[]>(Array(9).fill("")); // <-- from column F
  const [errors, setErrors] = useState<(string | null)[]>(Array(9).fill(null));

  // Default: ALL options selected
  const [pick, setPick] = useState({
    questions: true,
    reviews: true,
    banking: true,
    social: true,
    news: true,
  });

  const togglePick = (k: keyof typeof pick) =>
    setPick((p) => ({ ...p, [k]: !p[k] }));

  // Loaded marquee texts
  const [mqTexts, setMqTexts] = useState({
    questions: "",
    reviews: "",
    banking: "",
    social: "",
    news: "",
  });

  // Marquee speed seconds (from G12 1–100; higher => slower)
  const [marqueeSec, setMarqueeSec] = useState<number>(80);

  function buildUrl() {
    const encoded = encodeURIComponent(`${SHEET_NAME}!${RANGE_LOCAL}`);
    return `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encoded}?key=${API_KEY}`;
  }

  async function load() {
    try {
      setStatus("loading");
      setStatusMsg("");

      const res = await fetch(buildUrl(), { cache: "no-store" });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = await res.json();
          if (j?.error?.message) msg += ` — ${j.error.message}`;
        } catch {}
        throw new Error(msg);
      }

      const json = await res.json();
      const rows: string[][] = json.values || [];

      // KPI indices (0-based from A2)
      const kpiIdx = [0, 1, 2, 3, 4, 5, 8, 9, 10];

      const nextLabels: string[] = [];
      const nextValues: (number | null)[] = [];
      const nextGreens: number[] = [];
      const nextReds: number[] = [];
      const nextUnits: string[] = [];
      const nextErrors: (string | null)[] = [];

      for (let out = 0; out < 9; out++) {
        const r = rows[kpiIdx[out]] || [];
        const label = (r[0] ?? "").toString().trim();
        const val = asNumber(r[1]);
        const gAt = asNumber(r[2]);
        const rAt = asNumber(r[3]);
        const unit = (r[5] ?? "").toString().trim(); // <-- column F

        nextLabels.push(label || CONFIG.fallbackLabels[out]);
        nextValues.push(val);
        nextGreens.push((gAt as number) ?? CONFIG.defaultGreenAt);
        nextReds.push((rAt as number) ?? CONFIG.defaultRedAt);
        nextUnits.push(unit);
        nextErrors.push(val == null ? "API error" : null);
      }

      // Marquee text
      const safe = (ri: number) =>
        (rows[ri] && rows[ri][1] ? String(rows[ri][1]) : "") as string;

      setMqTexts({
        questions: safe(6),   // B8
        reviews: safe(7),     // B9
        banking: safe(13),    // B15
        social: safe(14),     // B16
        news: safe(15),       // B17
      });

      // Speed from G12 (rows[10][6]) mapped to very slow default
      let raw = rows[10]?.[6] ?? "";
      const ctl = Math.max(1, Math.min(100, Number(String(raw).replace(/[^\d.-]/g, "")) || 70));
      // Map 1..100 -> 40s..140s (higher = slower)
      const speedSec = 40 + (ctl / 100) * 100;
      setMarqueeSec(speedSec);

      setLabels(nextLabels);
      setValues(nextValues);
      setGreens(nextGreens);
      setReds(nextReds);
      setUnits(nextUnits);
      setErrors(nextErrors);
      setStatus("ok");
      setLastSync(new Date());
    } catch (e: any) {
      setStatus("error");
      setStatusMsg(String(e?.message || e));
      setErrors(Array(9).fill("API error"));
    }
  }

  // Initial load only (no auto-refresh).
  useEffect(() => {
    load();
  }, []);

  const marqueeCombined = useMemo(() => {
    const parts: string[] = [];
    if (pick.questions && mqTexts.questions?.trim()) parts.push(mqTexts.questions.trim());
    if (pick.reviews && mqTexts.reviews?.trim()) parts.push(mqTexts.reviews.trim());
    if (pick.banking && mqTexts.banking?.trim()) parts.push(mqTexts.banking.trim());
    if (pick.social && mqTexts.social?.trim()) parts.push(mqTexts.social.trim());
    if (pick.news && mqTexts.news?.trim()) parts.push(mqTexts.news.trim());
    return parts.join("   •   ");
  }, [pick, mqTexts]);

  // ———————————————— styles ————————————————
  const styles = {
    sectionTitle: {
      display: "flex",
      alignItems: "baseline",
      gap: 12,
      fontSize: 28,
      fontWeight: 800,
      color: "#fff",
      margin: "16px 0 8px",
    } as React.CSSProperties,
    status: {
      color: "#9bb0c0",
      fontSize: 12,
      fontWeight: 600,
    } as React.CSSProperties,
    btn: {
      padding: "8px 12px",
      borderRadius: 10,
      background: "#214b77",
      color: "#fff",
      fontWeight: 700,
      border: "none",
      cursor: "pointer",
    } as React.CSSProperties,
    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      gap: 16,
    } as React.CSSProperties,
    card: {
      background: "linear-gradient(#2b2b2b, #252525)",
      borderRadius: 16,
      padding: 14,
      boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
      color: "#ddd",
    } as React.CSSProperties,
    kpiBar: (color: string) =>
      ({
        background: color,
        color: "#fff",
        height: 70,
        borderRadius: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        fontSize: 26,
        letterSpacing: 0.3,
      }) as React.CSSProperties,
    kpiTitle: { fontSize: 13, fontWeight: 800, color: "#cfd5da", marginBottom: 8 },
    targets: { marginTop: 10, fontSize: 12, color: "#a0a6ac" },
    err: { marginTop: 6, fontSize: 12, color: "#ff6868", fontWeight: 600 },
    chooserRow: {
      marginTop: 20,
      display: "flex",
      gap: 14,
      alignItems: "center",
      flexWrap: "wrap" as const,
      background: "rgba(255,255,255,0.04)",
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.06)",
    },
    chooseLabel: { color: "#d9e2ea", fontWeight: 700, marginRight: 6 } as React.CSSProperties,
    chk: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 10px",
      background: "rgba(255,255,255,0.06)",
      borderRadius: 8,
      border: "1px solid rgba(255,255,255,0.08)",
      color: "#e9f0f6",
      fontSize: 13,
      fontWeight: 600,
      cursor: "pointer",
      userSelect: "none" as const,
    },
  };

  return (
    <div style={{ padding: 16 }}>
      {/* Header */}
      <div style={styles.sectionTitle as React.CSSProperties}>
        InnoVue Dashboard
        <span style={styles.status}>
          {status === "loading" && "Syncing…"}
          {status === "ok" && `Status: Live • Last Sync: ${lastSync?.toLocaleTimeString() ?? "—"}`}
          {status === "error" && `Status: Error — ${statusMsg}`}
        </span>
        <button style={styles.btn} onClick={load}>Refresh</button>
      </div>

      {/* KPI grid (3x3) */}
      <div style={styles.grid}>
        {labels.slice(0, 9).map((label, i) => {
          const color = valueToColorByTargets(
            values[i],
            greens[i] ?? CONFIG.defaultGreenAt,
            reds[i] ?? CONFIG.defaultRedAt
          );
          const shown = formatByUnit(values[i], units[i]);
          return (
            <div key={i} style={styles.card}>
              <div style={styles.kpiTitle}>{label.toUpperCase()}</div>
              <div style={styles.kpiBar(color)}>{shown}</div>
              <div style={styles.targets}>
                Green at: {greens[i] ?? CONFIG.defaultGreenAt} • Red at:{" "}
                {reds[i] ?? CONFIG.defaultRedAt}
              </div>
              {errors[i] && <div style={styles.err}>{errors[i]}</div>}
            </div>
          );
        })}
      </div>

      {/* Chooser row (below KPIs, above marquee) */}
      <div style={styles.chooserRow}>
        <span style={styles.chooseLabel}>Marquee includes:</span>

        <label style={styles.chk} onClick={() => togglePick("questions")}>
          <input type="checkbox" checked={pick.questions} onChange={() => {}} />
          Questions
        </label>

        <label style={styles.chk} onClick={() => togglePick("reviews")}>
          <input type="checkbox" checked={pick.reviews} onChange={() => {}} />
          Reviews
        </label>

        <label style={styles.chk} onClick={() => togglePick("banking")}>
          <input type="checkbox" checked={pick.banking} onChange={() => {}} />
          Banking
        </label>

        <label style={styles.chk} onClick={() => togglePick("social")}>
          <input type="checkbox" checked={pick.social} onChange={() => {}} />
          Social
        </label>

        <label style={styles.chk} onClick={() => togglePick("news")}>
          <input type="checkbox" checked={pick.news} onChange={() => {}} />
          News
        </label>
      </div>

      {/* Single seamless marquee (slow; speed from G12) */}
      <Marquee text={marqueeCombined} speedSec={marqueeSec} />
    </div>
  );
}