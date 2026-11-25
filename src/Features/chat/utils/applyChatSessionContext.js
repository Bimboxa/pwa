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
  // A context without a scope keeps the current one: useEnsureSelectedScope
  // re-selects a scope of the project if it does not belong to it.
  if (context.scopeId) dispatch(setSelectedScopeId(context.scopeId));
  dispatch(setSelectedBaseMapsListingId(context.baseMapListingId ?? null));
  dispatch(setSelectedMainBaseMapId(context.baseMapId));
}
