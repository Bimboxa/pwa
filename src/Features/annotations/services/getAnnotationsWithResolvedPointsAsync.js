import db from "App/db/db";

export default async function getAnnotationsWithResolvedPointsAsync(
    annotationIds,
    options,
) {

    // edge case

    if (!annotationIds || annotationIds.length === 0) return [];

    // options

    const pointsInRatio = options?.pointsInRatio;

    // annotations

    const annotations = await db.annotations.where("id").anyOf(annotationIds).toArray();

    //  points & baseMaps

    const baseMapIds = [...new Set(annotations.map(a => a.baseMapId))];

    const points = await db.points.where("baseMapId").anyOf(baseMapIds).toArray();
    const baseMaps = await db.baseMaps.where("id").anyOf(baseMapIds).toArray();

    const pointsById = points.reduce((acc, point) => {
        acc[point.id] = point;
        return acc;
    }, {});

    const baseMapsById = baseMaps.reduce((acc, baseMap) => {
        acc[baseMap.id] = baseMap;
        return acc;
    }, {});

    // annotationsWithResolvedPoints

    const annotationsWithResolvedPoints = annotations.map(a => {
        const baseMap = baseMapsById[a.baseMapId];
        const { width, height } = baseMap.image.imageSize;
        const points = a.points.map(p => {
            const point = pointsById[p.id];
            const x = pointsInRatio ? point.x : point.x * width;
            const y = pointsInRatio ? point.y : point.y * height;
            return {
                ...p,
                x,
                y,
            }
        });
        return {
            ...a,
            points,
            baseMapImageSize: { width, height },
            baseMapMeterByPx: baseMap.meterByPx,
        }
    })

    // return 
    return annotationsWithResolvedPoints;
}