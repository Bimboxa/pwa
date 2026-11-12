import {
  setAnnotationToolbarPosition,
  setAnnotationsToolbarPosition,
  setSelectedNode,
} from "Features/mapEditor/mapEditorSlice";
import {
  setSelectedItem,
  setShowAnnotationsProperties,
  toggleItemSelection,
} from "Features/selection/selectionSlice";
import { clearSubSelection } from "Features/threedEditor/threedEditorSlice";
import {
  PICK_ANGULAR,
  PICK_MIN_M,
} from "Features/threedEditor/js/utilsAnnotationsManager/attachFatLineRaycast";
import { filterIntersectionsByClipping } from "Features/threedEditor/js/utilsAnnotationsManager/clippingPick";
import { filterIntersectionsByVisibility } from "Features/threedEditor/js/utilsAnnotationsManager/visibilityPick";

import { getCutLineLines } from "../services/cutLineObjectsStore";

// A face hit this many pick tolerances in front of the line hides it (the
// line lies ON a face: at a grazing view the two hits are not at the same
// distance along the ray).
const OCCLUSION_TOLERANCE_FACTOR = 3;

// Click pre-pass on the cut lines (the Line2 segments published to
// cutLineObjectsStore carry the fat-line raycast; the `.isMesh` annotation
// picks of MainThreedEditor and of the Maillage module skip fat lines).
// `raycaster` must already be set from the pointer. `lines` restricts the
// pick to some segments (default: every rendered cut line). Returns the hit
// { annotationId, line, distance, point } or null.
export function pickCutLine(raycaster, clippingPlane, { lines } = {}) {
  const targets = lines || getCutLineLines();
  if (!targets.length) return null;
  const hits = filterIntersectionsByClipping(
    raycaster.intersectObjects(targets, false),
    clippingPlane
  ).sort((a, b) => a.distance - b.distance);
  const hit = hits[0];
  const line = hit?.object;
  const annotationId = line?.userData?.annotationId;
  return annotationId
    ? { annotationId, line, distance: hit.distance, point: hit.point }
    : null;
}

// pickCutLine for the hover / grab paths: the segments are depth-tested, a
// line hidden behind a solid must not answer. The hit is dropped when a face
// of the scene is met clearly in front of it. `occluderDistance`: distance of
// the first face under the cursor when the caller already knows it (skips
// the scene raycast).
export function pickVisibleCutLine(
  raycaster,
  sceneManager,
  { lines, clippingPlane, occluderDistance } = {}
) {
  const hit = pickCutLine(raycaster, clippingPlane, { lines });
  if (!hit) return null;
  const tolerance =
    OCCLUSION_TOLERANCE_FACTOR *
    Math.max(PICK_MIN_M, PICK_ANGULAR * hit.distance);
  let nearest = occluderDistance;
  if (nearest === undefined) {
    // Same explicit targets as the meshing pick (fat lines left out: their
    // raycast is irrelevant here and they never hide anything).
    const targets = [];
    sceneManager?.scene?.traverse((obj) => {
      if (obj.isMesh && !obj.isLine2 && !obj.isLineSegments2) targets.push(obj);
    });
    const faces = filterIntersectionsByVisibility(
      filterIntersectionsByClipping(
        raycaster.intersectObjects(targets, false),
        clippingPlane
      )
    );
    nearest = faces[0]?.distance;
  }
  if (Number.isFinite(nearest) && nearest < hit.distance - tolerance) {
    return null;
  }
  return hit;
}

// Selection of a clicked cut line, with the same payload as the generic
// annotation branch (normal popper / properties / Delete-key flows); Shift
// toggles it in the selection. A click on the already-selected line is a
// no-op here (its vertices are the sub-selectable parts —
// useCutLineVertexHandlers).
export function handleCutLineClick({ dispatch, selectedItems, hit, event }) {
  const { annotationId } = hit;
  const position = { x: event.clientX, y: event.clientY };
  const item = {
    id: annotationId,
    nodeId: annotationId,
    type: "NODE",
    nodeType: "ANNOTATION",
    annotationType: "CUT_LINE",
    listingId: null,
    annotationTemplateId: null,
  };
  if (event.shiftKey) {
    dispatch(toggleItemSelection(item));
  } else {
    const alreadySolo =
      selectedItems?.length === 1 &&
      selectedItems[0]?.nodeType === "ANNOTATION" &&
      selectedItems[0]?.nodeId === annotationId;
    if (alreadySolo) return;
    dispatch(
      setSelectedNode({
        id: annotationId,
        nodeId: annotationId,
        nodeType: "ANNOTATION",
        annotationType: "CUT_LINE",
        listingId: null,
      })
    );
    dispatch(setSelectedItem(item));
    dispatch(setShowAnnotationsProperties(true));
  }
  dispatch(clearSubSelection());
  dispatch(setAnnotationToolbarPosition(position));
  dispatch(setAnnotationsToolbarPosition(position));
}
