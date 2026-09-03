import db, { withSystemWrite } from "App/db/db";
import { notifyLocalChange } from "Features/remoteScopeConfigurations/services/localChangeTracker";

import {
  getDefaultDisabledModuleKeys,
  DEFAULT_DISABLED_TOOL_KEYS,
} from "../utils/scopeConfigSelectors";

/*
 * Create the db.scopeConfigs row for a scope with explicit ids — used at scope
 * creation time, where useScopeConfigActions (bound to the selected scope)
 * cannot be used. No-op when a row already exists. `appConfig` feeds the
 * org-level module defaults when `disabledModuleKeys` is omitted.
 */
export default async function createScopeConfig({
  scopeId,
  projectId,
  disabledModuleKeys,
  disabledToolKeys,
  disabledToolKeysByModule,
  systemAnnotationTemplates,
  appConfig,
}) {
  if (!scopeId) return;

  const row = await db.scopeConfigs.where("scopeId").equals(scopeId).first();
  if (row) return;

  // System write: the configuration is collaborative — writable by any user.
  // notifyLocalChange is suppressed under withSystemWrite, so call it
  // explicitly: config changes are pushable content.
  await withSystemWrite(() =>
    db.scopeConfigs.add({
      id: scopeId, // deterministic PK — see the db.js v32 comment
      scopeId,
      projectId,
      disabledModuleKeys: disabledModuleKeys ?? [
        ...getDefaultDisabledModuleKeys(appConfig),
      ],
      disabledToolKeys: disabledToolKeys ?? [...DEFAULT_DISABLED_TOOL_KEYS],
      disabledToolKeysByModule: disabledToolKeysByModule ?? {},
      // only materialized when the caller decides (absent => enabled)
      ...(systemAnnotationTemplates !== undefined && {
        systemAnnotationTemplates,
      }),
    })
  );
  notifyLocalChange();
}
