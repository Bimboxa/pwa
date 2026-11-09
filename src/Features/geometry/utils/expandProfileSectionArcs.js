import { expandRingWithOffsets } from "./arcSampling.js";
import { getProfileAxis } from "../../elevation/utils/buildProfileSectionGeometry.js";

const ARC_SAMPLES = 12;

// Expands the VERTICAL arcs of a FREE profile (the inline cross-section of a
// POLYLINE "Extrusion", `annotation.profileLines`) into sampled vertices.
//
// A "circle" vertex is an arc control point of the SECTION curve: the curve
// through prev → control → next is a circular arc in (s, h) space, where `s`
// is the SIGNED projection of the vertex onto the profile's cut axis
// (getProfileAxis — first → last chord, same abscissa as the Élévation
// section editor, buildProfileSectionGeometry / getInlineExtrusionSetup) and
// `h` the vertex height.
//
// The abscissa MUST be the signed one, not the curvilinear distance along the
// plan chain (expandShellProfileArcs, meant for POLYGON shells): a profile
// applied from a drawing (applyProfileFromAnnotationService) is laid
// COLLINEAR on the guide normal and FOLDS BACK on itself — the base point sits
// in the middle, both ends at the same plan position. Its curvilinear chain
// unfolds the fold, so the three control points read nearly aligned and the
// arc degenerates into a V.
//
// Sampled points are mapped back to plan along the cut axis; the perpendicular
// component of the control points (zero on a collinear chain) is interpolated
// along the arc like expandRingWithOffsets does for vertex offsets.
//
// Units must be CONSISTENT between plan x/y and height (meters / basemap-local
// for the 3D and qties callers) — an arc's shape depends on the aspect ratio.
//
// Input:  [{x, y, height, type?}, ...]
// Output: [{x, y, height}, ...] (straight-only).
export default function expandProfileSectionArcs(profilePoints) {
  const pts = (profilePoints || []).filter(
    (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)
  );
  const plain = () =>
    pts.map((p) => ({ x: p.x, y: p.y, height: Number(p.height) || 0 }));
  if (pts.length < 3) return plain();
  if (!pts.some((p) => p.type === "circle")) return plain();

  const axis = getProfileAxis(pts);
  if (!axis) return plain();
  const { ox, oy, ux, uy } = axis;
  // perpendicular unit (left of the axis)
  const vx = -uy;
  const vy = ux;

  // Section space: x = signed abscissa, y = height; the perpendicular plan
  // component rides along as `offsetBottom` so the sampler interpolates it.
  const sectionPts = pts.map((p) => {
    const dx = p.x - ox;
    const dy = p.y - oy;
    return {
      x: dx * ux + dy * uy,
      y: Number(p.height) || 0,
      offsetBottom: dx * vx + dy * vy,
      offsetTop: 0,
      ...(p.type === "circle" ? { type: "circle" } : {}),
    };
  });
  const sampled = expandRingWithOffsets(sectionPts, ARC_SAMPLES, false);

  return sampled
    .filter((q) => Number.isFinite(q?.x) && Number.isFinite(q?.y))
    .map((q) => {
      const n = Number(q.offsetBottom) || 0;
      return {
        x: ox + q.x * ux + n * vx,
        y: oy + q.x * uy + n * vy,
        height: q.y,
      };
    });
}
