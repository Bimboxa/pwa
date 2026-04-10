import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db"
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

export default function useBaseMapTransforms() {

    const appConfig = useAppConfig();
    const imageTransformationPrompts = appConfig?.imageTransformationPrompts ?? [];

    const transforms = useLiveQuery(async () => {
        return await db.baseMapTransforms.toArray();
    }, [])

    if (!transforms) return null;

    return [
        ...imageTransformationPrompts.map(t => ({ ...t, isDefault: true })),
        ...transforms,
    ].sort((a, b) => (a.name || "").localeCompare(b.name || ""))
}
