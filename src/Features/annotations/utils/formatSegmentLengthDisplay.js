// Display value of the segment being drawn (bottom bar, cursor badge, 3D
// label): metres with 3 decimals when the base map has a scale, image pixels
// otherwise. Single source so the badge and the bar never disagree.
//
// Returns `{ value, unit }` — the two are laid out separately by the bar.
export default function formatSegmentLengthDisplay({ px, meters, meterByPx }) {
  const hasScale = Number.isFinite(meterByPx) && meterByPx > 0;
  const unit = hasScale ? "m" : "px";

  // `meters` is already in the display unit (3D scene, always scaled); `px`
  // is image pixels, converted when the base map has a scale.
  let value;
  if (Number.isFinite(meters)) {
    value = meters;
  } else if (Number.isFinite(px)) {
    value = hasScale ? px * meterByPx : px;
  } else {
    value = 0;
  }

  if (!Number.isFinite(value) || value < 0.01) return { value: "0", unit };
  return {
    value: hasScale ? value.toFixed(3) : Math.round(value).toString(),
    unit,
  };
}
