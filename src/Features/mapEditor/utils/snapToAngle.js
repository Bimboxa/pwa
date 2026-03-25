const snapToAngle = (currentPos, lastPoint, angleOffsetDeg = 0) => {
    if (!lastPoint) return currentPos;

    const dx = currentPos.x - lastPoint.x;
    const dy = currentPos.y - lastPoint.y;

    // 1. Trouver l'angle brut
    const angleRad = Math.atan2(dy, dx);
    const angleDeg = (angleRad * 180) / Math.PI;

    // 2. Trouver l'angle cible le plus proche (par pas de 45°, décalé par l'offset)
    // Negate offset so a positive value rotates the snap grid counter-clockwise (screen coords)
    const snapIncrement = 45;
    const shifted = angleDeg + angleOffsetDeg;
    const snappedAngleDeg = Math.round(shifted / snapIncrement) * snapIncrement - angleOffsetDeg;
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