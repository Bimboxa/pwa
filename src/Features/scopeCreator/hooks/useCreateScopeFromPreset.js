import { useState } from "react";

import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { nanoid } from "@reduxjs/toolkit";
import { generateKeyBetween } from "fractional-indexing";

import { setOpenScopeCreator } from "../scopeCreatorSlice";
import { setSelectedScopeId } from "Features/scopes/scopesSlice";
import { setLandOnDrawScopeId } from "Features/viewers/viewersSlice";
import { setSelectedProjectId } from "Features/projects/projectsSlice";
import {
  setSelectedListingId,
  triggerListingsUpdate,
} from "Features/listings/listingsSlice";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
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
import { setToaster } from "Features/layout/layoutSlice";

import { withoutUndo } from "App/db/undoManager";

import useCreateScope from "Features/scopes/hooks/useCreateScope";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useUserEmail from "Features/auth/hooks/useUserEmail";
import useProjectBaseMapListings from "Features/baseMaps/hooks/useProjectBaseMapListings";
import useDefaultBaseMapsListingProps from "Features/baseMaps/hooks/useDefaultBaseMapsListingProps";
import useCreateListings from "Features/listings/hooks/useCreateListings";
import useCreateConfigurationBaseMaps from "./useCreateConfigurationBaseMaps";
import seedConfigurationBaseMapAnnotationsService from "../services/seedConfigurationBaseMapAnnotationsService";
import useCreateConfigurationResources from "./useCreateConfigurationResources";
import useImportPromptIaContent from "Features/promptIaProject/hooks/useImportPromptIaContent";

import resolvePresetScopeListings from "../services/resolvePresetScopeListings";
import resolvePresetScopeEntities from "../services/resolvePresetScopeEntities";
import resolveCarnetDetailLibraryKeys from "../services/resolveCarnetDetailLibraryKeys";
import { GENERIC_BASE_MAP_LISTING_NAME } from "../utils/genericBaseMapListing";
import resolveConfigurationScopeListings from "../services/resolveConfigurationScopeListings";
import applySourceScopeService, {
  SOURCE_SCOPE_MODES,
} from "../services/applySourceScopeService";
import createScopeConfig from "Features/scopeConfig/services/createScopeConfig";
import { DEFAULT_DISABLED_TOOL_KEYS } from "Features/scopeConfig/utils/scopeConfigSelectors";
import resolveConfigurationScopeConfig from "../utils/resolveConfigurationScopeConfig";
import createBusinessObjectListingService from "Features/businessObjects/services/createBusinessObjectListingService";
import createCommentListingService from "Features/comments/services/createCommentListingService";
import { COMMENTS_MODULE_KEY } from "Features/comments/constants/commentEntityModel";
import { getBusinessObjectsModuleKey } from "Features/businessObjects/utils/businessObjectModuleKeys";
import { DEFAULT_BUSINESS_OBJECT_TYPE_KEY } from "Features/businessObjects/data/businessObjectTypesCatalog";
import setDisabledBaseMapListingIds from "Features/baseMapEditor/services/setDisabledBaseMapListingIds";

import getConfigurationCategories from "../utils/getConfigurationCategories";
import resolveBaseMapPages from "../utils/resolveBaseMapPages";
import getDefaultLocatedEntityModel from "Features/listings/utils/getDefaultLocatedEntityModel";
import normalizePromptIaScopeOutput from "Features/promptIaProject/utils/normalizePromptIaScopeOutput";
import {
  countPromptIaImportTasks,
  createImportCounts,
  hasBusinessData,
} from "Features/promptIaProject/utils/promptIaImportTasks";

import EMPTY_SCOPE_CONFIGURATION from "../data/emptyScopeConfiguration";

