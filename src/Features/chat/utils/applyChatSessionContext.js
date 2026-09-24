import { setSelectedProjectId } from "Features/projects/projectsSlice";
import { setSelectedScopeId } from "Features/scopes/scopesSlice";
import {
  setSelectedMainBaseMapId,
  setSelectedBaseMapsListingId,
} from "Features/mapEditor/mapEditorSlice";

// Empty sessions keep the current application context until their first send.
export default function applyChatSessionContext(dispatch, context) {
  if (!context) return;
  dispatch(setSelectedProjectId(context.projectId));
  dispatch(setSelectedScopeId(context.scopeId));
  dispatch(setSelectedBaseMapsListingId(context.baseMapListingId ?? null));
  dispatch(setSelectedMainBaseMapId(context.baseMapId));
}
