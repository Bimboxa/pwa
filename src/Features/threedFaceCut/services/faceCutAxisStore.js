// Tiny external store connecting FaceCutAxisOverlayThreed (the hover of the
// « Découpe horizontale / verticale » tools, imperative pointer code) to the
// click / Enter handler (useDrawingPointerHandlers) and the bottom bar
// (SectionFaceCutAxisConstraint).
//
// hover: null when no face is hovered, else {
//   nodeId,          // hovered annotation
//   notCuttable,     // its faces cannot be edited (carved, generated…)
//   chordWorld,      // [{x, y, z, nodeId} x2] the cut line on the face, or
//                    // null when the (typed) line misses it
//   surfaceCut,      // SURFACE host (isSurfaceCutHost) only, chordWorld
//                    // null: { annotationId, axis, plane: {normal,
//                    // constant} (world), seed: {x, y, z} (world) } for
//                    // cutSurfaceAlongPlaneService
//   endsOnHole,      // an end of the chord lies on a hole: refused
//   distance,        // m, from the reference corner to the line
//   snapped, locked, // line on a vertex / edge middle; on the typed distance
//   chip,            // { x, y, text } px on the canvas, or null
// }
//
// The store also caches the editable mesh of each hovered annotation
// (getEditableMesh3d is a db read + a conversion): cleared after each cut
// (snap index epoch), on the anti-aliasing shrink toggle and when the tool
// is left.

let _hover = null;
const _listeners = new Set();

export function setFaceCutAxisHover(hover) {
  _hover = hover;
  _listeners.forEach((listener) => listener());
}

export function getFaceCutAxisHover() {
  return _hover;
}

export function subscribeFaceCutAxisHover(listener) {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

const _contexts = new Map(); // annotationId -> Promise<ctx | null>

// The editable mesh context of an annotation, loaded once per cache life.
export function getCachedFaceCutContext(annotationId, load) {
  if (!_contexts.has(annotationId)) {
    _contexts.set(
      annotationId,
      Promise.resolve()
        .then(load)
        .catch((err) => {
          console.error("[threedFaceCut] face context failed", err);
          return null;
        })
    );
  }
  return _contexts.get(annotationId);
}

const _surfaceContexts = new Map(); // mesh uuid -> context

// The surface-cut context of a hovered SOLID mesh of a surface host (its
// world triangle soup, boundary vertices, revolution axis), built once per
// cache life.
export function getCachedSurfaceCutContext(mesh, load) {
  const key = mesh?.uuid;
  if (!key) return null;
  if (!_surfaceContexts.has(key)) {
    let ctx = null;
    try {
      ctx = load();
    } catch (err) {
      console.error("[threedFaceCut] surface context failed", err);
    }
    _surfaceContexts.set(key, ctx);
  }
  return _surfaceContexts.get(key);
}

export function clearFaceCutHoverCache() {
  _contexts.clear();
  _surfaceContexts.clear();
}
