// Altitude range of the clip levels slider of a horizontal base map
// (SliderBaseMapClipLevelsThreed): it must show the base map altitude and
// the two faces of its clipping box, with room to drag them over the scene.
//
// levels: { z, frontM, backM } (frontM / backM null = no limit);
// sceneMinY / sceneMaxY: vertical extent of the scene (may be undefined);
// previous: the range currently displayed, or null.
//
// The previous range is KEPT while every level stays comfortably inside it,
// so the thumbs do not jump on the track after each commit; otherwise a new
// padded range is computed.
// → { min, max }

const MIN_PAD_M = 0.5;
const PAD_RATIO = 0.1;
// a level closer than this share of the span to an end asks for more room
const EDGE_RATIO = 0.02;

export default function getClipLevelsRange({
  levels,
  sceneMinY,
  sceneMaxY,
  previous = null,
}) {
  const values = [levels.z];
  if (Number.isFinite(levels.frontM)) values.push(levels.z + levels.frontM);
  if (Number.isFinite(levels.backM)) values.push(levels.z - levels.backM);
  const lowest = Math.min(...values);
  const highest = Math.max(...values);

  if (previous && previous.max > previous.min) {
    const edge = (previous.max - previous.min) * EDGE_RATIO;
    if (lowest >= previous.min + edge && highest <= previous.max - edge)
      return previous;
  }

  const lo = Math.min(lowest, Number.isFinite(sceneMinY) ? sceneMinY : lowest);
  const hi = Math.max(
    highest,
    Number.isFinite(sceneMaxY) ? sceneMaxY : highest
  );
  const pad = Math.max(MIN_PAD_M, (hi - lo) * PAD_RATIO);
  return { min: lo - pad, max: hi + pad };
}
