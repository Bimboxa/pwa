const DEGENERATE_SEGMENT_EPSILON = 1e-6;

// Signed angular difference a - b, normalized to [-180, 180]
const getAngleDeltaDeg = (a, b) => {
    const delta = (a - b) % 360;
    if (delta > 180) return delta - 360;
    if (delta < -180) return delta + 360;
    return delta;
};

// prevPoint (optional) is the start of the last drawn segment (prevPoint -> lastPoint).
// When provided, the directions aligned with / perpendicular to that segment are added
// as snap candidates next to the grid ones; the candidate closest to the cursor wins.
const snapToAngle = (currentPos, lastPoint, angleOffsetDeg = 0, snapIncrement = 45, prevPoint = null) => {
    if (!lastPoint) return currentPos;

    const dx = currentPos.x - lastPoint.x;
    const dy = currentPos.y - lastPoint.y;

    // 1. Trouver l'angle brut
    const angleRad = Math.atan2(dy, dx);
    const angleDeg = (angleRad * 180) / Math.PI;

    // 2. Trouver l'angle cible le plus proche (par pas de snapIncrement°, décalé par l'offset)
    // Negate offset so a positive value rotates the snap grid counter-clockwise (screen coords)
    const shifted = angleDeg + angleOffsetDeg;
    let snappedAngleDeg = Math.round(shifted / snapIncrement) * snapIncrement - angleOffsetDeg;

    // 2b. Last-segment candidate: 0° / 90° / 180° / 270° relative to the last drawn segment.
    // On a tie the grid candidate wins, so a segment already on the grid changes nothing.
    if (prevPoint) {
        const segDx = lastPoint.x - prevPoint.x;
        const segDy = lastPoint.y - prevPoint.y;
        if (Math.hypot(segDx, segDy) > DEGENERATE_SEGMENT_EPSILON) {
            const segmentAngleDeg = (Math.atan2(segDy, segDx) * 180) / Math.PI;
            const relativeDeg = getAngleDeltaDeg(angleDeg, segmentAngleDeg);
            const segmentSnappedAngleDeg = segmentAngleDeg + Math.round(relativeDeg / 90) * 90;
            const gridDelta = Math.abs(getAngleDeltaDeg(angleDeg, snappedAngleDeg));
            const segmentDelta = Math.abs(getAngleDeltaDeg(angleDeg, segmentSnappedAngleDeg));
            if (segmentDelta < gridDelta) snappedAngleDeg = segmentSnappedAngleDeg;
        }
    }

    const snappedAngleRad = (snappedAngleDeg * Math.PI) / 180;

    // 3. PROJECTION (La correction magique)
    // On projette le vecteur souris (dx, dy) sur le vecteur unitaire de l'angle snappé
    // Formule produit scalaire : |proj| = dx * cos(theta) + dy * sin(theta)
    const unitX = Math.cos(snappedAngleRad);
    const unitY = Math.sin(snappedAngleRad);

    // Distance projetée sur la ligne idéale
    const projectedDistance = dx * unitX + dy * unitY;

    return {
        x: lastPoint.x + projectedDistance * unitX,
        y: lastPoint.y + projectedDistance * unitY
    };
};

export default snapToAngle;