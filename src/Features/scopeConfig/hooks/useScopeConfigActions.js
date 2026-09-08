import { useCallback } from "react";

import { useSelector } from "react-redux";

import db, { withSystemWrite } from "App/db/db";
import { notifyLocalChange } from "Features/remoteScopeConfigurations/services/localChangeTracker";

import {
  selectDefaultDisabledModuleKeys,
  getEffectiveDisabledModuleKeys,
  CONFIGURABLE_MODULE_KEYS,
  DEFAULT_DISABLED_TOOL_KEYS,
  DEFAULT_DISABLED_BASE_MAP_SOURCE_KEYS,
} from "../utils/scopeConfigSelectors";

function toggleKey(list, key) {
  const current = list ?? [];
  return current.includes(key)
    ? current.filter((k) => k !== key)
    : [...current, key];
}

// Write side of the per-scope module/tool activation (db.scopeConfigs).
export default function useScopeConfigActions() {
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const defaultDisabledModuleKeys = useSelector(
    selectDefaultDisabledModuleKeys
  );

  const upsert = useCallback(
    async (computePatch) => {
      if (!scopeId) return;
      const row = await db.scopeConfigs
        .where("scopeId")
        .equals(scopeId)
        .first();
      const patch = computePatch(row);
      // System write: the configuration is collaborative — writable by any
      // user, even a visitor of a foreign private scope. The patch omits
      // updatedAt so the updating hook restamps it (feeds the Krto merge
      // newest-wins). notifyLocalChange is suppressed under withSystemWrite,
      // so call it explicitly: config changes are pushable content.
      //
      // Every write materializes the effective disabled list and re-stamps
      // knownModuleKeys: a module the row did not know (added to the catalog
      // after the row was written) keeps following the org default it was
      // displayed with, instead of reading as enabled once the stamp covers
      // it (see getEffectiveDisabledModuleKeys).
      if (row) {
        await withSystemWrite(() =>
          db.scopeConfigs.update(row.id, {
            disabledModuleKeys: getEffectiveDisabledModuleKeys(
              row,
              defaultDisabledModuleKeys
            ),
            ...patch,
            knownModuleKeys: [...CONFIGURABLE_MODULE_KEYS],
          })
        );
      } else {
        // First toggle on this scope: seed the row from the app defaults so
        // the stored lists stay consistent with what the user was seeing.
        await withSystemWrite(() =>
          db.scopeConfigs.add({
            id: scopeId, // deterministic PK — see the db.js v32 comment
            scopeId,
            projectId,
            disabledModuleKeys: [...defaultDisabledModuleKeys],
            disabledToolKeys: [...DEFAULT_DISABLED_TOOL_KEYS],
            disabledToolKeysByModule: {},
            ...patch,
            knownModuleKeys: [...CONFIGURABLE_MODULE_KEYS],
          })
        );
      }
      notifyLocalChange();
    },
    [scopeId, projectId, defaultDisabledModuleKeys]
  );

  const toggleModule = useCallback(
    (moduleKey) =>
      upsert((row) => ({
        disabledModuleKeys: toggleKey(
          getEffectiveDisabledModuleKeys(row, defaultDisabledModuleKeys),
          moduleKey
        ),
      })),
    [upsert, defaultDisabledModuleKeys]
  );

  const toggleToolRoot = useCallback(
    (toolKey) =>
      upsert((row) => ({
        disabledToolKeys: toggleKey(
          row?.disabledToolKeys ?? DEFAULT_DISABLED_TOOL_KEYS,
          toolKey
        ),
      })),
    [upsert]
  );

  const toggleToolInModule = useCallback(
    (moduleKey, toolKey) =>
      upsert((row) => ({
        disabledToolKeysByModule: {
          ...(row?.disabledToolKeysByModule ?? {}),
          [moduleKey]: toggleKey(
            row?.disabledToolKeysByModule?.[moduleKey],
            toolKey
          ),
        },
      })),
    [upsert]
  );

  // BaseMap creation sources of the Fonds de plan module (cards + drop zone
  // of the creation section).
  const toggleBaseMapSource = useCallback(
    (sourceKey) =>
      upsert((row) => ({
        disabledBaseMapSourceKeys: toggleKey(
          row?.disabledBaseMapSourceKeys ??
            DEFAULT_DISABLED_BASE_MAP_SOURCE_KEYS,
          sourceKey
        ),
      })),
    [upsert]
  );

  // System annotation templates ("Générique" listing, Ligne / Polygone) —
  // read by useFreeAnnotationTemplates before provisioning.
  const setSystemAnnotationTemplates = useCallback(
    (enabled) => upsert(() => ({ systemAnnotationTemplates: enabled })),
    [upsert]
  );

  // Per-scope module label override (left band + panel headers). An empty /
  // whitespace label removes the override — the appConfig / hardcoded default
  // applies again.
  const setModuleLabel = useCallback(
    (moduleKey, label) =>
      upsert((row) => {
        const next = { ...(row?.moduleLabelsByKey ?? {}) };
        const trimmed = (label ?? "").trim();
        if (trimmed) next[moduleKey] = trimmed;
        else delete next[moduleKey];
        return { moduleLabelsByKey: next };
      }),
    [upsert]
  );

  // Per-scope module icon override (left band, Configuration nav / mockup).
  // A null / empty key removes the override — the type's default icon
  // applies again.
  const setModuleIconKey = useCallback(
    (moduleKey, iconKey) =>
      upsert((row) => {
        const next = { ...(row?.moduleIconKeysByKey ?? {}) };
        if (iconKey) next[moduleKey] = iconKey;
        else delete next[moduleKey];
        return { moduleIconKeysByKey: next };
      }),
    [upsert]
  );

  // Per-scope order of the left-band modules: the full ordered list of
  // module keys (SectionModuleOrder rewrites it from the live catalog on
  // every drag, which also purges stale keys).
  const setModuleOrder = useCallback(
    (moduleKeys) => upsert(() => ({ moduleOrder: [...moduleKeys] })),
    [upsert]
  );

  return {
    scopeId,
    toggleModule,
    toggleToolRoot,
    toggleToolInModule,
    toggleBaseMapSource,
    setSystemAnnotationTemplates,
    setModuleLabel,
    setModuleIconKey,
    setModuleOrder,
  };
}
