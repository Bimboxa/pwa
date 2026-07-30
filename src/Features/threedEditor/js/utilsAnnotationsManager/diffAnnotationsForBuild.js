// Pure decision logic for the incremental loadAnnotations diff — free of
// Three.js and manager state so it can be replayed in node.

// Build options that shape geometry / materials at creation time. A change of
// any of them invalidates EVERY built object — same lifecycle as the
// documented "render mode toggle rebuilds everything" invariant in
// useAutoLoadAnnotationsInThreedEditor.
export function getBuildEpochKey(options) {
  return [
    options?.disableOpacity,
    options?.antiAliasingShrink,
    options?.realisticShading,
    options?.photorealShading,
    options?.aquarelleShading,
    // REVOLUTION half-view (serialized {baseMapId: side} map): toggling a
    // vertical base map image or a camera side flip changes the displayed
    // sweep, so the lathe geometries must rebuild.
    options?.revolutionSectionKey,
    // "Pochage des coupes" toggle rebuilds the lathe section markers.
    options?.revolutionSectionFill,
  ]
    .map((v) => String(v ?? ""))
    .join("|");
}

// Splits the incoming resolved annotations against the build provenance map:
// - reuse when the resolved annotation REFERENCE (stabilized across runs by
//   useAnnotationsV2), the build epoch and the basemap metrics are unchanged;
// - changed entries are scheduled for BOTH remove (dispose the stale object)
//   and create;
// - tracked ids absent from the incoming array are removed.
export default function diffAnnotationsForBuild({
  annotations,
  buildStateById, // Map id -> { sourceRef, epochKey, baseMapKey }
  epochKey,
  getBaseMapKey, // (annotation) => string | null (null = basemap not registered)
}) {
  const toCreate = [];
  const toRemove = [];
  const incomingIds = new Set();
  for (const annotation of annotations || []) {
    incomingIds.add(annotation.id);
    const prev = buildStateById.get(annotation.id);
    if (
      prev &&
      prev.sourceRef === annotation &&
      prev.epochKey === epochKey &&
      prev.baseMapKey === getBaseMapKey(annotation)
    ) {
      continue;
    }
    if (prev) toRemove.push(annotation.id);
    toCreate.push(annotation);
  }
  for (const id of buildStateById.keys()) {
    if (!incomingIds.has(id)) toRemove.push(id);
  }
  return { toCreate, toRemove };
}
