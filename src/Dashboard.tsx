import React, { useEffect, useMemo, useState } from "react";
import { API_KEY, SPREADSHEET_ID, SHEET_NAME } from "./lib/sheets";
import SalesPanel from "./panels/SalesPanel";

/** Sheets window: A2:G17 (KPIs from rows 0..5,8,9,10; marquee B8,B9,B15,B16,B17; speed G12) */
const RANGE_LOCAL = "A2:G17";

type LoadState = "idle" | "loading" | "ok" | "error";
type View = "Day" | "Week" | "Month";

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

const asNumber = (x: unknown) => {
  if (x == null) return null;
  let s = String(x).trim();
  if (!s || s === "—" || s === "--") return null;
  const parenNeg = /^\s*\(.*\)\s*$/.test(s);
  if (parenNeg) s = s.replace(/[()]/g, "");
  s = s.replace(/\$/g, "").replace(/,/g, "").replace(/[^\d.\-]/g, "");
  if (!s || s === "-" || s === "." || s === "-.") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return parenNeg ? -n : n;
};

function valueToColorByTargets(
  value: number | null,
  greenAt: number,
  redAt: number
) {
  if (value == null) return "#5b5b5b";
  const G = Number.isFinite(greenAt) ? greenAt : CONFIG.defaultGreenAt;
  const R = Number.isFinite(redAt) ? redAt : CONFIG.defaultRedAt;
  const denom = G - R;
  let t = denom === 0 ? 0.5 : (value - R) / denom;
  t = Math.max(0, Math.min(1, t));
  const hue = t * 120; // 0 red -> 120 green
  return `hsl(${hue}, 70%, 45%)`;
}

/** "$" | "%" | "" — no decimals for $ and plain */
function formatByUnit(n: number | null, unitToken?: string) {
  if (n == null) return "—";
  const u = (unitToken || "").trim().toLowerCase();
  if (u === "$" || u === "usd" || u === "dollar") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);
  }
  if (u === "%") return `${Math.round(n)}%`;
  return String(Math.round(n));
}

