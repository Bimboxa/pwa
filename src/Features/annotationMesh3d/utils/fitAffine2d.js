// Least-squares 2D affine map fitted on point pairs:
//
//   x' = a·x + b·y + c
//   y' = d·x + e·y + f
//
// Used to make a mesh follow the rigid transform (move / rotate / resize)
// the 2D editor applied to the annotation's points: the pairs are the
// points before and after the transform.
//
// Collinear pairs (the thin projection of a vertical face) cannot pin a full
// affine map: the fit falls back to a similarity (rotation + uniform scale +
// translation), and to a pure translation for a single point.
//
// pairs: [{ from: {x, y}, to: {x, y} }]. Returns {a, b, c, d, e, f} or null.
export default function fitAffine2d(pairs) {
  const n = pairs?.length || 0;
  if (!n) return null;

  let mx = 0;
  let my = 0;
  let mu = 0;
  let mv = 0;
  for (const { from, to } of pairs) {
    mx += from.x;
    my += from.y;
    mu += to.x;
    mv += to.y;
  }
  mx /= n;
  my /= n;
  mu /= n;
  mv /= n;

  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  let sxu = 0;
  let syu = 0;
  let sxv = 0;
  let syv = 0;
  for (const { from, to } of pairs) {
    const x = from.x - mx;
    const y = from.y - my;
    const u = to.x - mu;
    const v = to.y - mv;
    sxx += x * x;
    sxy += x * y;
    syy += y * y;
    sxu += x * u;
    syu += y * u;
    sxv += x * v;
    syv += y * v;
  }

  const withTranslation = (a, b, d, e) => ({
    a,
    b,
    c: mu - a * mx - b * my,
    d,
    e,
    f: mv - d * mx - e * my,
  });

  const spread = sxx + syy;
  if (spread < 1e-18) return withTranslation(1, 0, 0, 1);

  const det = sxx * syy - sxy * sxy;
  if (det > 1e-9 * spread * spread) {
    return withTranslation(
      (sxu * syy - syu * sxy) / det,
      (syu * sxx - sxu * sxy) / det,
      (sxv * syy - syv * sxy) / det,
      (syv * sxx - sxv * sxy) / det
    );
  }

  // Similarity: z' = α·z with α = Σ conj(z)·z' / Σ |z|².
  const re = (sxu + syv) / spread;
  const im = (sxv - syu) / spread;
  return withTranslation(re, -im, im, re);
}
