import { useCallback } from "react";

import { useSelector } from "react-redux";

import db, { withSystemWrite } from "App/db/db";
import { notifyLocalChange } from "Features/remoteScopeConfigurations/services/localChangeTracker";

import {
  DEFAULT_DISABLED_MODULE_KEYS,
  DEFAULT_DISABLED_TOOL_KEYS,
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
      if (row) {
        await withSystemWrite(() => db.scopeConfigs.update(row.id, patch));
      } else {
        // First toggle on this scope: seed the row from the app defaults so
        // the stored lists stay consistent with what the user was seeing.
        await withSystemWrite(() =>
          db.scopeConfigs.add({
            id: scopeId, // deterministic PK — see the db.js v32 comment
            scopeId,
            projectId,
            disabledModuleKeys: [...DEFAULT_DISABLED_MODULE_KEYS],
            disabledToolKeys: [...DEFAULT_DISABLED_TOOL_KEYS],
            disabledToolKeysByModule: {},
            ...patch,
          })
        );
      }
      notifyLocalChange();
    },
    [scopeId, projectId]
  );

  const toggleModule = useCallback(
    (moduleKey) =>
      upsert((row) => ({
        disabledModuleKeys: toggleKey(
          row?.disabledModuleKeys ?? DEFAULT_DISABLED_MODULE_KEYS,
          moduleKey
        ),
      })),
    [upsert]
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

  return {
    scopeId,
    toggleModule,
    toggleToolRoot,
    toggleToolInModule,
    setModuleLabel,
  };
}