/** Single seamless marquee (slow; speed from G12) */
function Marquee({
  text,
  speedSec = 80,
}: {
  text: string;
  speedSec?: number;
}) {
  if (!text?.trim()) return null;
  return (
    <div
      style={{
        marginTop: 12,
        borderRadius: 14,
        background: "#0d2a48",
        color: "#fff",
        boxShadow: "0 2px 10px rgba(0,0,0,0.18)",
        overflow: "hidden",
      }}
    >
      <style>
        {`@keyframes innovue_marquee_loop { 0%{transform:translateX(0%)} 100%{transform:translateX(-100%)} }`}
      </style>
      <div style={{ position: "relative", overflow: "hidden", padding: "12px 0" }}>
        <div
          style={{
            display: "inline-block",
            whiteSpace: "nowrap",
            willChange: "transform",
            animation: `innovue_marquee_loop ${speedSec}s linear infinite`,
          }}
        >
          <span
            style={{
              display: "inline-block",
              paddingRight: 80,
              whiteSpace: "nowrap",
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: 0.2,
            }}
          >
            {text}
          </span>
          <span
            style={{
              display: "inline-block",
              paddingRight: 80,
              whiteSpace: "nowrap",
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: 0.2,
            }}
          >
            {text}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [status, setStatus] = useState<LoadState>("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const [rangeView, setRangeView] = useState<View>("Day");

  // KPI state
  const [labels, setLabels] = useState<string[]>(CONFIG.fallbackLabels);
  const [values, setValues] = useState<(number | null)[]>(
    Array(9).fill(null)
  );
  const [greens, setGreens] = useState<number[]>(
    Array(9).fill(CONFIG.defaultGreenAt)
  );
  const [reds, setReds] = useState<number[]>(
    Array(9).fill(CONFIG.defaultRedAt)
  );
  const [units, setUnits] = useState<string[]>(Array(9).fill(""));

  // Marquee pick + texts + speed
  const [pick, setPick] = useState({
    questions: true,
    reviews: true,
    banking: true,
    social: true,
    news: true,
  });
  const togglePick = (k: keyof typeof pick) =>
    setPick((p) => ({ ...p, [k]: !p[k] }));
  const [mqTexts, setMqTexts] = useState({
    questions: "",
    reviews: "",
    banking: "",
    social: "",
    news: "",
  });
  const [marqueeSec, setMarqueeSec] = useState<number>(80);

  // Drilldown overlay
  const [showSales, setShowSales] = useState(false);
  const closeSales = () => setShowSales(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSales();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

      // KPI rows
      const kpiIdx = [0, 1, 2, 3, 4, 5, 8, 9, 10];
      const nextLabels: string[] = [];
      const nextValues: (number | null)[] = [];
      const nextGreens: number[] = [];
      const nextReds: number[] = [];
      const nextUnits: string[] = [];

      for (let out = 0; out < 9; out++) {
        const r = rows[kpiIdx[out]] || [];
        nextLabels.push(
          (r[0] ?? "").toString().trim() || CONFIG.fallbackLabels[out]
        );
        nextValues.push(asNumber(r[1]));
        nextGreens.push((asNumber(r[2]) as number) ?? CONFIG.defaultGreenAt);
        nextReds.push((asNumber(r[3]) as number) ?? CONFIG.defaultRedAt);
        nextUnits.push((r[5] ?? "").toString().trim());
      }

      // Marquee text B8,B9,B15,B16,B17
      const safe = (ri: number) =>
        (rows[ri] && rows[ri][1] ? String(rows[ri][1]) : "") as string;
      setMqTexts({
        questions: safe(6),
        reviews: safe(7),
        banking: safe(13),
        social: safe(14),
        news: safe(15),
      });

      // Speed from G12 (rows[10][6]) → 40..140s
      const raw = rows[10]?.[6] ?? "";
      const ctl = Math.max(
        1,
        Math.min(100, Number(String(raw).replace(/[^\d.-]/g, "")) || 70)
      );
      setMarqueeSec(40 + (ctl / 100) * 100);

      setLabels(nextLabels);
      setValues(nextValues);
      setGreens(nextGreens);
      setReds(nextReds);
      setUnits(nextUnits);

      setStatus("ok");
      setLastSync(new Date());
    } catch (e: any) {
      setStatus("error");
      setStatusMsg(String(e?.message || e));
    }
  }

  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    /* hook to switch Day/Week/Month later */
  }, [rangeView]);

  const marqueeCombined = useMemo(() => {
    const parts: string[] = [];
    if (pick.questions && mqTexts.questions?.trim())
      parts.push(mqTexts.questions.trim());
    if (pick.reviews && mqTexts.reviews?.trim())
      parts.push(mqTexts.reviews.trim());
    if (pick.banking && mqTexts.banking?.trim())
      parts.push(mqTexts.banking.trim());
    if (pick.social && mqTexts.social?.trim())
      parts.push(mqTexts.social.trim());
    if (pick.news && mqTexts.news?.trim()) parts.push(mqTexts.news.trim());
    return parts.join("   •   ");
  }, [pick, mqTexts]);

  // ----------------- styles -----------------
  const styles = {
    /** TOP controls row (centered cluster) */
    controlsRow: {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      gap: 12,
      margin: "16px 0 8px",
      flexWrap: "wrap" as const,
    } as React.CSSProperties,
    bigBtn: {
      padding: "10px 16px",
      borderRadius: 12,
      background: "#214b77",
      color: "#fff",
      fontWeight: 800,
      border: "none",
      cursor: "pointer",
      fontSize: 16,
      boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
    } as React.CSSProperties,
    viewSwitch: {
      display: "inline-flex",
      gap: 6,
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 12,
      padding: 6,
    } as React.CSSProperties,
    viewChip: (active: boolean) => ({
      padding: "8px 12px",
      borderRadius: 10,
      fontSize: 14,
      fontWeight: 800,
      color: active ? "#0b2540" : "#dbe7f2",
      background: active ? "#8fd3ff" : "transparent",
      cursor: "pointer",
      userSelect: "none" as const,
    }),

    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      gap: 16,
    } as React.CSSProperties,
    card: (clickable = false) =>
      ({
        background: "linear-gradient(#2b2b2b, #252525)",
        borderRadius: 16,
        padding: 14,
        boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
        color: "#ddd",
        ...(clickable ? { cursor: "pointer" } : {}),
      }) as React.CSSProperties,
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
        fontSize: "clamp(16px, 5.2vw, 28px)", // auto-shrink text inside the bar
        letterSpacing: 0.3,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "clip",
        padding: "0 10px",
      }) as React.CSSProperties,
    kpiTitle: { fontSize: 13, fontWeight: 800, color: "#cfd5da", marginBottom: 8 },

    chooserRow: {
      marginTop: 12,
      display: "flex",
      justifyContent: "center",
      gap: 10,
      alignItems: "center",
      flexWrap: "wrap" as const,
      padding: "10px 12px",
      color: "#d9e2ea",
    },

    chk: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 10px",
      background: "rgba(255,255,255,0.06)",
      borderRadius: 8,
      border: "1px solid rgba(255,255,255,0.08)",
      fontSize: 13,
      fontWeight: 600,
      cursor: "pointer",
    },

    /** Bottom status line (centered) */
    statusLine: {
      marginTop: 10,
      textAlign: "center" as const,
      color: "#9bb0c0",
      fontSize: 12,
      fontWeight: 600,
    },

    overlay: {
      position: "fixed" as const,
      inset: 0,
      background: "rgba(0,0,0,0.55)",
      zIndex: 99999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
    },
    sheet: {
      background: "#0d1a24",
      color: "#e9f3ff",
      borderRadius: 16,
      width: "min(960px, 96vw)",
      maxHeight: "90vh",
      overflow: "auto",
      boxShadow: "0 12px 30px rgba(0,0,0,0.45)",
      border: "1px solid rgba(255,255,255,0.08)",
    },
    sheetHead: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "12px 14px",
      borderBottom: "1px solid rgba(255,255,255,0.08)",
    },
    closeBtn: {
      background: "rgba(255,255,255,0.1)",
      border: "none",
      color: "#fff",
      borderRadius: 8,
      padding: "6px 10px",
      fontWeight: 700,
      cursor: "pointer",
    },
  };

  return (
    <div style={{ padding: 16 }}>
      {/* TOP CONTROLS (centered) */}
      <div style={styles.controlsRow}>
        <button style={styles.bigBtn} onClick={load}>
          Refresh
        </button>

        <div style={styles.viewSwitch}>
          {(["Day", "Week", "Month"] as const).map((v) => (
            <div
              key={v}
              style={styles.viewChip(rangeView === v)}
              onClick={() => setRangeView(v)}
            >
              {v}
            </div>
          ))}
        </div>

        <button
          style={styles.bigBtn}
          onClick={() => {
            // placeholder hook for Calendar — wire up later
            alert("Calendar (coming soon)");
          }}
        >
          Calendar
        </button>
      </div>

      {/* KPI GRID */}
      <div style={styles.grid}>
        {labels.slice(0, 9).map((label, i) => {
          const color = valueToColorByTargets(
            values[i],
            greens[i] ?? CONFIG.defaultGreenAt,
            reds[i] ?? CONFIG.defaultRedAt
          );
          const shown = formatByUnit(values[i], units[i]);
          const isSales = i === 0; // Sales tile triggers drill-down

          return (
            <div
              key={i}
              style={styles.card(isSales)}
              onClick={isSales ? () => setShowSales(true) : undefined}
              role={isSales ? "button" : undefined}
              tabIndex={isSales ? 0 : undefined}
              onKeyDown={
                isSales
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setShowSales(true);
                      }
                    }
                  : undefined
              }
            >
              <div style={styles.kpiTitle}>{label.toUpperCase()}</div>
              <div style={styles.kpiBar(color)}>{shown}</div>
            </div>
          );
        })}
      </div>

      {/* MARQUEE */}
      <Marquee text={marqueeCombined} speedSec={marqueeSec} />

      {/* MARQUEE PICKERS (restored, centered) */}
      <div style={styles.chooserRow}>
        <span style={{ fontWeight: 800, opacity: 0.9 }}>Marquee includes:</span>
        <label style={styles.chk} onClick={() => togglePick("questions")}>
          <input
            type="checkbox"
            checked={pick.questions}
            onChange={() => {}}
          />
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

      {/* BOTTOM STATUS LINE */}
      <div style={styles.statusLine}>
        {status === "loading" && "Status: Syncing…"}
        {status === "ok" &&
          `Status: Live • Last Sync: ${
            lastSync?.toLocaleTimeString() ?? "—"
          } • Data Source Health: OK`}
        {status === "error" &&
          `Status: Error — ${statusMsg} • Data Source Health: Check API key/limits`}
      </div>

      {/* Sales Panel Overlay */}
      {showSales && (
        <div style={styles.overlay} onClick={closeSales}>
          <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
            <div style={styles.sheetHead}>
              <strong>Sales • Drill‑down</strong>
              <button style={styles.closeBtn} onClick={closeSales}>
                Close
              </button>
            </div>
            <div style={{ padding: 16 }}>
              <SalesPanel onClose={closeSales} rangeView={rangeView} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}