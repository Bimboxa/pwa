import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db"
import initialTransforms from "../inialTransforms";

export default function useBaseMapTransforms() {

    const transforms = useLiveQuery(async () => {
        return await db.baseMapTransforms.toArray();
    }, [])

    if (!transforms) return null;

    return [...initialTransforms, ...transforms]
}