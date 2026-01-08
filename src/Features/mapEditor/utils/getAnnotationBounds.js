// used to get bounds to zoom on one annotation

export default function getAnnotationBounds(annotation, basePose) {

    let bounds = null;

    // CAS A : Polygone / Ligne
    if (annotation.points && annotation.points.length > 0) {
        // Mapping : Normalisé (0-1) -> Pixel Image -> Monde
        // (Si vos points sont déjà en pixels, retirez imgSize.width)
        const worldPoints = annotation.points.map(p => ({
            x: (p.x) * basePose.k + basePose.x,
            y: (p.y) * basePose.k + basePose.y
        }));

        const xs = worldPoints.map(p => p.x);
        const ys = worldPoints.map(p => p.y);
        const minX = Math.min(...xs); const maxX = Math.max(...xs);
        const minY = Math.min(...ys); const maxY = Math.max(...ys);

        bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
    // CAS B : Marker / Point
    else if (annotation.point || annotation.x !== undefined) {
        const lx = (annotation.point?.x ?? annotation.x);
        const ly = (annotation.point?.y ?? annotation.y);

        const wx = lx * basePose.k + basePose.x;
        const wy = ly * basePose.k + basePose.y;

        // On définit une zone de 200px autour du point pour ne pas zoomer trop fort
        const size = 50;
        bounds = { x: wx - size / 2, y: wy - size / 2, width: size, height: size };
    }

    return bounds;
}
