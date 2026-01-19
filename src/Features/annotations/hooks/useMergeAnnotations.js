import { useDispatch } from "react-redux";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import mergeAllPolygons from "Features/geometry/utils/mergeAllPolygons";

import db from "App/db/db";


export default function useMergeAnnotations() {

    const dispatch = useDispatch();
    const baseMap = useMainBaseMap();

    return async (annotations) => {

        const polygonsList = annotations.map((annotation) => annotation.points);

        const { mergedPolygon, newPoints } = mergeAllPolygons(polygonsList);

        const annotation0 = annotations[0];
        const annotationsToDelete = annotations.filter((a, i) => i !== 0);

        const { width, height } = baseMap?.image?.imageSize || { width: 1, height: 1 };


        // create points

        await db.points.bulkAdd(newPoints.map((point) => (
            {
                ...point,
                x: point.x / width,
                y: point.y / height,
                projectId: annotation0.projectId,
                baseMapId: annotation0.baseMapId,
            }
        )));

        // update annotation0 

        await db.annotations.update(annotation0.id, {
            points: mergedPolygon,
        });

        // delete annotations

        await db.annotations.bulkDelete(annotationsToDelete.map((a) => a.id));

        // updates

        dispatch(triggerAnnotationsUpdate());
    }

}