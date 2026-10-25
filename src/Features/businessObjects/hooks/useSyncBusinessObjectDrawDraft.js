import { useEffect } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";

import {
  patchNewAnnotation,
  setNewAnnotation,
} from "Features/annotations/annotationsSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";

import { isBusinessObjectsModuleKey } from "../utils/businessObjectModuleKeys";
import selectLinkBusinessObjectDraftId from "../utils/selectLinkBusinessObjectDraftId";
import selectLocatingBusinessObjectId from "../utils/selectLocatingBusinessObjectId";
import getLinkBusinessObjectDraftProps from "../utils/getLinkBusinessObjectDraftProps";
import { isTemplatelessAnnotation } from "Features/annotations/utils/templatelessAnnotations";

// Keeps a draw armed with a business-object interceptor (LINK_BUSINESS_OBJECT
// or LOCATE_BUSINESS_OBJECT) in sync with the module's ACTIVE object. The
// draft is only replaced by Escape or a new arm, while the active id is
// cleared from several places (toggle on the tree row, object deletion, quick
// edit, work package activation, listing / module switch) — one effect covers
// them all:
// - no active object any more (or not a business-objects module) → the draw
//   is disarmed and the interceptor dropped (nothing to attach to); a
//   templateless LOCATE draft also loses the business-objects listingId it
//   carried (a plain « Dessin » draft has none);
// - another object became active → a LINK draft follows it (plain rel, any
//   template); a LOCATE draft is disarmed instead: its template / listing was
//   chosen for the previous object's listing and may not locate the new one.
export default function useSyncBusinessObjectDrawDraft() {
  const dispatch = useDispatch();
  const store = useStore();

  const linkDraftBusinessObjectId = useSelector(
    selectLinkBusinessObjectDraftId
  );
  const locateDraftBusinessObjectId = useSelector(
    selectLocatingBusinessObjectId
  );
  const activeBusinessObjectId = useSelector(
    (s) => s.businessObjects?.activeBusinessObjectId ?? null
  );
  const isBusinessObjectsModule = useSelector((s) =>
    isBusinessObjectsModuleKey(s.viewers.selectedViewerKey)
  );

  useEffect(() => {
    const draftBusinessObjectId =
      linkDraftBusinessObjectId ?? locateDraftBusinessObjectId;
    if (!draftBusinessObjectId) return;

    const disarm = () => {
      // eslint-disable-next-line no-unused-vars
      const { commitInterceptor, ...stripped } =
        store.getState().annotations.newAnnotation ?? {};
      if (isTemplatelessAnnotation(stripped)) delete stripped.listingId;
      dispatch(setEnabledDrawingMode(null));
      dispatch(setNewAnnotation(stripped));
    };

    if (!isBusinessObjectsModule || !activeBusinessObjectId) {
      disarm();
      return;
    }
    if (activeBusinessObjectId === draftBusinessObjectId) return;
    if (locateDraftBusinessObjectId) {
      disarm();
      return;
    }
    dispatch(
      patchNewAnnotation(
        getLinkBusinessObjectDraftProps(activeBusinessObjectId)
      )
    );
  }, [
    linkDraftBusinessObjectId,
    locateDraftBusinessObjectId,
    activeBusinessObjectId,
    isBusinessObjectsModule,
    dispatch,
    store,
  ]);
}
