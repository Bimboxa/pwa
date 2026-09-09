import db, { withSystemWrite } from "App/db/db";
import { notifyLocalChange } from "Features/remoteScopeConfigurations/services/localChangeTracker";

import {
  getEffectiveDisabledModuleKeys,
  CONFIGURABLE_MODULE_KEYS,
  DEFAULT_DISABLED_TOOL_KEYS,
} from "../utils/scopeConfigSelectors";

// Single write path of db.scopeConfigs (useScopeConfigActions and the
// non-hook callers). `computePatch(row)` returns the fields to write; a
// null / undefined patch skips the write. First write on a scope seeds the
// row from the app defaults so the stored lists stay consistent with what
// the user was seeing.
//
// System write: the configuration is collaborative — writable by any user,
// even a visitor of a foreign private scope. The patch omits updatedAt so
// the updating hook restamps it (feeds the Krto merge newest-wins).
// notifyLocalChange is suppressed under withSystemWrite, so it is called
// explicitly: config changes are pushable content.
//
// Every write materializes the effective disabled module list and re-stamps
// knownModuleKeys: a module the row did not know (added to the catalog
// after the row was written) keeps following the org default it was
// displayed with, instead of reading as enabled once the stamp covers it
// (see getEffectiveDisabledModuleKeys).
export default async function upsertScopeConfigService({
  scopeId,
  projectId,
  defaultDisabledModuleKeys,
  computePatch,
}) {
  if (!scopeId) return false;
  const row = await db.scopeConfigs.where("scopeId").equals(scopeId).first();
  const patch = computePatch(row);
  if (!patch) return false;

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
  return true;
}
