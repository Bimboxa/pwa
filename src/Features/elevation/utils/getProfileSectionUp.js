import getBaseMapTransform from "../../baseMaps/js/getBaseMapTransform.js";

// Orientation of a SOURCE profile drawing inside the cross-section plane of
// the guide it is applied on (applyProfileFromAnnotationService).
//
// The cross-section plane is perpendicular to the guide's seed segment. Its
// two axes, in the TARGET (guide) base map frame:
//   - u: the right-of-tangent normal of the seed segment, IN the base map
//        plane (the plan chain of the profile line runs along it);
//   - h: the base map normal (the inline `height` of the profile vertices).
//
// `sectionUp = { u, h }` is the unit direction the profile's drawing-UP axis
// (its −Y pixel axis) takes in that plane:
//   - { u: 0, h: 1 } — default reading: the profile is an elevation drawing
//     RELATIVE to the guide's base map (X → plan abscissa, Y → height along
//     the base map normal). Always the case for a profile drawn on a
//     HORIZONTAL base map, and on a HORIZONTAL target (its normal IS the
//     world vertical).
//   - { u: ±1, h: 0 } — the profile was drawn on a VERTICAL base map and the
//     guide lives on a VERTICAL base map too: the base map normal is
//     horizontal there, so the default reading would lay the profile on its
//     side. The profile keeps its vertical instead: its Y follows the world
//     vertical — the in-plane perpendicular of the guide, on the side that
//     points up — and its X runs along the base map normal. A guide that is
//     itself vertical has no "up" in its cross-section plane: default reading.
//
// The rotation happens INSIDE the cross-section plane, so the side rule is
// unchanged: looking along the guide, the profile's X axis stays on the same
// hand of its up axis as in the default reading.
//
// `segA` / `segB` are the seed segment endpoints in target pixels (y down).

export const DEFAULT_SECTION_UP = { u: 0, h: 1 };

const VERTICAL_GUIDE_EPS = 1e-6;

export default function getProfileSectionUp({
  sourceBaseMap,
  targetBaseMap,
  segA,
  segB,
}) {
  if (getBaseMapTransform(sourceBaseMap).orientation !== "VERTICAL") {
    return DEFAULT_SECTION_UP;
  }
  if (getBaseMapTransform(targetBaseMap).orientation !== "VERTICAL") {
    return DEFAULT_SECTION_UP;
  }
  const dx = (segB?.x ?? 0) - (segA?.x ?? 0);
  const dy = (segB?.y ?? 0) - (segA?.y ?? 0);
  const len = Math.hypot(dx, dy);
  if (!(len > 0)) return DEFAULT_SECTION_UP;
  // Right-of-tangent normal in pixels is (dy, −dx) / len. On a VERTICAL base
  // map the world vertical is the −Y pixel axis: its component on that normal
  // is dx / len.
  const upOnNormal = dx / len;
  if (Math.abs(upOnNormal) < VERTICAL_GUIDE_EPS) return DEFAULT_SECTION_UP;
  return { u: upOnNormal > 0 ? 1 : -1, h: 0 };
}

// True when the profile was laid upright (not in the default reading).
export function isUprightSectionUp(sectionUp) {
  return Math.abs(Number(sectionUp?.u) || 0) > 0.5;
}

// Maps a profile vertex — `a` along the drawing's X axis (side, already
// signed by the mirror flag), `b` along its up axis, both in metres from the
// registration origin — to the cross-section plane: `s` along the seed
// normal (metres, to be converted to target pixels) and `height` along the
// base map normal (metres).
export function toSectionSample(a, b, sectionUp = DEFAULT_SECTION_UP) {
  return {
    s: a * sectionUp.h + b * sectionUp.u,
    height: -a * sectionUp.u + b * sectionUp.h,
  };
}
