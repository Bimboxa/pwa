/*
 * add keys to the appConfig object.
 * - resolve remoteContainer paths
 */

import getRemoteContainerPathFromLocalStorage from "../services/getRemoteContainerPathFromLocalStorage";
import resolvePresetListingsAndScopesObjectFromAnnotationTemplatesLibraries from "../services/resolvePresetListingsAndScopesObjectFromAnnotationTemplatesLibraries";

// Dynamic asset loaders for background images or other features.
const APP_IMAGE_ASSET_LOADERS = import.meta.glob("../../../App/assets/*.png", {
  as: "url", // return the URL directly
  eager: false, // lazy load when needed
});

// Dynamic loaders for annotation template libraries
const LIBRARIES_LOADERS = import.meta.glob("../../../Data/*/annotationTemplatesLibraries.js", {
  eager: false,
});

// Dynamic loaders for articles nomenclatures libraries
const ARTICLES_NOMENCLATURES_LOADERS = import.meta.glob("../../../Data/*/articlesNomenclaturesLibraries.js", {
  eager: false,
});

// Dynamic loaders for mapping categories
const MAPPING_CATEGORIES_LOADERS = import.meta.glob("../../../Data/*/mappingCategories.js", {
  eager: false,
});

// Dynamic loaders for automated annotation procedures
const AUTOMATED_PROCEDURES_LOADERS = import.meta.glob("../../../Data/*/automatedAnnotationsProcedures/index.js", {
  eager: false,
});

// Dynamic loader for Data files
const DATA_LOADERS = import.meta.glob("../../../Data/**/*", {
  eager: false,
});

export default async function resolveAppConfig(appConfig) {
  // edge case

  if (!appConfig) return;

  const newAppConfig = structuredClone(appConfig);

  // appConfig code
  const orgaCode = appConfig.orgaCode;

  // orgaData

  const newOrgaData = {};
  const orgaDataArray = Object.entries(appConfig.orgaData ?? {})
  for (let [key, orgaData] of orgaDataArray) {
    if (orgaData.importFromData) {
      const dataKey = `../../../Data/${orgaData.importFromData}`;
      const loader = DATA_LOADERS[dataKey];
      console.log("debug_3001_appConfig", dataKey, loader);
      if (loader) {
        const module = await loader();
        const data = module.default;
        newOrgaData[key] = data;
      }
    }
  }
  newAppConfig.orgaData = newOrgaData;
  console.log("debug_3001_appConfig", newAppConfig.orgaData);


  // annotation template libraries
  console.log("debug_3012_appConfig", orgaCode && appConfig.features.presetScopes?.fromAnnotationTemplatesLibraries);
  if (orgaCode && appConfig.features.presetScopes?.fromAnnotationTemplatesLibraries) {
    const libraryKey = `../../../Data/${orgaCode}/annotationTemplatesLibraries.js`;
    const loader = LIBRARIES_LOADERS[libraryKey];

    if (loader) {
      try {
        const module = await loader();
        const libraries = module.default;

        const presetScopeItems = appConfig.features.presetScopes.items;

        const { presetListingsObject,
          presetScopesObject,
          presetScopesSortedKeys } = resolvePresetListingsAndScopesObjectFromAnnotationTemplatesLibraries(libraries, presetScopeItems);

        newAppConfig.presetListingsObject = {
          ...newAppConfig.presetListingsObject,
          ...(presetListingsObject ?? {}),
        }

        newAppConfig.presetScopesObject = {
          ...newAppConfig.presetScopesObject,
          ...(presetScopesObject ?? {}),
        }

        newAppConfig.presetScopesSortedKeys = [
          ...(newAppConfig.presetScopesSortedKeys ?? []),
          ...(presetScopesSortedKeys ?? []),
        ];

      } catch (error) {
        console.error(`[resolveAppConfig] Error loading libraries for "${orgaCode}":`, error);
      }
    } else {
      console.warn(`[resolveAppConfig] No libraries found for orgaCode "${orgaCode}" at ${libraryKey}`);
    }
  }

  // articles nomenclatures libraries
  if (orgaCode && appConfig.features?.articlesNomenclatures?.fromArticlesNomenclaturesLibraries) {
    const libraryKey = `../../../Data/${orgaCode}/articlesNomenclaturesLibraries.js`;
    const loader = ARTICLES_NOMENCLATURES_LOADERS[libraryKey];

    if (loader) {
      try {
        const module = await loader();
        const libraries = module.default;
        newAppConfig.articlesNomenclaturesObject = Object.fromEntries(
          libraries.map((nom) => [nom.key, nom])
        );
      } catch (error) {
        console.error(`[resolveAppConfig] Error loading articlesNomenclaturesLibraries for "${orgaCode}":`, error);
      }
    } else {
      console.warn(`[resolveAppConfig] No articlesNomenclaturesLibraries found for orgaCode "${orgaCode}" at ${libraryKey}`);
    }
  }

  // mapping categories
  if (orgaCode && appConfig.features?.articlesNomenclatures?.fromArticlesNomenclaturesLibraries) {
    const categoryKey = `../../../Data/${orgaCode}/mappingCategories.js`;
    const loader = MAPPING_CATEGORIES_LOADERS[categoryKey];

    if (loader) {
      try {
        const module = await loader();
        newAppConfig.mappingCategories = module.default;
      } catch (error) {
        console.error(`[resolveAppConfig] Error loading mappingCategories for "${orgaCode}":`, error);
      }
    } else {
      console.warn(`[resolveAppConfig] No mappingCategories found for orgaCode "${orgaCode}" at ${categoryKey}`);
    }
  }

  // automated annotation procedures
  if (orgaCode) {
    const proceduresKey = `../../../Data/${orgaCode}/automatedAnnotationsProcedures/index.js`;
    const loader = AUTOMATED_PROCEDURES_LOADERS[proceduresKey];

    if (loader) {
      try {
        const module = await loader();
        newAppConfig.automatedAnnotationsProcedures = module.default;
      } catch (error) {
        console.error(`[resolveAppConfig] Error loading automatedAnnotationsProcedures for "${orgaCode}":`, error);
      }
    }
  }

  // hardcoded fields for debug mode

  // if (options?.debug) {
  //   newAppConfig.remoteContainer = {
  //     ...newAppConfig.remoteContainer,
  //     path: "/0. DONNEES BIMBOXA",
  //   };
  // }

  // portfolios - resolve default logo asset

  if (newAppConfig.features?.portfolios) {
    const config = newAppConfig.features.portfolios;
    if (config.logoDefault?.urlFromAssetKey && !config.logoDefault.url) {
      const assetKey = `../../../App/assets/${config.logoDefault.urlFromAssetKey}.png`;
      const loader = APP_IMAGE_ASSET_LOADERS[assetKey];

      if (loader) {
        try {
          config.logoDefault.url = await loader();
        } catch (error) {
          console.error(
            `[resolveAppConfig] Error loading asset "${config.logoDefault.urlFromAssetKey}":`,
            error
          );
        }
      } else {
        console.warn(
          `[resolveAppConfig] Asset "${config.logoDefault.urlFromAssetKey}.png" not found in App/assets/`
        );
      }
    }
  }

  // bg images - dynamically load from assets based on urlFromAssetKey

  if (appConfig.features?.bgImages?.options?.length > 0) {
    const options = await Promise.all(
      appConfig.features.bgImages.options.map(async (bgImage) => {
        if (bgImage.urlFromAssetKey && !bgImage.url) {
          const assetKey = `../../../App/assets/${bgImage.urlFromAssetKey}.png`;
          const loader = APP_IMAGE_ASSET_LOADERS[assetKey];

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
