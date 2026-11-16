import { useDispatch, useSelector } from "react-redux";

import { setSelectedScopeId, setScopeOpeningSource } from "../scopesSlice";
import { setSelectedProjectId } from "Features/projects/projectsSlice";
import {
  setSelectedListingId,
  triggerListingsUpdate,
} from "Features/listings/listingsSlice";
import { triggerLayersUpdate } from "Features/layers/layersSlice";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import useUserEmail from "Features/auth/hooks/useUserEmail";

import duplicateScopeService from "../services/duplicateScopeService";
import duplicateScopeToProjectService from "../services/duplicateScopeToProjectService";

// `targetProjectId` (another project than the scope's own): full copy of the
// scope into that project, base maps included — the filters do not apply.

export default function useDuplicateScope() {
  const dispatch = useDispatch();
  const { value: userEmail } = useUserEmail();
  const userTrigram = useSelector((s) => s.auth.userProfile?.trigram ?? null);

  return async ({
    scope,
    name,
    disabledBaseMapIds,
    disabledLayerIds,
    disabledTemplateKeys,
    targetProjectId,
  }) => {
    if (targetProjectId && targetProjectId !== scope.projectId) {
      const { newScopeId } = await duplicateScopeToProjectService({
        scope,
        name,
        targetProjectId,
      });

      // the copy belongs to the target project: no opening source anymore
      dispatch(setScopeOpeningSource(null));
      dispatch(setSelectedProjectId(targetProjectId));
      dispatch(setSelectedScopeId(newScopeId));
      dispatch(setSelectedListingId(null));
      dispatch(triggerListingsUpdate());
      dispatch(triggerLayersUpdate());
      dispatch(triggerAnnotationsUpdate());

      return { newScopeId, firstListingId: null };
    }

    const { newScopeId, firstListingId } = await duplicateScopeService({
      scope,
      name,
      createdBy: userEmail,
      createdByTrigram: userTrigram,
      disabledBaseMapIds,
      disabledLayerIds,
      disabledTemplateKeys,
    });

    // select the new scope, then refresh the trigger-based hooks once
    dispatch(setSelectedScopeId(newScopeId));
    if (firstListingId) dispatch(setSelectedListingId(firstListingId));
    dispatch(triggerListingsUpdate());
    dispatch(triggerLayersUpdate());
    dispatch(triggerAnnotationsUpdate());

    return { newScopeId, firstListingId };
  };
}
