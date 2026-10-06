import { useMemo } from "react";

import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import {
  selectSelectedItem,
  selectSelectedPartIds,
} from "Features/selection/selectionSlice";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

import getDisplayedMesh3d from "../services/getDisplayedMesh3d";
import loadStoredMesh3d from "../services/loadStoredMesh3d";
import getMesh3dPartsInfo from "../utils/getMesh3dPartsInfo";
import isMesh3dClosed from "../utils/isMesh3dClosed";
import { getSelectedMesh3dParts } from "../utils/mesh3dPartIds";

// The faces / edges of a mesh annotation currently selected (selection slice
// parts), resolved against the stored mesh — or, for a regular annotation
// (not a mesh yet), against the conversion of its displayed 3D object:
//
//   { annotationId, parts, faces, edges, isClosed }
//
// `parts` are the parsed part ids; `faces` / `edges` carry their measures
// (getMesh3dPartsInfo) and are empty until the mesh is loaded. `isClosed` is
// false on an open displayed mesh (a PX polyline wall): selectable, never
// written.
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
    const mesh =
      stored?.mesh ??
      (annotationId
        ? getDisplayedMesh3d(getActiveThreedEditor(), annotationId)?.mesh
        : null);
    const info = getMesh3dPartsInfo(mesh, parts);
    const isClosed = !mesh || isMesh3dClosed(mesh);
    return {
      annotationId,
      parts,
      faces: info.faces,
      edges: info.edges,
      isClosed,
    };
  }, [annotationId, parts, stored]);
}
