import { useState } from "react";

import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { generateKeyBetween } from "fractional-indexing";

import { setOpenScopeCreator } from "../scopeCreatorSlice";
import { setSelectedScopeId } from "Features/scopes/scopesSlice";
import { setLandOnDrawScopeId } from "Features/viewers/viewersSlice";
import { setSelectedProjectId } from "Features/projects/projectsSlice";
import { setSelectedListingId } from "Features/listings/listingsSlice";
import { setSelectedBaseMapsListingId } from "Features/mapEditor/mapEditorSlice";
import {
  setLastRemoteConfiguration,
  setLastSyncedRemoteConfigurationVersion,
  setPendingInitialSaveScopeId,
  restoreScopeSyncStateFromStorage,
} from "Features/remoteScopeConfigurations/remoteScopeConfigurationsSlice";

import useCreateScope from "Features/scopes/hooks/useCreateScope";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useProjectBaseMapListings from "Features/baseMaps/hooks/useProjectBaseMapListings";
import useDefaultBaseMapsListingProps from "Features/baseMaps/hooks/useDefaultBaseMapsListingProps";
import useCreateListings from "Features/listings/hooks/useCreateListings";

import resolvePresetScopeListings from "../services/resolvePresetScopeListings";
import resolvePresetScopeEntities from "../services/resolvePresetScopeEntities";

export default function useCreateScopeFromPreset({ projectId }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // data

  const appConfig = useAppConfig();
  const baseMapsListings = useProjectBaseMapListings({ projectId });
  const defaultBaseMapsListingProps = useDefaultBaseMapsListingProps();

  const createScope = useCreateScope();
  const createListings = useCreateListings();

  // state

  const [isCreating, setIsCreating] = useState(false);

  // main

  async function createScopeFromPreset({ name, presetScopeKey }) {
    if (isCreating) return null;
    setIsCreating(true);

    const newListings = await resolvePresetScopeListings({
      presetScopeKey,
      appConfig,
      projectId,
    });
    const newEntities = resolvePresetScopeEntities({ listings: newListings });

    console.log(
      "debug_3001 [newListings, newEntities]",
      newListings,
      newEntities
    );

    const scope = await createScope({
      name,
      projectId,
      newListings,
      newEntities,
      presetScopeKey,
    });
    console.log("debug_25_09 [scope] created scope", scope, baseMapsListings);
    if (!scope) {
      setIsCreating(false);
      return null;
    }

    // baseMaps listing

    if (!baseMapsListings || baseMapsListings?.length === 0) {
      // rank (fractional indexing) keeps "Vues en plan" before "Coupes & élévations"
      const planRank = generateKeyBetween(null, null);
      const verticalRank = generateKeyBetween(planRank, null);
      const [planListing, verticalListing] = await createListings({
        listings: [
          {
            ...defaultBaseMapsListingProps,
            name: "Vues en plan",
            rank: planRank,
            projectId,
            canCreateItem: true,
          },
          {
            ...defaultBaseMapsListingProps,
            name: "Coupes & élévations",
            verticalBaseMaps: true,
            rank: verticalRank,
            projectId,
            canCreateItem: true,
          },
        ],
        scope,
      });
      console.log(
        "debug_25_09 [baseMapsListings] created baseMapsListings",
        planListing,
        verticalListing
      );
      dispatch(setSelectedBaseMapsListingId(planListing?.id));
    }

    // selector — a freshly created scope lands on the Dessin module (2D),
    // not the Viewer (flag consumed by the LayoutDesktop landing effect).
    dispatch(setLandOnDrawScopeId(scope.id));
    dispatch(setSelectedScopeId(scope.id));
    dispatch(setSelectedProjectId(projectId));
    dispatch(setSelectedListingId(newListings?.[0]?.id));

    // reinitialize the per-scope save counter so the stale-changes timer
    // can't inherit the previously selected scope's timestamp.
    dispatch(restoreScopeSyncStateFromStorage(scope.id));

    // reset remote-save guards for the freshly created scope: these are never
    // cleared on scope switch (restoreSyncedVersionFromStorage no-ops on absent
    // value), so a stale non-null value from a previous scope would short-circuit
    // the initial auto-save.
    dispatch(setLastRemoteConfiguration(null));
    dispatch(setLastSyncedRemoteConfigurationVersion(null));

    // Case 2: project already has baseMaps -> auto-save right after scope creation.
    // Case 1 (no baseMaps yet) keeps being handled when baseMaps are added.
    if (baseMapsListings?.length > 0) {
      dispatch(setPendingInitialSaveScopeId(scope.id));
    }

    dispatch(setOpenScopeCreator(false));
    navigate("/");

    return scope;
  }

  return { createScopeFromPreset, isCreating };
}
