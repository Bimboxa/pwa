// notes-app (Krnet) rows come from Supabase in snake_case, with JSON payloads
// stored as strings and timestamps in unix SECONDS. Normalize to camelCase
// keys, parsed JSON payloads and millisecond timestamps. Permissive on
// unknown or missing columns: the checked-in remote schema is known to lag
// the live DB, so unknown keys pass through untouched.

const JSON_KEYS = new Set([
  "settings",
  "fields",
  "stateValues",
  "states",
  "transitions",
  "groupByListingIds",
]);

const TIMESTAMP_KEYS = new Set(["createdAt", "updatedAt", "deletedAt"]);

export function toCamelCase(key) {
  return key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

export default function normalizeNotesAppRow(row) {
  if (!row || typeof row !== "object") return row;
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    const camelKey = toCamelCase(key);
    let v = value;
    if (JSON_KEYS.has(camelKey) && typeof v === "string") {
      try {
        v = JSON.parse(v);
      } catch {
        // keep the raw string rather than dropping the column
      }
    }
    if (TIMESTAMP_KEYS.has(camelKey) && typeof v === "number") {
      v = v * 1000;
    }
    out[camelKey] = v;
  }
  return out;
}
