// Parses the metaData field of a scope configuration (or daily-scope item).
// The backend stores it as an opaque string — the front pushes a JSON string
// (computeScopeStats: {"annotationsCount":142,"baseMapsCount":6}) — but be
// tolerant: an already-parsed object passes through, and anything unparsable
// (older versions, empty field) yields {} so callers can destructure safely.
export default function getScopeConfigMetaData(config) {
  const raw = config?.metaData;
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}
