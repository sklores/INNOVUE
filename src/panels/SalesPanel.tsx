import React, { useEffect, useMemo } from "react";

type Props = {
  value: number | null;     // current KPI value (optional display)
  onClose: () => void;
};

type Slice = { label: string; value: number; color: string };

/** Build an SVG arc path for a donut/pie slice */
function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const toXY = (angle: number) => {
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    return { x, y };
  };
  const start = toXY(startAngle);
  const end = toXY(endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

export default function SalesPanel({ value, onClose }: Props) {
  // ESC to close (desktop)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // ---------- DUMMY DATA (replace later with Sheets) ----------
  const channels: Slice[] = [
    { label: "Takeout",  value: 540, color: "#6BA6FF" },
    { label: "Delivery", value: 380, color: "#8BD4A1" },
    { label: "Kiosk",    value: 210, color: "#F9D276" },
    { label: "Bar",      value: 305, color: "#E28B8B" },
  ];

  const categories: Slice[] = [
    { label: "Food",     value: 760, color: "#6BA6FF" },
    { label: "Sides",    value: 180, color: "#8BD4A1" },
    { label: "Dessert",  value: 95,  color: "#F9D276" },
    { label: "Beverage", value: 220, color: "#E28B8B" },
    { label: "Alcohol",  value: 230, color: "#C5A3E0" },
  ];
  // -----------------------------------------------------------

  const channelTotal = useMemo(
    () => channels.reduce((s, c) => s + c.value, 0),
    [channels]
  );
  const categoryTotal = useMemo(
    () => categories.reduce((s, c) => s + c.value, 0),
    [categories]
  );

  // Pie geometry
  const pieSize = 220;      // SVG viewbox
  const r = 100;            // radius
  const cx = pieSize / 2;
  const cy = pieSize / 2;
  const pieSlices = useMemo(() => {
    let angle = -Math.PI / 2; // start at top
    return categories.map((s) => {
      const frac = s.value / Math.max(1, categoryTotal);
      const start = angle;
      const end = angle + frac * Math.PI * 2;
      angle = end;
      return { ...s, start, end };
    });
  }, [categories, categoryTotal]);

  // Basic styles
  const styles: Record<string, React.CSSProperties> = {
    overlay: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.55)",
      display: "flex",
      alignItems: "flex-end",   // mobile sheet feel
      justifyContent: "center",
      zIndex: 3000,
      padding: 12,
    },
    panel: {
      width: "100%",
      maxWidth: 560,
      background: "#0f1724",
      color: "#e8eef6",
      borderRadius: 16,
      boxShadow: "0 12px 28px rgba(0,0,0,.45)",
      padding: 16,
      maxHeight: "92vh",
      overflowY: "auto",
    },
    header: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      marginBottom: 6,
    },
    title: {
      fontWeight: 900,
      fontSize: 20,
      letterSpacing: 0.2,
    },
    sub: {
      fontSize: 12,
      color: "#9fb3c9",
      fontWeight: 700,
    },
    closeBtn: {
      border: "none",
      background: "rgba(255,255,255,0.08)",
      color: "#e8eef6",
      borderRadius: 10,
      padding: "8px 10px",
      fontWeight: 800,
      cursor: "pointer",
    },
    section: {
      marginTop: 14,
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 12,
      padding: 12,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: 800,
      color: "#d2dbe6",
      marginBottom: 8,
      letterSpacing: 0.3,
    },
    // Bars
    row: {
      display: "grid",
      gridTemplateColumns: "1fr auto",
      alignItems: "center",
      gap: 10,
      margin: "6px 0",
    },
    barTrack: {
      height: 12,
      background: "rgba(255,255,255,0.08)",
      borderRadius: 8,
      overflow: "hidden",
    },
    label: { fontSize: 13, fontWeight: 800, color: "#e8eef6" },
    val: { fontSize: 12, fontWeight: 700, color: "#9fb3c9" },
    // Pie
    pieWrap: {
      display: "grid",
      gridTemplateColumns: "auto 1fr",
      gap: 12,
      alignItems: "center",
    },
    legendItem: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontSize: 13,
      color: "#e8eef6",
      margin: "4px 0",
    },
    swatch: (bg: string): React.CSSProperties => ({
      width: 12,
      height: 12,
      borderRadius: 3,
      background: bg,
      boxShadow: "0 1px 4px rgba(0,0,0,.35)",
    }),
  };

  const currency = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true">
      <div style={styles.panel}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <div style={styles.title}>Sales</div>
            <div style={styles.sub}>
              Today total: {value != null ? currency(value) : "—"}
            </div>
          </div>
          <button onClick={onClose} style={styles.closeBtn} aria-label="Close">✕</button>
        </div>

        {/* Section 1: Channel split (bars) */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Channel breakdown</div>
          {channels.map((c) => {
            const pct = channelTotal ? c.value / channelTotal : 0;
            return (
              <div key={c.label} style={styles.row}>
                <div>
                  <div style={styles.label}>{c.label}</div>
                  <div style={styles.barTrack}>
                    <div style={{ width: `${Math.max(6, pct * 100)}%`, height: "100%", background: c.color }} />
                  </div>
                </div>
                <div style={styles.val}>
                  {currency(c.value)} ({Math.round(pct * 100)}%)
                </div>
              </div>
            );
          })}
        </div>

        {/* Section 2: Category mix (pie) */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Category mix</div>
          <div style={styles.pieWrap}>
            {/* Pie */}
            <svg width={pieSize} height={pieSize} viewBox={`0 0 ${pieSize} ${pieSize}`} role="img" aria-label="Category mix">
              {pieSlices.map((s, i) => (
                <path key={i} d={arcPath(cx, cy, r, s.start, s.end)} fill={s.color} />
              ))}
              {/* white circle for donut look (optional, comment out for full pie) */}
              {/* <circle cx={cx} cy={cy} r={r * 0.5} fill="#0f1724" /> */}
            </svg>
            {/* Legend */}
            <div>
              {categories.map((s) => {
                const pct = categoryTotal ? Math.round((s.value / categoryTotal) * 100) : 0;
                return (
                  <div key={s.label} style={styles.legendItem}>
                    <span style={styles.swatch(s.color)} />
                    <span style={{ fontWeight: 800 }}>{s.label}</span>
                    <span style={{ color: "#9fb3c9", marginLeft: 6 }}>
                      {currency(s.value)} • {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer (optional) */}
        {/* <div style={{ marginTop: 12, textAlign: "right" }}>
          <button onClick={onClose} style={styles.closeBtn}>Back</button>
        </div> */}
      </div>
    </div>
  );
}