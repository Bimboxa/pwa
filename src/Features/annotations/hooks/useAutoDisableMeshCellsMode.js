import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setShowMeshCells } from "Features/annotations/annotationsSlice";
import useMeshCellRelations from "Features/annotations/hooks/useMeshCellRelations";

// Auto-disable the shared "mailles" display mode when no mesh cells remain in
// the project. Both the 2D and 3D toggles are hidden when there are no cells,
// so the user could otherwise never turn the mode off by hand (e.g. after
// deleting the last meshed annotation). Mount once, high in the tree.
export default function useAutoDisableMeshCellsMode() {
  const dispatch = useDispatch();
  const showMeshCells = useSelector((s) => s.annotations.showMeshCells);
  const { parentIdSet } = useMeshCellRelations();

  useEffect(() => {
    if (showMeshCells && parentIdSet.size === 0) {
      dispatch(setShowMeshCells(false));
    }
  }, [showMeshCells, parentIdSet, dispatch]);
}
