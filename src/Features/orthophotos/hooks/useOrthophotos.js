import { useLiveQuery } from "dexie-react-hooks";

import { getOrthophotosOfBaseMap } from "../services/orthophotoServices";

const EMPTY = [];

// Live unit orthophotos of a base map, ordered (fractionalIndex, name).
export default function useOrthophotos({ baseMapId }) {
  return (
    useLiveQuery(() => getOrthophotosOfBaseMap(baseMapId), [baseMapId]) ?? EMPTY
  );
}
