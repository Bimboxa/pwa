// Normalizes a project référentiel id (masterProject.idMaster, config
// projectObjectId mapped as projectIdMaster) to a comparable string.
// The backend may send it as an int (2321) or a string ("2321"), and uses
// 0 as "no reference" — all empty values resolve to null.

export default function normalizeProjectIdMaster(value) {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  if (!str || str === "0") return null;
  return str;
}
