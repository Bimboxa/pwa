/*
 * add keys to the appConfig object.
 * - resolve remoteContainer paths
 */

import getRemoteContainerFromLocalStorage from "Features/sync/services/getRemoteContainerFromLocalStorage";

export default function resolveAppConfig(appConfig, options) {
  console.log("resolveAppConfig", options);
  // edge case

  if (!appConfig) return;

  const newAppConfig = structuredClone(appConfig);

  // hardcoded fields for debug mode

  if (options.debug) {
    newAppConfig.remoteContainer = {
      ...newAppConfig.remoteContainer,
      path: "/0. DONNEES BIMBOXA",
    };
  }

  // path
  const remoteContainerPath = getRemoteContainerFromLocalStorage();
  if (remoteContainerPath) {
    newAppConfig.remoteContainer = {
      ...newAppConfig.remoteContainer,
      path: remoteContainerPath,
    };
  }
  // projectsPath

  if (appConfig.remoteContainer?.projectsPathRelative) {
    newAppConfig.remoteContainer = {
      ...newAppConfig.remoteContainer,
      projectsPath:
        newAppConfig.remoteContainer.path +
        newAppConfig.remoteContainer.projectsPathRelative,
    };
  }

  // orgaDataPath
  if (appConfig.orgaData?.pathRelative) {
    newAppConfig.orgaData = {
      ...newAppConfig.orgaData,
      path:
        newAppConfig.remoteContainer.path + newAppConfig.orgaData.pathRelative,
    };
  }

  // return

  console.log("[resolveAppConfig] newAppConfig", newAppConfig);

  return newAppConfig;
}
