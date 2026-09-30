import { openScene3dImportDialog } from "../scene3dSlice";

// Arming a SCENE_3D tool does not start the draw right away: the scan files
// are picked (and converted) first, in the import dialog, which then arms
// the ONE_CLICK placement with the scan descriptor on the draft.
// Returns true when the arming was taken over (the caller must stop there).
export default function startScene3dImport(dispatch, { draft, drawingMode }) {
  if (draft?.type !== "SCENE_3D" && draft?.drawingShape !== "SCENE_3D") {
    return false;
  }
  dispatch(openScene3dImportDialog({ draftProps: draft, drawingMode }));
  return true;
}
