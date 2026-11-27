import { isExcludedFromDetection } from "./getDuplicateCandidates";

// Polygons whose own cuts (openings) can overlap each other: at least two
// cuts. Unlike getDuplicateCandidates, a template is not required — the check
// stays inside one annotation.
export default function getCutOverlapCandidates(
  annotations,
  { baseMapId = null } = {}
) {
  return (annotations ?? []).filter((a) => {
    if (!a || a.type !== "POLYGON") return false;
    if (!Array.isArray(a.cuts) || a.cuts.length < 2) return false;
    return !isExcludedFromDetection(a, { baseMapId });
  });
}
