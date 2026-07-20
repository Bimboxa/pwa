/**
 * Quantity deduction from openings glued on a host annotation
 * (relAnnotationOpenings): deducted m² = Σ opening.width × overlapHeight.
 *
 * The overlap is clipped to the host's vertical range
 * [host.offsetZ, host.offsetZ + host.height]: the opening band
 * [opening.offsetZ, opening.offsetZ + opening.height] (base at the opening's
 * own allège height when set, else at the host's base) only deducts the
 * overlapping band.
 *
 * Note: this deduction targets the VERTICAL surface quantities of wall-type
 * hosts (linéaire × hauteur). The 2D carve (applyOpeningOnPolygon) already
 * reduces the PLAN footprint of POLYGON hosts — the two mechanisms affect
 * different quantities.
 *
 * @param {Object} args
 * @param {Object} args.host - host annotation (with height / offsetZ)
 * @param {Array<{width:number, height:number, offsetZ:number}>} args.openings
 * @returns {{deductedM2:number}|null}
 */
export default function getAnnotationOpeningQties({ host, openings }) {
  if (!host || !openings?.length) return null;

  const hostHeight = Number(host.height) || 0;
  const z0 = Number(host.offsetZ) || 0;
  const z1 = hostHeight > 0 ? z0 + hostHeight : Infinity;

  let deducted = 0;
  for (const o of openings) {
    const w = Number(o?.width);
    const h = Number(o?.height);
    if (!(w > 0) || !(h > 0)) continue;
    const oz = o?.offsetZ != null && Number.isFinite(Number(o.offsetZ))
      ? Number(o.offsetZ)
      : z0;
    const overlap = Math.max(0, Math.min(oz + h, z1) - Math.max(oz, z0));
    deducted += w * overlap;
  }

  return deducted > 0 ? { deductedM2: deducted } : null;
}
