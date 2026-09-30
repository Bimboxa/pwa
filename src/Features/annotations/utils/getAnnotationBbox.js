import getScene3dFootprintCorners from "Features/scene3d/utils/getScene3dFootprintCorners";

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

    // 2. SCENE_3D (3D scan): axis-aligned box of the ROTATED footprint — the
    // footprint is large, the raw bbox would wrongly cull / miss a rotated scan.
    else if (annotation.type === 'SCENE_3D') {
        const corners = getScene3dFootprintCorners(annotation);
        if (corners.length === 0) return null;
        const xs = corners.map((c) => c.x);
        const ys = corners.map((c) => c.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        return {
            x: minX,
            y: minY,
            width: Math.max(...xs) - minX,
            height: Math.max(...ys) - minY
        };
    }

    // 3. Cas POINT / MARKER / LABEL (Point central +/- taille arbitraire)
    else if (annotation.point || annotation.targetPoint) {
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

    // 2. Cas POLYLINE / POLYGON (Min/Max des points)
    else if (annotation.points && annotation.points.length > 0) {
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



    return null;
}