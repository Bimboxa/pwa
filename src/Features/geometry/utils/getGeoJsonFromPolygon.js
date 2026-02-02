export default function getGeoJsonFromPolygon(polygon) {
    // polygon: {points:[{x,y,id}, ...], cuts: [{id, points:[{x,y,id}, ...]}]}

    const pointByXY = {};

    // Fonction utilitaire pour transformer une liste de points {x, y} en anneau GeoJSON [lon, lat]
    const formatRing = (points) => {
        const ring = points.map(point => {
            const xS = point.x.toFixed(3);
            const yS = point.y.toFixed(3);
            const key = `${xS}_${yS}`;

            // On stocke la référence du point pour une utilisation ultérieure si nécessaire
            pointByXY[key] = point;

            return [parseFloat(xS), parseFloat(yS)];
        });

        // En GeoJSON, un anneau doit impérativement être fermé (le dernier point = le premier)
        const first = ring[0];
        const last = ring[ring.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
            ring.push([first[0], first[1]]);
        }

        return ring;
    };

    // 1. On traite l'anneau extérieur
    const outerRing = formatRing(polygon.points);

    // 2. On traite les trous (cuts) s'ils existent
    const allRings = [outerRing];

    if (polygon.cuts && Array.isArray(polygon.cuts)) {
        polygon.cuts.forEach(cut => {
            if (cut.points && cut.points.length > 0) {
                allRings.push(formatRing(cut.points));
            }
        });
    }

    return {
        pointsFormatGeoJson: allRings,
        pointByXY
    };
}