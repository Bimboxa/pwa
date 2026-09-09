import { useCallback } from "react";

import { useSelector } from "react-redux";

import {
  selectDefaultDisabledModuleKeys,
  getEffectiveDisabledModuleKeys,
  DEFAULT_DISABLED_TOOL_KEYS,
  DEFAULT_DISABLED_BASE_MAP_SOURCE_KEYS,
} from "../utils/scopeConfigSelectors";

import upsertScopeConfigService from "../services/upsertScopeConfigService";

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

  // Bound to the selected scope; the write itself (system write, row
  // seeding, knownModuleKeys stamp, local-change notification) lives in
  // upsertScopeConfigService, shared with the non-hook callers.
  const upsert = useCallback(
    (computePatch) =>
      upsertScopeConfigService({
        scopeId,
        projectId,
        defaultDisabledModuleKeys,
        computePatch,
      }),
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
  // "BASE_MAP" | "GLOBAL" (scopeConfigSelectors.selectLayersMode)
  const setLayersMode = useCallback(
    (layersMode) => upsert(() => ({ layersMode })),
    [upsert]
  );

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
    setLayersMode,
    setModuleLabel,
    setModuleIconKey,
    setModuleOrder,
  };
}
