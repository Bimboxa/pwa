import { useCallback } from "react";
import { useStore } from "react-redux";
import { captureSessionContext } from "../chatSlice";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";

// Read the scoped store at send time so repeated sends never replace the origin.
export default function useCaptureSessionContext() {
  const store = useStore();
  const baseMap = useMainBaseMap();
  const { value: scope } = useSelectedScope();
  return useCallback(() => {
    const state = store.getState();
    const projectId = state.projects.selectedProjectId;
    const scopeId = state.scopes.selectedScopeId;
    const baseMapId = state.mapEditor.selectedBaseMapId;
    store.dispatch(
      captureSessionContext({
        projectId: projectId ?? null,
        projectName: state.projects.projectsById[projectId]?.name ?? null,
        scopeId: scopeId ?? null,
        scopeName: scope?.id === scopeId ? scope.name : null,
        baseMapId: baseMapId ?? null,
        baseMapName: baseMap?.id === baseMapId ? baseMap.name : null,
        baseMapListingId: baseMap?.id === baseMapId ? baseMap.listingId : null,
      })
    );
    return store.getState().chat.conversation;
  }, [store, baseMap, scope]);
}
