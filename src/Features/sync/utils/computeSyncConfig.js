/*
 * syncScope : {PROJECT:{direction,project},SCOPE:{},LISTINGS:{direction,listings},ENTITIES:{direction,listings},FILES:{direction,fileTypes,listings}, fileTypes: ["IMAGES",..]
 * used to group listings by table.
 */

import computeSyncConfig_project from "./computeSyncConfig_project";
import computeSyncConfig_scope from "./computeSyncConfig_scope";
import computeSyncConfig_listings from "./computeSyncConfig_listings";
import computeSyncConfig_entities from "./computeSyncConfig_entities";
import computeSyncConfig_files from "./computeSyncConfig_files";

export default function computeSyncConfig(syncScope) {
  let syncConfig = {};

  if (syncScope.PROJECT) {
    syncConfig = {
      ...syncConfig,
      ...computeSyncConfig_project(syncScope.PROJECT),
    };
  }

  if (syncScope.SCOPE) {
    syncConfig = {
      ...syncConfig,
      ...computeSyncConfig_scope(syncScope.SCOPE),
    };
  }

  if (syncScope.LISTINGS) {
    syncConfig = {
      ...syncConfig,
      ...computeSyncConfig_listings(syncScope.LISTINGS),
    };
  }

  if (syncScope.ENTITIES) {
    syncConfig = {
      ...syncConfig,
      ...computeSyncConfig_entities(syncScope.ENTITIES),
    };
  }

  if (syncScope.FILES) {
    syncConfig = {
      ...syncConfig,
      ...computeSyncConfig_files(syncScope.FILES),
    };
  }

  return syncConfig;
}
