import { useDispatch, useSelector } from "react-redux";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import { setToaster } from "Features/layout/layoutSlice";

import createBlockInstanceService from "../services/createBlockInstanceService";

// Commit of the one-click placement armed by usePlaceBlockInstance.
// Returns async ({newAnnotation, baseMap, pointPx}) => instance | null.
//   baseMap: the host BaseMap (hydrated); pointPx: the click in its pixels.
export default function useCommitBlockInstance() {
  const dispatch = useDispatch();

  // strings

  const nestedS =
    "Un bloc ne peut pas être inséré sur un fond de plan de blocs.";
  const noScopeS = "Sélectionnez un Krto avant d'insérer un bloc.";

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const activeLayerId = useSelector((s) => s.layers?.activeLayerId);

  // main

  return async function commitBlockInstance({ newAnnotation, baseMap, pointPx }) {
    const imageSize = baseMap?.getImageSize?.();
    if (!imageSize?.width || !imageSize?.height || !pointPx) return null;

    if (baseMap.isBlocksBaseMap) {
      dispatch(setToaster({ message: nestedS, severity: "warning" }));
      return null;
    }
    if (!projectId || !scopeId) {
      dispatch(setToaster({ message: noScopeS, severity: "warning" }));
      return null;
    }

    const instance = await createBlockInstanceService({
      blockId: newAnnotation?.instanceOfBlockId,
      baseMapId: baseMap.id,
      anchor: {
        x: pointPx.x / imageSize.width,
        y: pointPx.y / imageSize.height,
      },
      projectId,
      scopeId,
      layerId: activeLayerId ?? null,
    });
    if (instance) dispatch(triggerAnnotationsUpdate());
    return instance;
  };
}
