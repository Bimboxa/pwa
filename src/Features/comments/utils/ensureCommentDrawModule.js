import {
  setModuleEditorKey,
  setSelectedViewerKey,
} from "Features/viewers/viewersSlice";

import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";
import { isBusinessObjectsModuleKey } from "Features/businessObjects/utils/businessObjectModuleKeys";
import { selectDisabledModuleKeys } from "Features/scopeConfig/utils/scopeConfigSelectors";

const DRAW_MODULE_KEY = "MAP";

// Modules where an annotation template is drawn: Dessin and the
// business-objects modules.
function isDrawModuleKey(moduleKey) {
  return moduleKey === DRAW_MODULE_KEY || isBusinessObjectsModuleKey(moduleKey);
}

// Module the draw happens in: the displayed one when it draws, else the
// module the info was written from (viewContext.moduleKey) when it draws and
// is still enabled, else Dessin.
function resolveDrawModuleKey(state, sourceModuleKey) {
  const currentKey = state.viewers.selectedViewerKey;
  if (isDrawModuleKey(currentKey)) return currentKey;
  if (
    isDrawModuleKey(sourceModuleKey) &&
    !selectDisabledModuleKeys(state).includes(sourceModuleKey)
  )
    return sourceModuleKey;
  return DRAW_MODULE_KEY;
}

// Sends the reader of an info to a module that draws before one of its action
// blocks runs (the info stays opened there: LayerComments is mounted in every
// module), in its 2D editor when `needs2dEditor` and a 3D editor is shown.
// The MODULE switch stops any drawing in progress (mapEditorSlice
// extraReducer): call it before arming a draft. Returns the module key.
export default function ensureCommentDrawModule({
  store,
  dispatch,
  sourceModuleKey = null,
  needs2dEditor = false,
}) {
  const moduleKey = resolveDrawModuleKey(store.getState(), sourceModuleKey);
  if (store.getState().viewers.selectedViewerKey !== moduleKey) {
    dispatch(setSelectedViewerKey(moduleKey));
  }
  if (
    needs2dEditor &&
    isThreedFamilyViewerKey(selectEffectiveViewerKey(store.getState()))
  ) {
    dispatch(setModuleEditorKey({ moduleKey, editorKey: "MAP" }));
  }
  return moduleKey;
}
