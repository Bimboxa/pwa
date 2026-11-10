import { getEffectiveShellMode } from "../constants/shape3DConfig";

const hasHidden = (ring) =>
  (ring?.hiddenSegmentsIdx?.length ?? 0) > 0 ||
  (ring?.hiddenSegmentsPointIds?.length ?? 0) > 0;

// A POLYGON prism one of whose segments is hidden (« Masquer le segment »,
// on its contour or on a cut): the 3D build drops the matching side face
// (extrudeClosedShape), so the object is an OPEN surface — a pool shell drawn
// in section with its top segment hidden, a slab without its threshold
// side… Like a « Fosse » (isOpenTopPrism) it bounds no volume: as a
// subtraction host it is clipped (isHollowSubtractionHost), not carved as a
// solid.
export default function isOpenSidePrism(annotation) {
  return (
    annotation?.type === "POLYGON" &&
    !annotation.isMesh3d &&
    Number(annotation.height) > 0 &&
    // a shell (coque) is built from its profile lines, not as a prism
    getEffectiveShellMode(annotation) === null &&
    (hasHidden(annotation) || (annotation.cuts ?? []).some(hasHidden))
  );
}
