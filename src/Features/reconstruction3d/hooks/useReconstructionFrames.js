import { useLiveQuery } from "dexie-react-hooks";

import { getReconstructionFramesOfBaseMap } from "../services/reconstructionFramesServices";

const EMPTY = [];

// Live images (photos / video frames) of a 3D reconstruction base map, in
// order (index).
export default function useReconstructionFrames({ baseMapId }) {
  return (
    useLiveQuery(
      () => getReconstructionFramesOfBaseMap(baseMapId),
      [baseMapId]
    ) ?? EMPTY
  );
}
