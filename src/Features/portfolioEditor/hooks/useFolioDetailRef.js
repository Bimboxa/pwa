import { useLiveQuery } from "dexie-react-hooks";

import getFolioDetailRef from "../utils/getFolioDetailRef";

export default function useFolioDetailRef(page) {
  const refNumber = useLiveQuery(
    () => getFolioDetailRef(page),
    [page?.sourceAnnotationId]
  );
  return refNumber ?? null;
}
