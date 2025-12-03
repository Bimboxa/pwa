import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";
import db from "App/db/db";
import getItemsByKey from "Features/misc/utils/getItemsByKey";


export default function usePoints(options) {

    // options

    const variant = options?.variant;
    const _baseMapId = options?.baseMapId;

    // baseMapId

    let baseMapId = useSelector(s => s.mapEditor.selectedBaseMapId)
    if (_baseMapId) {
        baseMapId = _baseMapId;
    }

    // main

    let points = useLiveQuery(async () => {
        return await db.points.where("baseMapId").equals(baseMapId).toArray()
    }, [baseMapId]);

    if (variant === "byId") {
        points = getItemsByKey(points, "id");
    }
    return points;
}