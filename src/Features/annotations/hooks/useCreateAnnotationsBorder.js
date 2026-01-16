import useCreateAnnotation from "./useCreateAnnotation";

import getAnnotationsWithResolvedPointsAsync from "../services/getAnnotationsWithResolvedPointsAsync";
import getAnnotationsPoints from "../utils/getAnnotationsPoints";
import getConvexHull from "Features/geometry/utils/getConvexHull";
import offsetPolygon from "Features/geometry/utils/offsetPolygon";

import db from "App/db/db";

export default function useCreateAnnotationsBorder() {


    // data

    const createAnnotation = useCreateAnnotation();

    // return 

    return async ({ annotationIds, annotationTemplateId, offset }) => {

        const annotations = await getAnnotationsWithResolvedPointsAsync(annotationIds, { pointsInRatio: true });

        const annotation0 = annotations?.[0];
        const size0 = annotation0?.baseMapImageSize;
        const ratio0 = size0?.width / size0?.height;
        const meterByPx0 = annotation0?.baseMapMeterByPx;


        const _width = 1000;
        const _height = _width / ratio0;

        const offsetInPx = offset / meterByPx0 * _width / size0?.width;

        const annotationPoints = getAnnotationsPoints(annotations, { imageSize: { width: _width, height: _height } })

        let points = getConvexHull(annotationPoints)

        // create new points with offset

        console.log("debug_161_offsetInPx", offsetInPx, points)

        if (offsetInPx > 0) {
            const newPoints = offsetPolygon(points, offsetInPx)
            points = newPoints.map(p => ({
                ...p,
                x: p.x / _width,
                y: p.y / _height,
                projectId: annotation0?.projectId,
                baseMapId: annotation0?.baseMapId,
            }))
            await db.points.bulkAdd(points)
        }

        const newAnnotation = {
            annotationTemplateId,
            points,
            baseMapId: annotation0?.baseMapId,
            closeLine: true,
        }

        let _annotation

        if (points?.length > 0 && annotationTemplateId && annotation0) {
            _annotation = await createAnnotation(newAnnotation)
        }



        return _annotation
    }

}