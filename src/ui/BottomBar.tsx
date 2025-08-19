import React from "react";

type Props = {
  onRefresh?: () => void;
};

export default function BottomBar({ onRefresh }: Props) {
  const styleTag = `
    .bbar {
      background:#2A5376;
      color:#e9eef5;
      padding:10px 12px;
      width:100%;
      border-top-left-radius:14px;
      border-top-right-radius:14px;
      position:sticky;
      bottom:0;
      z-index:5;
    }
    .bbar-inner {
      max-width:1200px;
      margin:0 auto;
      display:grid;
      grid-template-columns: repeat(3, 1fr); /* exactly three */
      gap:12px;
    }
    .bbtn {
      display:flex;
      align-items:center;
      justify-content:center;
      height:44px;
      border-radius:10px;
      font-weight:700;
      background:#3a668f;
      color:#fff;
      border:1px solid rgba(255,255,255,0.18);
      transition:transform .05s ease, background .15s ease;
      user-select:none;
    }
    .bbtn:active { transform:translateY(1px); }
    .bbtn:hover { background:#4174a6; }
    @media (max-width:420px){
      .bbtn{ height:42px; font-size:14px; }
      .bbar { padding:10px 10px; }
      .bbar-inner { gap:10px; }
    }
  `;

  const doRefresh = () => {
    if (onRefresh) onRefresh();
    else window.location.reload();
  };
  const doScan = () => {
    // placeholder: wire to your real scanner later
    alert("Scan: coming soon ✨");
  };
  const doNotes = () => {
    // placeholder: wire to your notes/log page later
    alert("Notes: coming soon ✨");
  };

  return (
    <div className="bbar">
      <style>{styleTag}</style>
      <div className="bbar-inner">
        <button className="bbtn" onClick={doRefresh}>Refresh</button>
        <button className="bbtn" onClick={doScan}>Scan</button>
        <button className="bbtn" onClick={doNotes}>Notes</button>
      </div>
    </div>
  );
}