import { useState } from "react";

import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { nanoid } from "@reduxjs/toolkit";
import { generateKeyBetween } from "fractional-indexing";

import { setOpenScopeCreator } from "../scopeCreatorSlice";
import { setSelectedScopeId } from "Features/scopes/scopesSlice";
import { setLandOnDrawScopeId } from "Features/viewers/viewersSlice";
import { setSelectedProjectId } from "Features/projects/projectsSlice";
import { setSelectedListingId } from "Features/listings/listingsSlice";
import {
  setSelectedBaseMapsListingId,
  setSelectedMainBaseMapId,
} from "Features/mapEditor/mapEditorSlice";
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
import useCreateConfigurationBaseMaps from "./useCreateConfigurationBaseMaps";

import resolvePresetScopeListings from "../services/resolvePresetScopeListings";
import resolvePresetScopeEntities from "../services/resolvePresetScopeEntities";
import resolveConfigurationScopeListings from "../services/resolveConfigurationScopeListings";
import createScopeConfig from "Features/scopeConfig/services/createScopeConfig";
import {
  getDefaultDisabledModuleKeys,
  DEFAULT_DISABLED_TOOL_KEYS,
} from "Features/scopeConfig/utils/scopeConfigSelectors";
import createBusinessObjectListingService from "Features/businessObjects/services/createBusinessObjectListingService";
import setDisabledBaseMapListingIds from "Features/baseMapEditor/services/setDisabledBaseMapListingIds";

import EMPTY_SCOPE_CONFIGURATION from "../data/emptyScopeConfiguration";

