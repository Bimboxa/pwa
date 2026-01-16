// Features/geometry/utils/getAnnotationBBox.js

export default function getAnnotationBBox(annotation) {
    if (!annotation) return null;

    // 1. Cas IMAGE / RECTANGLE (Bbox explicite)
    if (annotation.type === 'IMAGE' || annotation.type === 'RECTANGLE') {
        const bbox = annotation.bbox;
        if (!bbox) return null;
        // Note: Si l'objet est tourné, la BBox Axis-Aligned (AABB) est plus complexe.
        // Pour une sélection lasso simple, on prend souvent la bbox brute non tournée, 
        // ou on projette les 4 coins si on veut être précis. Ici version simple :
        return {
            x: bbox.x,
            y: bbox.y,
            width: bbox.width,
            height: bbox.height
        };
    }

    // 2. Cas POLYLINE / POLYGON (Min/Max des points)
    if (annotation.points && annotation.points.length > 0) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        annotation.points.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
        });

        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    // 3. Cas POINT / MARKER / LABEL (Point central +/- taille arbitraire)
    if (annotation.point || annotation.targetPoint) {
        const pt = annotation.point || annotation.targetPoint;
        // On définit une zone de "hit" arbitraire (ex: 10 unités locales)
        const size = 0.05; // Attention à l'échelle de votre carte (mètres vs ratio)
        return {
            x: pt.x - size / 2,
            y: pt.y - size / 2,
            width: size,
            height: size
        };
    }

    return null;
}