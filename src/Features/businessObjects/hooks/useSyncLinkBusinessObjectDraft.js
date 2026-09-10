import { useEffect } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";

import {
  patchNewAnnotation,
  setNewAnnotation,
} from "Features/annotations/annotationsSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";

import { isBusinessObjectsModuleKey } from "../utils/businessObjectModuleKeys";
import selectLinkBusinessObjectDraftId from "../utils/selectLinkBusinessObjectDraftId";
import getLinkBusinessObjectDraftProps from "../utils/getLinkBusinessObjectDraftProps";

// Keeps a draw armed with the LINK_BUSINESS_OBJECT interceptor in sync with
// the module's ACTIVE object. The draft is only replaced by Escape or a new
// arm, while the active id is cleared from several places (toggle on the tree
// row, object deletion, quick edit, work package activation, listing / module
// switch) — one effect covers them all:
// - no active object any more (or not a business-objects module) → the draw
//   is disarmed and the interceptor dropped (nothing to attach to);
// - another object became active → the interceptor context follows it.
export default function useSyncLinkBusinessObjectDraft() {
  const dispatch = useDispatch();
  const store = useStore();

  const draftBusinessObjectId = useSelector(selectLinkBusinessObjectDraftId);
  const activeBusinessObjectId = useSelector(
    (s) => s.businessObjects?.activeBusinessObjectId ?? null
  );
  const isBusinessObjectsModule = useSelector((s) =>
    isBusinessObjectsModuleKey(s.viewers.selectedViewerKey)
  );

  useEffect(() => {
    if (!draftBusinessObjectId) return;
    if (!isBusinessObjectsModule || !activeBusinessObjectId) {
      // eslint-disable-next-line no-unused-vars
      const { commitInterceptor, ...stripped } =
        store.getState().annotations.newAnnotation ?? {};
      dispatch(setEnabledDrawingMode(null));
      dispatch(setNewAnnotation(stripped));
      return;
    }
    if (activeBusinessObjectId !== draftBusinessObjectId) {
      dispatch(
        patchNewAnnotation(
          getLinkBusinessObjectDraftProps(activeBusinessObjectId)
        )
      );
    }
  }, [
    draftBusinessObjectId,
    activeBusinessObjectId,
    isBusinessObjectsModule,
    dispatch,
    store,
  ]);
}
