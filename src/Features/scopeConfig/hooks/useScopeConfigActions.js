import { useCallback } from "react";

import { useSelector } from "react-redux";

import db, { withSystemWrite } from "App/db/db";
import { notifyLocalChange } from "Features/remoteScopeConfigurations/services/localChangeTracker";

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
        await withSystemWrite(() =>
          db.scopeConfigs.add({
            id: scopeId, // deterministic PK — see the db.js v32 comment
            scopeId,
            projectId,
            disabledModuleKeys: [],
            disabledToolKeys: [],
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
        disabledModuleKeys: toggleKey(row?.disabledModuleKeys, moduleKey),
      })),
    [upsert]
  );

  const toggleToolRoot = useCallback(
    (toolKey) =>
      upsert((row) => ({
        disabledToolKeys: toggleKey(row?.disabledToolKeys, toolKey),
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

  return { scopeId, toggleModule, toggleToolRoot, toggleToolInModule };
}
