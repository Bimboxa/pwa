import { useMemo } from "react";

import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import {
  selectSelectedItem,
  selectSelectedPartIds,
} from "Features/selection/selectionSlice";

import loadStoredMesh3d from "../services/loadStoredMesh3d";
import getMesh3dPartsInfo from "../utils/getMesh3dPartsInfo";
import { getSelectedMesh3dParts } from "../utils/mesh3dPartIds";

// The faces / edges of a mesh annotation currently selected (selection slice
// parts), resolved against the stored mesh:
//
//   { annotationId, parts, faces, edges }
//
// `parts` are the parsed part ids; `faces` / `edges` carry their measures
// (getMesh3dPartsInfo) and are empty until the mesh is loaded.
export default function useSelectedMesh3dParts() {
  const selectedItem = useSelector(selectSelectedItem);
  const selectedPartIds = useSelector(selectSelectedPartIds);

  const parts = useMemo(
    () => getSelectedMesh3dParts(selectedItem, selectedPartIds),
    [selectedItem, selectedPartIds]
  );
  const annotationId = parts.length ? selectedItem.nodeId : null;

  const stored = useLiveQuery(
    () => (annotationId ? loadStoredMesh3d(annotationId) : null),
    [annotationId]
  );

  return useMemo(() => {
    const info = getMesh3dPartsInfo(stored?.mesh, parts);
    return { annotationId, parts, faces: info.faces, edges: info.edges };
  }, [annotationId, parts, stored]);
}
