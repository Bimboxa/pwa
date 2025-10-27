/*
 * add keys to the appConfig object.
 * - resolve remoteContainer paths
 */

import getRemoteContainerPathFromLocalStorage from "../services/getRemoteContainerPathFromLocalStorage";

// Dynamic asset loaders for background images
const BG_IMAGE_LOADERS = import.meta.glob("../../../App/assets/*.png", {
  as: "url", // return the URL directly
  eager: false, // lazy load when needed
});

export default async function resolveAppConfig(appConfig) {
  // edge case

  if (!appConfig) return;

  const newAppConfig = structuredClone(appConfig);

  // hardcoded fields for debug mode

  // if (options?.debug) {
  //   newAppConfig.remoteContainer = {
  //     ...newAppConfig.remoteContainer,
  //     path: "/0. DONNEES BIMBOXA",
  //   };
  // }

  // bg images - dynamically load from assets based on urlFromAssetKey

  if (appConfig.features?.bgImages?.options?.length > 0) {
    const options = await Promise.all(
      appConfig.features.bgImages.options.map(async (bgImage) => {
        if (bgImage.urlFromAssetKey && !bgImage.url) {
          const assetKey = `../../../App/assets/${bgImage.urlFromAssetKey}.png`;
          const loader = BG_IMAGE_LOADERS[assetKey];

          if (loader) {
            try {
              bgImage.url = await loader();
            } catch (error) {
              console.error(
                `[resolveAppConfig] Error loading asset "${bgImage.urlFromAssetKey}":`,
                error
              );
            }
          } else {
            console.warn(
              `[resolveAppConfig] Asset "${bgImage.urlFromAssetKey}.png" not found in App/assets/`
            );
          }
        }
        return bgImage;
      })
    );
    newAppConfig.features.bgImages.options = options;
  }

  // path
  const remoteContainerPath = getRemoteContainerPathFromLocalStorage();
  if (remoteContainerPath?.length > 0) {
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

  return newAppConfig;
}
