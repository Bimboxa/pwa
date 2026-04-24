// Compute the signed area of a polygon (2D shoelace, pixel space).
// Positive = counter-clockwise in the math sense (y up), but since SVG/DOM
// y grows downward, the "visual" sign flips — we only use the sign to pick
// which side of an edge lies *inside* the polygon, so absolute orientation
// doesn't matter as long as we use the same convention everywhere.
export function getPolygonSignedArea(points) {
    if (!points || points.length < 3) return 0;
    let sum = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
        const p0 = points[i];
        const p1 = points[(i + 1) % n];
        if (!p0 || !p1) continue;
        sum += p0.x * p1.y - p1.x * p0.y;
    }
    return sum / 2;
}

// Given a segment (p0, p1) of a closed contour, return the segment's SVG path
// `d` (at the original position) and the unit-length perpendicular `(nx, ny)`
// that points toward the contour interior. The caller applies the offset as
// a zoom-adaptive CSS translate so the indicator stays a constant number of
// screen pixels from the edge at any zoom level.
//
// For cuts the interior is flipped so the indicator lands in the polygon
// fill region, not inside the hole.
//
// Returns `null` for arc segments (seg.isArc) — v1 scope is straight only.
export default function getInnerOffsetSegmentPath({
    seg,
    contourPoints,
    isCut,
}) {
    if (!seg || seg.isArc) return null;
    if (!contourPoints || contourPoints.length < 3) return null;

    const p0 = contourPoints[seg.startPointIdx];
    const p1 = contourPoints[seg.endPointIdx];
    if (!p0 || !p1) return null;

    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) return null;

    // Left-hand perpendicular (rotate +90° in screen coords).
    const nxLeft = -dy / len;
    const nyLeft = dx / len;

    const signedArea = getPolygonSignedArea(contourPoints);
    // In SVG coords (y-down), the shoelace signed area is positive for a
    // contour wound clockwise on screen. For that orientation the left-hand
    // perpendicular points into the polygon interior — hence
    // `interiorSign = +sign(signedArea)`. For a cut the fill is on the
    // OUTSIDE of the cut polygon, so we flip the sign.
    const interiorSign = Math.sign(signedArea || 1);
    const sign = isCut ? -interiorSign : interiorSign;

    return {
        d: `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y}`,
        nx: nxLeft * sign,
        ny: nyLeft * sign,
    };
}
