// Central config for Google Sheets API — SINGLE SOURCE OF TRUTH

// ✅ Your confirmed working API key
export const API_KEY = "AIzaSyB35kXXoqnEO-m-w_pb0aMU8R-sWq4qf_s";

// ✅ Your spreadsheet ID (from the URL you gave me)
export const SPREADSHEET_ID = "1S_eFTn-Hg4nAfUjj4wZMG8pKK1WahxSTqR7ztx4rOnw";

// ✅ The exact tab name in that spreadsheet (change if your tab is named differently)
export const SHEET_NAME = "GCDC Test Sheet";

// ✅ Range covering 9 tiles (rows 2..10) + 2 marquees in B11, B12 → A2:D12
export const RANGE = "A2:D12";

// Helper to build the exact URL used by the app (easy to debug)
export function buildSheetsURL() {
  const encoded = encodeURIComponent(`${SHEET_NAME}!${RANGE}`);
  return `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encoded}?key=${API_KEY}`;
}