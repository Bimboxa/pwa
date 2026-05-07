// Round a numeric value to a display-friendly form. Used for `offsetZ`,
// `height` and per-point `offsetTop`/`offsetBottom` of annotations created
// from the 3D drawing flow, so the user doesn't see e.g. `1.110339449` in
// the edit toolbar.
//
// Rules (in order):
//   - within 0.005 of an integer  → integer       (catches X.999 / X.001)
//   - within 0.0005 of 1 decimal → 1 decimal      (catches X.X99 / X.X01)
//   - within 0.00005 of 2 decimals → 2 decimals
//   - otherwise: 3 significant figures
export default function roundForDisplay(value) {
  if (!Number.isFinite(value)) return 0;
  if (value === 0) return 0;
  const sign = Math.sign(value);
  const abs = Math.abs(value);

  const int = Math.round(abs);
  if (Math.abs(abs - int) < 0.005) return sign * int;

  const d1 = Math.round(abs * 10) / 10;
  if (Math.abs(abs - d1) < 0.0005) return sign * d1;

  const d2 = Math.round(abs * 100) / 100;
  if (Math.abs(abs - d2) < 0.00005) return sign * d2;

  const exponent = Math.floor(Math.log10(abs));
  const factor = Math.pow(10, 2 - exponent);
  return (sign * Math.round(abs * factor)) / factor;
}