export default function useCreateScopeFromPreset({ projectId }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // data

  const appConfig = useAppConfig();
  const baseMapsListings = useProjectBaseMapListings({ projectId });
  const defaultBaseMapsListingProps = useDefaultBaseMapsListingProps();

  const createScope = useCreateScope();
  const createListings = useCreateListings();
  const createConfigurationBaseMaps = useCreateConfigurationBaseMaps();

  // state

  const [isCreating, setIsCreating] = useState(false);

  // main

  async function createScopeFromPreset(args) {
    if (isCreating) return null;
    setIsCreating(true);
    try {
      return await createScopeFromPresetUnsafe(args);
    } catch (error) {
      // reset so the creator UI unfreezes; the caller toasts the error.
      setIsCreating(false);
      throw error;
    }
  }

  async function createScopeFromPresetUnsafe({
    name,
    presetScopeKey,
    configurationKey,
    metaData,
    options,
    extraBaseMapListings,
    extraAnnotationListings,
    extraBaseMapPages,
    extraLibraryKeys,
    excludedLibraryKeys,
    removedBaseMapItemKeys,
    hiddenExistingListingIds,
    // empty: create a bare scope from the built-in EMPTY_SCOPE_CONFIGURATION
    // ("Krto vide" button / select entry): no annotation listing at all (no
    // library, initSystemAnnotationTemplates false), a fallback "Fonds de
    // plan" baseMap listing when the project has none, core modules only.
    empty,
  }) {
    // Krto creation configuration (card selector) — when absent, the legacy
    // preset path below runs unchanged.
    const configuration = empty
      ? EMPTY_SCOPE_CONFIGURATION
      : appConfig?.features?.krtoConfigurations?.items?.find(
          (c) => c.key === configurationKey
        );

    const dpgf = Boolean(options?.dpgf);
    const carnetDetail = Boolean(options?.carnetDetail);
    // the new creator always passes options (even for the generic card); the
    // legacy preset flow passes none — its behavior stays untouched.
    const usesConfigurationFlow = Boolean(
      configuration || options || extraBaseMapListings
    );

    // libraries added in the recap modal ("Nouvelle liste" dialog) + the
    // Carnet de détail option (DIVERS), on top of the configuration's own.
    const allExtraLibraryKeys = [
      ...(extraLibraryKeys ?? []),
      ...(carnetDetail ? ["DIVERS"] : []),
    ];

    // system annotation templates (isForBaseMaps preset listings at creation
    // + the on-the-fly "Générique" Ligne/Polygone listing): only the generic
    // scope (no configuration) seeds them by default; a configuration opts in
    // through annotations.initSystemAnnotationTemplates (EMPTY config: false).
    const initSystemAnnotationTemplates = configuration
      ? (configuration.annotations?.initSystemAnnotationTemplates ?? false)
      : true;

    const newListings = usesConfigurationFlow
      ? await resolveConfigurationScopeListings({
          configuration,
          appConfig,
          projectId,
          extraLibraryKeys: allExtraLibraryKeys,
          excludedLibraryKeys,
          initSystemAnnotationTemplates,
        })
      : await resolvePresetScopeListings({
          presetScopeKey,
          appConfig,
          projectId,
        });

    // "+ Nouvelle liste": empty annotation listings added in the recap modal,
    // appended after the resolved ones (rank chain continues).
    const extraAnnotationNames = (extraAnnotationListings ?? [])
      .map((l) => l?.name?.trim())
      .filter(Boolean);
    if (extraAnnotationNames.length > 0) {
      let prevRank =
        newListings
          .map((l) => l.rank)
          .filter(Boolean)
          .sort()
          .pop() ?? null;
      for (const listingName of extraAnnotationNames) {
        const rank = generateKeyBetween(prevRank, null);
        prevRank = rank;
        newListings.push({
          name: listingName,
          entityModelKey: "annotation",
          table: "entities",
          canCreateItem: true,
          projectId,
          rank,
        });
      }
    }
    const newEntities = resolvePresetScopeEntities({ listings: newListings });

    console.log(
      "debug_3001 [newListings, newEntities]",
      newListings,
      newEntities
    );

    // scope id generated upfront so the scopeConfig row can precede the scope
    const scopeId = nanoid();

    // scopeConfig (per-scope module/tool activation) — absent from the
    // configuration => no row, the app defaults apply. Written BEFORE the
    // scope row: createScope selects the new scope right away, and with a
    // scope already open the mounted Dessin panel (useFreeAnnotationTemplates)
    // would read a missing row as "system templates enabled" and provision
    // the "Générique" listing before this row lands. The DPGF and Carnet de
    // détail options need their module ON for this scope (BUSINESS_OBJECTS /
    // PORTFOLIO), so they materialize a row (seeded from the app defaults
    // when the configuration carries none) with the module removed from the
    // disabled list. Carnet de détail also needs the RESOURCES tool: the
    // details workflow lives in the Ressources panel (folio source PDFs,
    // "voir la source" on DETAIL annotations).

    const optionEnabledModuleKeys = [
      ...(dpgf ? ["BUSINESS_OBJECTS"] : []),
      ...(carnetDetail ? ["PORTFOLIO"] : []),
    ];
    const optionEnabledToolKeys = [...(carnetDetail ? ["RESOURCES"] : [])];

    // A configuration without system annotation templates also needs a row:
    // useFreeAnnotationTemplates reads the persisted flag to skip the
    // on-the-fly "Générique" listing provisioning.
    const disableSystemTemplates =
      usesConfigurationFlow && !initSystemAnnotationTemplates;

    if (
      configuration?.scopeConfig ||
      optionEnabledModuleKeys.length > 0 ||
      disableSystemTemplates
    ) {
      const baseScopeConfig = configuration?.scopeConfig ?? {
        disabledModuleKeys: [...getDefaultDisabledModuleKeys(appConfig)],
      };
      const scopeConfigProps =
        optionEnabledModuleKeys.length > 0
          ? {
              ...baseScopeConfig,
              disabledModuleKeys: (
                baseScopeConfig.disabledModuleKeys ?? []
              ).filter((k) => !optionEnabledModuleKeys.includes(k)),
              // materialize the filtered tool list explicitly: with an
              // undefined disabledToolKeys, createScopeConfig would re-apply
              // the app defaults, which contain RESOURCES.
              ...(optionEnabledToolKeys.length > 0 && {
                disabledToolKeys: (
                  baseScopeConfig.disabledToolKeys ?? DEFAULT_DISABLED_TOOL_KEYS
                ).filter((k) => !optionEnabledToolKeys.includes(k)),
              }),
            }
          : baseScopeConfig;
      await createScopeConfig({
        scopeId,
        projectId,
        appConfig,
        ...scopeConfigProps,
        ...(disableSystemTemplates && { systemAnnotationTemplates: false }),
      });
    }

    const scope = await createScope({
      id: scopeId,
      name,
      projectId,
      newListings,
      newEntities,
      presetScopeKey: configuration?.key ?? presetScopeKey,
      metaData,
    });
    console.log("debug_25_09 [scope] created scope", scope, baseMapsListings);
    if (!scope) {
      setIsCreating(false);
      return null;
    }

    // snapshot of the project's pre-existing baseMap listings, taken before
    // the configuration creates its own (used by disableExistingListings).
    const preExistingBaseMapListingIds = (baseMapsListings ?? []).map(
      (l) => l.id
    );

    // baseMaps listings (and configuration baseMap items). The section merges
    // the configuration's listings, the generic defaults (project without
    // baseMaps) and the user-added "+ Ajouter" rows from the recap modal.

    let configurationItemsCount = 0;
    let configReusedListingIds = [];

    const extraListingConfigs = (extraBaseMapListings ?? [])
      .map((l) => l?.name?.trim())
      .filter(Boolean)
      .map((listingName) => ({ name: listingName, items: [] }));

    const genericDefaultListings =
      usesConfigurationFlow &&
      !configuration &&
      (!baseMapsListings || baseMapsListings.length === 0)
        ? [
            { name: "Vues en plan", items: [] },
            { name: "Coupes & élévations", verticalBaseMaps: true, items: [] },
          ]
        : [];

    // configuration listings with their items, minus the pages removed in
    // the recap modal (keys "listingName::itemName"), plus the
    // "+ Fond de plan" pages added there (targeted by listingName, fallback
    // to the first listing).
    const removedKeys = removedBaseMapItemKeys ?? [];
    const baseListingConfigs = (
      configuration?.baseMaps?.listings ?? genericDefaultListings
    ).map((listing) => ({
      ...listing,
      items: (listing.items ?? []).filter(
        (item) => !removedKeys.includes(`${listing.name}::${item.name}`)
      ),
    }));

    const baseMapsListingConfigs = [
      ...baseListingConfigs,
      ...extraListingConfigs,
    ];

    for (const page of extraBaseMapPages ?? []) {
      const pageName = page?.name?.trim();
      if (!pageName) continue;
      let target =
        baseMapsListingConfigs.find((l) => l.name === page.listingName) ??
        baseMapsListingConfigs[0];
      if (!target) {
        // no listing config yet (e.g. generic scope on a project that already
        // has baseMap listings): target an implicit one — reused by name when
        // it already exists in the project.
        target = { name: page.listingName ?? "Vues en plan", items: [] };
        baseMapsListingConfigs.push(target);
      }
      target.items = [
        ...(target.items ?? []),
        {
          type: "BLANK_PAGE",
          name: pageName,
          pageFormat: page.pageFormat ?? "A3",
          pageOrientation: page.pageOrientation ?? "LANDSCAPE",
          scale: page.scale ?? 50,
        },
      ];
    }

    if (usesConfigurationFlow && baseMapsListingConfigs.length > 0) {
      const baseMapsSection = {
        disableExistingListings:
          configuration?.baseMaps?.disableExistingListings ?? false,
        listings: baseMapsListingConfigs,
      };
      const {
        firstListingId,
        firstBaseMapId,
        createdItemsCount,
        reusedListingIds,
      } = await createConfigurationBaseMaps({
        configuration: { baseMaps: baseMapsSection },
        scope,
        projectId,
        existingListings: baseMapsListings,
      });
      configurationItemsCount = createdItemsCount;
      configReusedListingIds = reusedListingIds ?? [];
      if (firstListingId) {
        dispatch(setSelectedBaseMapsListingId(firstListingId));
      }
      // land on the first created baseMap (main map of the 2D editor)
      if (firstBaseMapId) {
        dispatch(setSelectedMainBaseMapId(firstBaseMapId));
      }
    } else if (
      !usesConfigurationFlow &&
      (!baseMapsListings || baseMapsListings?.length === 0)
    ) {
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

    // per-scope visibility of the pre-existing baseMap listings
    // (scope.baseMapsSettings.disabledListingIds). The recap modal's eyes
    // (hiddenExistingListingIds) win when provided; otherwise fall back to
    // the configuration's disableExistingListings flag (all non-reused
    // existing listings hidden).
    if (usesConfigurationFlow) {
      const listingIdsToDisable =
        hiddenExistingListingIds ??
        (configuration?.baseMaps?.disableExistingListings
          ? preExistingBaseMapListingIds.filter(
              (id) => !configReusedListingIds.includes(id)
            )
          : []);
      if (listingIdsToDisable.length > 0) {
        await setDisabledBaseMapListingIds({
          scopeId: scope.id,
          listingIds: listingIdsToDisable,
        });
      }
    }

    // DPGF option: seed the scope's first business-objects listing (the
    // Ouvrages panel auto-selects the first listing on open).

    if (dpgf) {
      await createBusinessObjectListingService({
        projectId,
        scopeId: scope.id,
        name: "DPGF",
        appConfig,
      });
    }

    // selector — a freshly created scope lands on the Dessin module (2D),
    // not the Viewer (flag consumed by the LayoutDesktop landing effect).
    dispatch(setLandOnDrawScopeId(scope.id));
    dispatch(setSelectedScopeId(scope.id));
    dispatch(setSelectedProjectId(projectId));
    // land on the first chosen annotation listing (never the system
    // isForBaseMaps one when a real listing exists)
    const firstAnnotationListing =
      newListings?.find((l) => !l.isForBaseMaps) ?? newListings?.[0];
    dispatch(setSelectedListingId(firstAnnotationListing?.id));

    // reinitialize the per-scope save counter so the stale-changes timer
    // can't inherit the previously selected scope's timestamp.
    dispatch(restoreScopeSyncStateFromStorage(scope.id));

    // reset remote-save guards for the freshly created scope: these are never
    // cleared on scope switch (restoreSyncedVersionFromStorage no-ops on absent
    // value), so a stale non-null value from a previous scope would short-circuit
    // the initial auto-save.
    dispatch(setLastRemoteConfiguration(null));
    dispatch(setLastSyncedRemoteConfigurationVersion(null));

    // Case 2: project already has baseMaps, or the configuration just created
    // some -> auto-save right after scope creation (the initial snapshot then
    // includes the configuration content: baseMaps, scopeConfig, disabled ids).
    // Case 1 (no baseMaps yet) keeps being handled when baseMaps are added.
    if (baseMapsListings?.length > 0 || configurationItemsCount > 0) {
      dispatch(setPendingInitialSaveScopeId(scope.id));
    }

    dispatch(setOpenScopeCreator(false));
    navigate("/");

    return scope;
  }

  return { createScopeFromPreset, isCreating };
}
