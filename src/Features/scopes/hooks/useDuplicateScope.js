import { useDispatch, useSelector } from "react-redux";

import { setSelectedScopeId } from "../scopesSlice";
import {
  setSelectedListingId,
  triggerListingsUpdate,
} from "Features/listings/listingsSlice";
import { triggerLayersUpdate } from "Features/layers/layersSlice";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import useUserEmail from "Features/auth/hooks/useUserEmail";

import duplicateScopeService from "../services/duplicateScopeService";

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
  }) => {
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
