import { useSelector, useDispatch } from "react-redux";

import { setOpenDialogDeleteSelectedAnnotation } from "../annotationsSlice";
import { selectSelectedItems, clearSelection } from "Features/selection/selectionSlice";

import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";

import useDeleteAnnotations from "../hooks/useDeleteAnnotations";
import { isAnnotationLabelNodeId } from "../utils/annotationLabelSelection";
import useDeleteMeshes3d from "Features/threedMesh/hooks/useDeleteMeshes3d";
import { setAnnotationToolbarPosition } from "Features/mapEditor/mapEditorSlice";

export default function DialogDeleteSelectedAnnotation() {
  const dispatch = useDispatch();
  const deleteAnnotations = useDeleteAnnotations();
  const deleteMeshes3d = useDeleteMeshes3d();

  // data

  const open = useSelector((s) => s.annotations.openDialogDeleteSelectedAnnotation);
  const selectedItems = useSelector(selectSelectedItems);

  // handlers

  function handleClose() {
    dispatch(setOpenDialogDeleteSelectedAnnotation(false));
    dispatch(setAnnotationToolbarPosition(null));
  }

  async function handleDelete() {
    // MESH3D nodes live in db.meshes3d, not db.annotations — routing a maille
    // id through deleteAnnotations would target the wrong table.
    const mesh3dIds = selectedItems
      .filter((item) => item.nodeId && item.nodeType === "MESH3D")
      .map((item) => item.nodeId);
    // ANNOTATION_LABEL items ("label::<id>") are never deletable here: a
    // label is hidden, not deleted (Delete key handlers).
    const annotationIds = selectedItems
      .filter(
        (item) =>
          item.nodeId &&
          item.nodeType !== "MESH3D" &&
          item.type !== "ANNOTATION_LABEL" &&
          !isAnnotationLabelNodeId(item.nodeId)
      )
      .map((item) => item.nodeId);
    if (mesh3dIds.length === 0 && annotationIds.length === 0) return;

    if (mesh3dIds.length > 0) await deleteMeshes3d(mesh3dIds);
    if (annotationIds.length > 0) await deleteAnnotations(annotationIds);
    dispatch(clearSelection());
    handleClose();
  }
  // render

  return (
    <DialogDeleteRessource
      open={open}
      onConfirmAsync={handleDelete}
      onClose={handleClose}
    />
  );
}
