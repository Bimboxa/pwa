import { useLiveQuery } from "dexie-react-hooks";
import { useSelector } from "react-redux";

import db from "App/db/db";

export default function useBaseMapAnnotations() {

    // data

    const baseMapId = useSelector(s => s.mapEditor.selectedBaseMapId);

    // main
    return useLiveQuery(async () => {
        if (baseMapId) {
            let annotations = await db.annotations.where("baseMapId").equals(baseMapId).toArray()
            annotations = annotations.filter(a => a.isBaseMapAnnotation);
            return annotations;
        }
        return [];
    }, [baseMapId]);
}