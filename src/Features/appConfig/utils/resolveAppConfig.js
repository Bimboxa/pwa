/*
 * add keys to the appConfig object.
 * - resolve remoteContainer paths
 */

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