export default function useCreateScopeFromPreset({ projectId }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // data

  const appConfig = useAppConfig();
  const { value: userEmail } = useUserEmail();
  const baseMapsListings = useProjectBaseMapListings({
    projectId,
    includeDisabled: true,
  });
  const defaultBaseMapsListingProps = useDefaultBaseMapsListingProps();

  const createScope = useCreateScope();
  const createListings = useCreateListings();
  const createConfigurationBaseMaps = useCreateConfigurationBaseMaps();
  const createConfigurationResources = useCreateConfigurationResources();
  const { importProjectContent, importScopeContent } =
    useImportPromptIaContent();

  // state

  const [isCreating, setIsCreating] = useState(false);
  // Prompt IA import progress ({ done, total, step }), shown on the recap's
  // create button; idle = total 0.
  const [progress, setProgress] = useState({ done: 0, total: 0, step: "" });

  // main

  async function createScopeFromPreset(args) {
    if (isCreating) return null;
    setIsCreating(true);
    try {
      return await createScopeFromPresetUnsafe(args);
    } catch (error) {
      // reset so the creator UI unfreezes; the caller toasts the error.
      setIsCreating(false);
      setProgress({ done: 0, total: 0, step: "" });
      throw error;
    }
  }

  async function createScopeFromPresetUnsafe({
    name,
    presetScopeKey,
    configurationKey,
    options,
    extraBaseMapListings,
    extraAnnotationListings,
    extraLibraryKeys,
    excludedLibraryKeys,
    removedBaseMapItemKeys,
    // configuration / generic baseMap listings removed in the recap modal
    // (keyed by listing name): neither created nor reused.
    removedBaseMapListingNames,
    // configuration / generic baseMap listings renamed inline in the recap
    // modal ({ declaredName: typedName }) — see resolveBaseMapPages.
    renamedBaseMapListingNames,
    // target dossier chosen in the recap modal for each configuration page
    // ({ "listingName::itemName": folderKey }) — see resolveBaseMapPages.
    baseMapPageTargets,
    hiddenExistingListingIds,
    // « Krto source » (configurations with sourceConfigurationKeys):
    // { scopeId, mode } — the drawing listings of that scope are linked
    // read-only (LINK) or copied with their annotations (COPY) right after
    // the creation; null / no scopeId => nothing.
    sourceScope,
    // empty: create a bare scope from the built-in EMPTY_SCOPE_CONFIGURATION
    // ("Krto vide" button / select entry): no annotation listing at all (no
    // library), a fallback "Fonds de plan" baseMap listing when the project
    // has none, core modules only.
    empty,
    // Prompt IA configuration (configuration.kind === "PROMPT_IA"):
    // { output } = the zip returned by the AI chat, read by
    // readPromptIaProjectOutputZip ({ data, pdfFilesByPath,
    // referenceImageFile, documentFilesByPath }). The listings, base maps,
    // templates, annotations, ouvrages and issues come from it.
    promptIa,
  }) {
    // Krto creation configuration (card selector) — when absent, the legacy
    // preset path below runs unchanged.
    const configuration = empty
      ? EMPTY_SCOPE_CONFIGURATION
      : appConfig?.features?.krtoConfigurations?.items?.find(
          (c) => c.key === configurationKey
        );

    const isPromptIa = configuration?.kind === "PROMPT_IA";
    if (isPromptIa && !promptIa?.output?.data) {
      throw new Error("Déposez le zip renvoyé par l'IA.");
    }

    // scope id generated upfront so the scopeConfig row can precede the scope
    const scopeId = nanoid();

    // Prompt IA: the AI's output restricted to the scope under creation (its
    // id / name win; several returned scopes are merged with a warning).
    const { scope: promptIaScope, warnings: promptIaWarnings } = isPromptIa
      ? normalizePromptIaScopeOutput(promptIa.output.data, {
          scopeId,
          scopeName: name,
        })
      : { scope: null, warnings: [] };

    const dpgf = Boolean(options?.dpgf);
    const carnetDetail = Boolean(options?.carnetDetail);
    const portfolio = Boolean(options?.portfolio);
    const comments = Boolean(options?.comments);
    // the new creator always passes options (even for the generic card); the
    // legacy preset flow passes none — its behavior stays untouched.
    const usesConfigurationFlow = Boolean(
      configuration || options || extraBaseMapListings
    );

    // libraries added in the recap modal ("Nouvelle liste" dialog) + the
    // Carnet de détail option (DIVERS, unless the configuration already
    // provides a DETAIL template), on top of the configuration's own.
    const allExtraLibraryKeys = [
      ...(extraLibraryKeys ?? []),
      ...resolveCarnetDetailLibraryKeys({
        carnetDetail,
        configuration,
        appConfig,
      }),
    ];

    const newListings = isPromptIa
      ? resolvePromptIaListings(promptIaScope)
      : usesConfigurationFlow
        ? await resolveConfigurationScopeListings({
            configuration,
            appConfig,
            projectId,
            extraLibraryKeys: allExtraLibraryKeys,
            excludedLibraryKeys,
          })
        : await resolvePresetScopeListings({
            presetScopeKey,
            appConfig,
            projectId,
          });

    // "+ Nouvelle liste": empty annotation listings added in the recap modal,
    // appended after the resolved ones (rank chain continues).
    const extraListings = (isPromptIa ? [] : (extraAnnotationListings ?? []))
      .map((l) => ({ ...l, name: l?.name?.trim() }))
      .filter((l) => l.name);
    if (extraListings.length > 0) {
      let prevRank =
        newListings
          .map((l) => l.rank)
          .filter(Boolean)
          .sort()
          .pop() ?? null;
      for (const extra of extraListings) {
        const rank = generateKeyBetween(prevRank, null);
        prevRank = rank;
        newListings.push({
          name: extra.name,
          ...(extra.avatarString && { avatarString: extra.avatarString }),
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

    // scopeConfig (per-scope module/tool activation) — absent from the
    // configuration => no row, the app defaults apply. Written BEFORE the
    // scope row: createScope selects the new scope right away, so the row is
    // in place when the editor reads it. The DPGF, Carnet de détail and
    // Portfolio options need their module ON for this scope (BUSINESS_OBJECTS
    // / PORTFOLIO), so they materialize a row (seeded from the app defaults
    // when the configuration carries none) with the module removed from the
    // persisted disabled list — the configuration itself declares its
    // modules in the enabled form (resolveConfigurationScopeConfig converts).
    // Carnet de détail also needs the RESOURCES tool: the
    // details workflow lives in the Ressources panel (folio source PDFs,
    // "voir la source" on DETAIL annotations).

    // Prompt IA: the Ouvrages module is on when the AI returned business
    // objects (DPGF…) or points d'attention.
    const promptIaBusinessData = isPromptIa && hasBusinessData(promptIaScope);
    const optionEnabledModuleKeys = [
      ...(dpgf || promptIaBusinessData ? [getBusinessObjectsModuleKey()] : []),
      ...(carnetDetail || portfolio ? ["PORTFOLIO"] : []),
      ...(comments ? [COMMENTS_MODULE_KEY] : []),
    ];
    const optionEnabledToolKeys = [...(carnetDetail ? ["RESOURCES"] : [])];

    if (configuration?.scopeConfig || optionEnabledModuleKeys.length > 0) {
      const baseScopeConfig = resolveConfigurationScopeConfig(
        configuration?.scopeConfig,
        appConfig
      );
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
      });
    }

    // scope.metaData.categories = every tag of the configuration (arrays per
    // keyword family); none for the generic / empty scope.
    const categories = empty ? null : getConfigurationCategories(configuration);
    const sourceScopeId = sourceScope?.scopeId ?? null;
    const sourceScopeMode = sourceScope?.mode ?? SOURCE_SCOPE_MODES.LINK;
    // null = every drawing listing of the source scope
    const sourceListingIds = sourceScope?.listingIds ?? null;
    const metaData = {
      ...(categories && { categories }),
      // trace of the « Krto source » choice (informative)
      ...(sourceScopeId && {
        sourceScope: {
          scopeId: sourceScopeId,
          mode: sourceScopeMode,
          ...(sourceListingIds && { listingIds: sourceListingIds }),
        },
      }),
    };

    const scope = await createScope({
      id: scopeId,
      name,
      projectId,
      newListings,
      newEntities,
      presetScopeKey: configuration?.key ?? presetScopeKey,
      configurationKey: empty ? null : (configuration?.key ?? null),
      metaData: Object.keys(metaData).length > 0 ? metaData : null,
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
    // baseMaps) and the user-added "+ Ajouter" rows from the recap modal;
    // each configuration page lands in the dossier chosen in the recap
    // (default: its declaring dossier) — resolveBaseMapPages is the shared
    // resolution, so the recap and this hook agree.

    let configurationItemsCount = 0;
    let configReusedListingIds = [];

    // generic ("vide") scope: the recap flow (eyes provided — it hides the
    // project listings by default) always proposes the generic dossier; the
    // compact dialog (no eyes) only when the project has no listing.
    const genericDefaultListings =
      usesConfigurationFlow &&
      !configuration &&
      (!baseMapsListings ||
        baseMapsListings.length === 0 ||
        hiddenExistingListingIds != null)
        ? [{ name: GENERIC_BASE_MAP_LISTING_NAME, items: [] }]
        : [];

    const { folders, pages } = resolveBaseMapPages({
      listingConfigs:
        configuration?.baseMaps?.listings ?? genericDefaultListings,
      existingListings: baseMapsListings,
      removedListingNames: removedBaseMapListingNames,
      removedPageKeys: removedBaseMapItemKeys,
      extraBaseMapListings,
      hiddenExistingListingIds,
      pageTargets: baseMapPageTargets,
      renamedListingNames: renamedBaseMapListingNames,
      disableExistingListings: Boolean(
        configuration?.baseMaps?.disableExistingListings
      ),
    });

    // pages grouped by target dossier, as bare configuration items
    const RESOLUTION_FIELDS = [
      "pageKey",
      "listingName",
      "defaultTargetKey",
      "targetKey",
    ];
    const pagesByTarget = new Map();
    for (const page of pages) {
      if (!page.targetKey) continue;
      const item = { ...page };
      for (const field of RESOLUTION_FIELDS) delete item[field];
      if (!pagesByTarget.has(page.targetKey)) {
        pagesByTarget.set(page.targetKey, []);
      }
      pagesByTarget.get(page.targetKey).push(item);
    }
    function takePages(targetKey) {
      const items = pagesByTarget.get(targetKey) ?? [];
      pagesByTarget.delete(targetKey);
      return items;
    }

    // listing configs in creation order (folders order): configuration
    // listings first — keeps firstListingId on the configuration's first
    // listing — then the "+ Ajouter" rows, then the project listings that
    // received pages without being declared (re-matched by name + flag by
    // createConfigurationBaseMaps, no rank consumed). Their ids also land in
    // reusedListingIds, harmless: that list only feeds the
    // disableExistingListings fallback used when the recap passed no eyes.
    const baseMapsListingConfigs = [];
    for (const folder of folders) {
      const items = takePages(folder.targetKey);
      if (folder.declared) {
        // spread the original config so flags (fallback, ...) survive
        baseMapsListingConfigs.push({ ...folder.listingConfig, items });
      } else if (folder.kind === "new") {
        baseMapsListingConfigs.push({ name: folder.name, items });
      } else if (items.length > 0) {
        baseMapsListingConfigs.push({
          name: folder.existing.name,
          ...(folder.existing.verticalBaseMaps && { verticalBaseMaps: true }),
          items,
        });
      }
    }

    // configuration PDFs kept as project resources — before the base maps,
    // whose PDF_PAGE items of the same PDFs point at these rows
    const configurationResources = configuration?.resources ?? [];
    if (usesConfigurationFlow && configurationResources.length > 0) {
      await createConfigurationResources({ configuration, projectId });
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
        seededBaseMaps,
      } = await createConfigurationBaseMaps({
        configuration: {
          baseMaps: baseMapsSection,
          resources: configurationResources,
        },
        scope,
        projectId,
        existingListings: baseMapsListings,
      });
      configurationItemsCount = createdItemsCount;
      configReusedListingIds = reusedListingIds ?? [];
      // annotations the configuration draws on its base maps (item
      // `annotations`), on the templates of the listings just created
      if (seededBaseMaps?.length > 0) {
        try {
          const seededCount = await seedConfigurationBaseMapAnnotationsService({
            seededBaseMaps,
            listings: newListings,
            projectId,
          });
          if (seededCount > 0) dispatch(triggerAnnotationsUpdate());
        } catch (error) {
          console.error(
            "[createScopeFromPreset] base map annotations not seeded",
            error
          );
        }
      }
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
      // project without any baseMap listing: a single generic dossier
      const [listing] = await createListings({
        listings: [
          {
            ...defaultBaseMapsListingProps,
            name: GENERIC_BASE_MAP_LISTING_NAME,
            rank: generateKeyBetween(null, null),
            projectId,
            canCreateItem: true,
          },
        ],
        scope,
      });
      dispatch(setSelectedBaseMapsListingId(listing?.id));
    }

    // Prompt IA configuration: base maps rendered from the returned PDFs,
    // then templates, annotations, ouvrages and issues of the scope (shared
    // import, see useImportPromptIaContent). The import needs a PLAN base
    // maps listing in the project (and a vertical one for ELEVATION views).
    let promptIaReport = null;
    if (isPromptIa) {
      const { data, pdfFilesByPath, referenceImageFile, documentFilesByPath } =
        promptIa.output;
      const existingListings = baseMapsListings ?? [];
      const missingListings = [];
      let planListing = existingListings.find((l) => !l.verticalBaseMaps);
      if (!planListing) {
        missingListings.push({
          ...defaultBaseMapsListingProps,
          name: GENERIC_BASE_MAP_LISTING_NAME,
          projectId,
          canCreateItem: true,
        });
      }
      const needsVertical =
        data.baseMaps.some((b) => b.listing === "ELEVATION") &&
        !existingListings.some((l) => l.verticalBaseMaps);
      if (needsVertical) {
        // same name as the project's default vertical listing
        missingListings.push({
          ...defaultBaseMapsListingProps,
          name: "Coupes & élévations",
          verticalBaseMaps: true,
          projectId,
          canCreateItem: true,
        });
      }
      if (missingListings.length > 0) {
        let rank =
          existingListings
            .map((l) => l.rank)
            .filter(Boolean)
            .sort()
            .pop() ?? null;
        const created = await createListings({
          listings: missingListings.map((l) => {
            rank = generateKeyBetween(rank, null);
            return { ...l, rank };
          }),
          scope,
        });
        planListing =
          planListing ?? (created ?? []).find((l) => !l.verticalBaseMaps);
      }

      const errors = [...promptIaWarnings];
      const counts = createImportCounts();
      const total = countPromptIaImportTasks(data);
      let done = 0;
      const tick = (step) => {
        done = Math.min(done + 1, total);
        setProgress({ done, total, step });
      };
      setProgress({ done: 0, total, step: "Fonds de plan" });

      let firstBaseMapId = null;
      // annotations and points are undoable tables: a Ctrl+Z right after the
      // landing must not peel the import off.
      await withoutUndo(async () => {
        const { baseMaps, documents, destroy } = await importProjectContent({
          projectId,
          data,
          pdfFilesByPath,
          referenceImageFile,
          documentFilesByPath,
          tick,
          errors,
          counts,
        });
        try {
          await importScopeContent({
            scope: promptIaScope,
            projectId,
            data,
            baseMaps,
            documents,
            tick,
            errors,
            counts,
          });
        } finally {
          destroy();
        }
        // land on the first plan view of the json (fallback: first created)
        const firstPlan =
          data.baseMaps.find(
            (b) => b.listing !== "ELEVATION" && baseMaps.has(b.id)
          ) ?? data.baseMaps.find((b) => baseMaps.has(b.id));
        firstBaseMapId = firstPlan
          ? (baseMaps.get(firstPlan.id)?.record?.id ?? null)
          : null;
      });
      counts.scopes = 1;
      counts.listings = newListings.length;
      configurationItemsCount = counts.baseMaps;
      if (planListing) dispatch(setSelectedBaseMapsListingId(planListing.id));
      if (firstBaseMapId) dispatch(setSelectedMainBaseMapId(firstBaseMapId));
      promptIaReport = { counts, errors };
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

    // (the Prompt IA DPGF, when the AI returned one, is the scope's first)
    if (dpgf && !(promptIaScope?.businessObjectListings?.length > 0)) {
      await createBusinessObjectListingService({
        projectId,
        scopeId: scope.id,
        name: "DPGF",
        typeKey: DEFAULT_BUSINESS_OBJECT_TYPE_KEY,
        appConfig,
      });
    }

    // Commentaires option: seed the scope's first comment listing (a comment
    // always belongs to a listing — Features/comments).
    if (comments) {
      await createCommentListingService({
        projectId,
        scopeId: scope.id,
        appConfig,
      });
    }

    // « Krto source »: link (read-only) or copy the drawing listings of the
    // chosen scope into the new one. The new scope is already selected (the
    // copy passes the linked-listing write guard); runs before the initial
    // save so the snapshot carries the rel rows / the copies.
    let sourceListingsCount = 0;
    if (sourceScopeId) {
      sourceListingsCount = await applySourceScopeService({
        hostScope: scope,
        sourceScopeId,
        mode: sourceScopeMode,
        listingIds: sourceListingIds,
        appConfig,
        createdBy: userEmail,
      });
      if (sourceListingsCount > 0) {
        dispatch(triggerListingsUpdate());
        dispatch(triggerAnnotationsUpdate());
      }
    }

    // selector — a freshly created scope lands on the Dessin module (2D),
    // not the Viewer (flag consumed by the LayoutDesktop landing effect).
    dispatch(setLandOnDrawScopeId(scope.id));
    dispatch(setSelectedScopeId(scope.id));
    dispatch(setSelectedProjectId(projectId));
    // land on the first chosen annotation listing
    dispatch(setSelectedListingId(newListings?.[0]?.id));

    // reinitialize the per-scope save counter so the stale-changes timer
    // can't inherit the previously selected scope's timestamp.
    dispatch(restoreScopeSyncStateFromStorage(scope.id));

    // reset remote-save guards for the freshly created scope (the slice also
    // resets them on setSelectedScopeId; kept explicit so the initial
    // auto-save guard never sees a stale non-null value).
    dispatch(setLastRemoteConfiguration(null));
    dispatch(setLastSyncedRemoteConfigurationVersion(null));

    // Case 2: project already has baseMaps, or the configuration just created
    // some -> auto-save right after scope creation (the initial snapshot then
    // includes the configuration content: baseMaps, scopeConfig, disabled ids).
    // Case 1 (no baseMaps yet) keeps being handled when baseMaps are added.
    if (
      baseMapsListings?.length > 0 ||
      configurationItemsCount > 0 ||
      sourceListingsCount > 0
    ) {
      dispatch(setPendingInitialSaveScopeId(scope.id));
    }

    // Prompt IA report: the recap closes on the landing, so a toaster sums
    // up the import; the full warning list goes to the console.
    if (promptIaReport) {
      const { counts, errors } = promptIaReport;
      const scopeS = appConfig?.strings?.scope?.nameSingular ?? "Krto";
      if (errors.length > 0) {
        console.warn("[createScopeFromPreset] prompt IA warnings", errors);
      }
      dispatch(
        setToaster({
          message:
            errors.length > 0
              ? `${scopeS} créé avec ${errors.length} avertissement(s) — ${errors[0]}${
                  errors.length > 1 ? " (…)" : ""
                }`
              : `${scopeS} créé : ${counts.baseMaps} fond(s) de plan, ${counts.annotations} annotation(s)`,
          severity: errors.length > 0 ? "warning" : "success",
        })
      );
    }

    dispatch(setOpenScopeCreator(false));
    navigate("/");

    return scope;
  }

  // Prompt IA: one drawing listing per listing of the AI's output (ids
  // already reminted by the parser and referenced by its annotations).
  function resolvePromptIaListings(promptIaScope) {
    const entityModelKey =
      getDefaultLocatedEntityModel(appConfig)?.key ?? "annotation";
    let rank = null;
    return promptIaScope.listings.map((listing) => {
      rank = generateKeyBetween(rank, null);
      return {
        id: listing.id,
        name: listing.name,
        entityModelKey,
        table: "entities",
        canCreateItem: true,
        projectId,
        rank,
      };
    });
  }

  return { createScopeFromPreset, isCreating, progress };
}
