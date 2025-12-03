import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import { useLiveQuery } from "dexie-react-hooks";

import resolvePoints from "Features/annotations/utils/resolvePoints";

import db from "App/db/db";

import getItemsByKey from "Features/misc/utils/getItemsByKey";

export default function useAnnotationsV2() {

    // data

    const baseMap = useMainBaseMap();

    // main
    return useLiveQuery(async () => {
        if (baseMap?.id) {


            // points index
            const points = await db.points.where("baseMapId").equals(baseMap?.id).toArray();
            const pointsIndex = getItemsByKey(points, "id");

            // annotations
            let _annotations = await db.annotations.where("baseMapId").equals(baseMap?.id).toArray();
            _annotations = _annotations.map(annotation => ({
                ...annotation,
                points: resolvePoints({ points: annotation.points, pointsIndex, imageSize: baseMap.image.imageSize })

            }))

            return _annotations;
        }

    }, [baseMap?.id]);
}