function m(a, b, c, d, e, f) {
  return { a, b, c, d, e, f };
}

function mIdentity() {
  return m(1, 0, 0, 1, 0, 0);
}

function mFromTSR(tx, ty, s = 1, rotRad = 0) {
  const cos = Math.cos(rotRad),
    sin = Math.sin(rotRad);
  return m(cos * s, sin * s, -sin * s, cos * s, tx, ty);
}

function mMul(M1, M2) {
  // M1 ∘ M2 (apply M2 then M1)
  return m(
    M1.a * M2.a + M1.c * M2.b,
    M1.b * M2.a + M1.d * M2.b,
    M1.a * M2.c + M1.c * M2.d,
    M1.b * M2.c + M1.d * M2.d,
    M1.a * M2.e + M1.c * M2.f + M1.e,
    M1.b * M2.e + M1.d * M2.f + M1.f
  );
}

function mDet(M) {
  return M.a * M.d - M.b * M.c;
}

function mInverse(M) {
  const det = mDet(M);
  if (!det) return mIdentity();
  const invDet = 1 / det;
  return m(
    M.d * invDet,
    -M.b * invDet,
    -M.c * invDet,
    M.a * invDet,
    (M.c * M.f - M.d * M.e) * invDet,
    (M.b * M.e - M.a * M.f) * invDet
  );
}

function mApply(M, x, y) {
  return { x: M.a * x + M.c * y + M.e, y: M.b * x + M.d * y + M.f };
}

export { m, mIdentity, mFromTSR, mMul, mDet, mInverse, mApply };
