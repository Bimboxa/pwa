// Rollup rule of the linked annotations' quantities, shared by the business
// objects (useBusinessObjectQties) and the work packages (useWorkPackageHours):
// unit count = 1 per annotation unless it carries its own count
// (LINEAR_LAYOUT bars); length / surface only when the quantities are
// enabled, preferring the developed (sloped) values like the template
// rollups. Mesh cells must be skipped by the caller (their parent is
// already counted).
export function createEmptyQties() {
  return { count: 0, length: 0, surface: 0 };
}

export default function accumulateAnnotationQties(stats, annotation) {
  const qty = annotation?.qties;
  stats.count += Number.isFinite(qty?.count) ? qty.count : 1;
  if (qty?.enabled) {
    const length =
      qty.lengthDeveloped != null ? qty.lengthDeveloped : qty.length;
    const surface =
      qty.surfaceDeveloped != null ? qty.surfaceDeveloped : qty.surface;
    if (Number.isFinite(length)) stats.length += length;
    if (Number.isFinite(surface)) stats.surface += surface;
  }
  return stats;
}
