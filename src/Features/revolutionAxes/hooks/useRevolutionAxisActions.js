import { useDispatch } from "react-redux";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import { clearSelection } from "Features/selection/selectionSlice";

import useDeleteAnnotation from "Features/annotations/hooks/useDeleteAnnotation";
import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";
import resyncRevolutionAxisPlacementsService from "Features/elevation/services/resyncRevolutionAxisPlacementsService";
import setRevolutionAxisHalfViewService from "../services/setRevolutionAxisHalfViewService";

const DEFAULT_ANGLE_START_DEG = 0;
const DEFAULT_ANGLE_END_DEG = 180;

// Actions of a plan REVOLUTION_AXIS shared by its quick-action overlay
// (NodeRevolutionAxisOverlayStatic) and its edit toolbar.
//
// `invertHalf` changes the pose of every vertical base map this axis places,
// so it runs the resync service after writing. The 3D half-view is a view
// setting open to anyone (not gated by the axis ownership).
export default function useRevolutionAxisActions(axis) {
  const dispatch = useDispatch();

  // data

  const updateAnnotation = useUpdateAnnotation();
  const deleteAnnotation = useDeleteAnnotation();

  // helpers

  const isPartial = Boolean(axis?.partialRevolution);
  // Display-only, on unless explicitly switched off.
  const isHalfView = axis?.halfViewIn3d !== false;

  // handlers

  async function toggleInvertHalf() {
    if (!axis?.id) return;
    await updateAnnotation({ id: axis.id, invertHalf: !axis.invertHalf });
    await resyncRevolutionAxisPlacementsService({ axisId: axis.id, dispatch });
  }

  async function togglePartial() {
    if (!axis?.id) return;
    const next = !isPartial;
    const updates = { id: axis.id, partialRevolution: next };
    if (next && axis.revolutionAngleStartDeg == null) {
      updates.revolutionAngleStartDeg = DEFAULT_ANGLE_START_DEG;
      updates.revolutionAngleEndDeg = DEFAULT_ANGLE_END_DEG;
    }
    await updateAnnotation(updates);
  }

  async function toggleHalfView() {
    if (!axis?.id) return;
    await setRevolutionAxisHalfViewService(axis.id, !isHalfView);
    dispatch(triggerAnnotationsUpdate());
  }

  async function deleteAxis() {
    if (!axis?.id) return;
    await deleteAnnotation(axis.id);
    dispatch(clearSelection());
  }

  return {
    isPartial,
    isHalfView,
    toggleInvertHalf,
    togglePartial,
    toggleHalfView,
    deleteAxis,
  };
}
