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
const LIBRARIES_LOADERS = import.meta.glob(
  "../../../Data/*/annotationTemplatesLibraries.js",
  {
    eager: false,
  }
);

// Dynamic loaders for articles nomenclatures libraries
const ARTICLES_NOMENCLATURES_LOADERS = import.meta.glob(
  "../../../Data/*/articlesNomenclaturesLibraries.js",
  {
    eager: false,
  }
);

// Dynamic loaders for mapping categories
const MAPPING_CATEGORIES_LOADERS = import.meta.glob(
  "../../../Data/*/mappingCategories.js",
  {
    eager: false,
  }
);

// Dynamic loaders for automated annotation procedures
const AUTOMATED_PROCEDURES_LOADERS = import.meta.glob(
  "../../../Data/*/automatedAnnotationsProcedures/index.js",
  {
    eager: false,
  }
);

// Dynamic loaders for image transformation prompts
const IMAGE_TRANSFORMATION_PROMPTS_LOADERS = import.meta.glob(
  "../../../Data/*/imageTransformationPrompts.js",
  {
    eager: false,
  }
);

// Dynamic loaders for the app event logging registry (appLog / Scribe)
const APP_LOG_EVENTS_LOADERS = import.meta.glob(
  "../../../Data/*/appLogEvents.js",
  {
    eager: false,
  }
);

// Dynamic loader for Data files (JS modules referenced via `importFromData`).
// Keep this narrow: a `Data/**/*` glob would also match .md/.css/.json files
// that Vite would then try to parse as JS at build time.
const DATA_LOADERS = import.meta.glob("../../../Data/**/*.js", {
  eager: false,
});

// SVG assets stored under each org's Data folder, returned as URLs so we
// can use them in <img src> or SVG <image href>.
const DATA_SVG_URL_LOADERS = import.meta.glob("../../../Data/**/*.svg", {
  as: "url",
  eager: false,
});

// Raster assets (PNG / JPG) stored under each org's Data folder.
const DATA_IMAGE_URL_LOADERS = import.meta.glob(
  "../../../Data/**/*.{png,jpg,jpeg,webp}",
  { as: "url", eager: false }
);

// Documentation: per-org Markdown pages, sidebar manifest, and optional CSS.
// Lives under Data/<orga>/documentation/.
const DOCUMENTATION_MD_LOADERS = import.meta.glob(
  "../../../Data/*/documentation/**/*.md",
  { query: "?raw", import: "default", eager: false }
);
const DOCUMENTATION_SIDEBAR_LOADERS = import.meta.glob(
  "../../../Data/*/documentation/sidebar.json",
  { eager: false }
);
const DOCUMENTATION_CSS_LOADERS = import.meta.glob(
  "../../../Data/*/documentation/**/*.css",
  { query: "?raw", import: "default", eager: false }
);
const DOCUMENTATION_IMAGE_LOADERS = import.meta.glob(
  "../../../Data/*/documentation/**/*.{png,jpg,jpeg,webp,svg,gif}",
  { query: "?url", import: "default", eager: false }
);

// Object library (Banque d'objets) — 3D object files (.glb) stored under each
// org's objectsLibrary folder, returned as URLs and resolved lazily.
const OBJECTS_LIBRARY_FILE3D_LOADERS = import.meta.glob(
  "../../../Data/*/objectsLibrary/**/*.glb",
  { query: "?url", import: "default", eager: false }
);

// Title blocks (cartouches) — declarative manifest modules stored under each
// org's titleBlocks folder, one folder per title block.
const TITLE_BLOCK_MANIFEST_LOADERS = import.meta.glob(
  "../../../Data/*/titleBlocks/*/titleBlock.js",
  { eager: false }
);

// Krto creation configurations — registry module stored under each org's
// configurations folder (one js file per configuration + assets/).
const KRTO_CONFIGURATIONS_LOADERS = import.meta.glob(
  "../../../Data/*/configurations/index.js",
  { eager: false }
);

export default async function resolveAppConfig(appConfig) {
  // edge case

  if (!appConfig) return;

  const newAppConfig = structuredClone(appConfig);

  // appConfig code
  const orgaCode = appConfig.orgaCode;

  // orgaData

  const newOrgaData = {};
  const orgaDataArray = Object.entries(appConfig.orgaData ?? {});
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
  console.log(
    "debug_3012_appConfig",
    orgaCode &&
      appConfig.features.presetScopes?.fromAnnotationTemplatesLibraries
  );
  if (
    orgaCode &&
    appConfig.features.presetScopes?.fromAnnotationTemplatesLibraries
  ) {
    const libraryKey = `../../../Data/${orgaCode}/annotationTemplatesLibraries.js`;
    const loader = LIBRARIES_LOADERS[libraryKey];

    if (loader) {
      try {
        const module = await loader();
        const libraries = module.default;

        const presetScopeItems = appConfig.features.presetScopes.items;

        const {
          presetListingsObject,
          presetScopesObject,
          presetScopesSortedKeys,
        } =
          resolvePresetListingsAndScopesObjectFromAnnotationTemplatesLibraries(
            libraries,
            presetScopeItems
          );

        newAppConfig.presetListingsObject = {
          ...newAppConfig.presetListingsObject,
          ...(presetListingsObject ?? {}),
        };

        newAppConfig.presetScopesObject = {
          ...newAppConfig.presetScopesObject,
          ...(presetScopesObject ?? {}),
        };

        newAppConfig.presetScopesSortedKeys = [
          ...(newAppConfig.presetScopesSortedKeys ?? []),
          ...(presetScopesSortedKeys ?? []),
        ];
      } catch (error) {
        console.error(
          `[resolveAppConfig] Error loading libraries for "${orgaCode}":`,
          error
        );
      }
    } else {
      console.warn(
        `[resolveAppConfig] No libraries found for orgaCode "${orgaCode}" at ${libraryKey}`
      );
    }
  }

  // Krto creation configurations (card selector in the scope creator).
  // Registry: src/Data/<orgaCode>/configurations/index.js — default export is
  // an array of configuration objects (the Data files are gitignored, so the
  // schema is documented here):
  //   { key, name, description,
  //     code,                       // short monospace card label (e.g. "MET.TOIT")
  //     chipLabel,                  // card category chip (e.g. "Métré")
  //     optionalModules,            // creation options the user may toggle in
  //                                 // the recap ("DPGF" | "CARNET_DETAIL");
  //                                 // absent/empty => Modules section hidden
  //     imagePath,                  // card SVG, relative to Data/<orgaCode>/
  //     keywords: { ouvrage: [], type: [], options: [] },
  //     baseMaps: {
  //       disableExistingListings,  // hide the project's pre-existing
  //                                 // BASE_MAP listings for this scope
  //       listings: [{ name, verticalBaseMaps, items: [
  //         { type: "BLANK_PAGE", name, pageFormat: "A4"|"A3",
  //           pageOrientation: "LANDSCAPE"|"PORTRAIT"|"SQUARE", scale },
  //         { type: "ASSET", name, assetPath, meterByPx },  // raster only
  //       ]}],
  //     },
  //     annotations: { libraryKeys },  // annotationTemplatesLibraries keys
  //     scopeConfig: { disabledModuleKeys, disabledToolKeys,
  //                    disabledToolKeysByModule } }  // absent => app defaults
  // Named export `configurationKeywordFamilies` = [{ key, label }].
  if (orgaCode && appConfig.features?.krtoConfigurations?.enabled) {
    const registryKey = `../../../Data/${orgaCode}/configurations/index.js`;
    const loader = KRTO_CONFIGURATIONS_LOADERS[registryKey];
    if (loader) {
      try {
        const module = await loader();
        const configurations = module.default ?? [];
        const keywordFamilies = module.configurationKeywordFamilies ?? [];

        const items = [];
        for (const configuration of configurations) {
          if (!configuration?.key) continue;
          // clone: never mutate the module singleton, and keep the Redux
          // appConfig plain-serializable (no loaders inside items).
          const item = structuredClone(configuration);

          if (item.imagePath) {
            const fullPath = `../../../Data/${orgaCode}/${item.imagePath}`;
            const imageLoader =
              DATA_SVG_URL_LOADERS[fullPath] ||
              DATA_IMAGE_URL_LOADERS[fullPath];
            if (imageLoader) item.imageUrl = await imageLoader();
          }

          for (const listing of item.baseMaps?.listings ?? []) {
            for (const baseMapItem of listing.items ?? []) {
              if (baseMapItem.type === "ASSET" && baseMapItem.assetPath) {
                const assetKey = `../../../Data/${orgaCode}/${baseMapItem.assetPath}`;
                const assetLoader = DATA_IMAGE_URL_LOADERS[assetKey];
                if (assetLoader) baseMapItem.assetUrl = await assetLoader();
              }
            }
          }

          items.push(item);
        }

        newAppConfig.features.krtoConfigurations = {
          ...newAppConfig.features.krtoConfigurations,
          items,
          keywordFamilies,
        };

        // Backward-compat: a scope created from a configuration stores its key
        // in scope.presetScopeKey. Merge each configuration into
        // presetScopesObject (feeds getPresetScopeLabel and the listings sort
        // fallback) WITHOUT touching presetScopesSortedKeys, so the legacy
        // preset pickers keep ignoring these keys.
        const presetScopesObject = {
          ...(newAppConfig.presetScopesObject ?? {}),
        };
        for (const item of items) {
          presetScopesObject[item.key] = {
            key: item.key,
            name: item.name,
            listings: item.annotations?.libraryKeys ?? [],
          };
        }
        newAppConfig.presetScopesObject = presetScopesObject;
      } catch (error) {
        console.error(
          `[resolveAppConfig] Error loading configurations for "${orgaCode}":`,
          error
        );
      }
    }
  }

  // articles nomenclatures libraries
  if (
    orgaCode &&
    appConfig.features?.articlesNomenclatures
      ?.fromArticlesNomenclaturesLibraries
  ) {
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
        console.error(
          `[resolveAppConfig] Error loading articlesNomenclaturesLibraries for "${orgaCode}":`,
          error
        );
      }
    } else {
      console.warn(
        `[resolveAppConfig] No articlesNomenclaturesLibraries found for orgaCode "${orgaCode}" at ${libraryKey}`
      );
    }
  }

  // mapping categories
  if (
    orgaCode &&
    appConfig.features?.articlesNomenclatures
      ?.fromArticlesNomenclaturesLibraries
  ) {
    const categoryKey = `../../../Data/${orgaCode}/mappingCategories.js`;
    const loader = MAPPING_CATEGORIES_LOADERS[categoryKey];

    if (loader) {
      try {
        const module = await loader();
        newAppConfig.mappingCategories = module.default;
      } catch (error) {
        console.error(
          `[resolveAppConfig] Error loading mappingCategories for "${orgaCode}":`,
          error
        );
      }
    } else {
      console.warn(
        `[resolveAppConfig] No mappingCategories found for orgaCode "${orgaCode}" at ${categoryKey}`
      );
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
        console.error(
          `[resolveAppConfig] Error loading automatedAnnotationsProcedures for "${orgaCode}":`,
          error
        );
      }
    }
  }

  // image transformation prompts
  if (orgaCode) {
    const promptsKey = `../../../Data/${orgaCode}/imageTransformationPrompts.js`;
    const loader = IMAGE_TRANSFORMATION_PROMPTS_LOADERS[promptsKey];

    if (loader) {
      try {
        const module = await loader();
        newAppConfig.imageTransformationPrompts = module.default;
      } catch (error) {
        console.error(
          `[resolveAppConfig] Error loading imageTransformationPrompts for "${orgaCode}":`,
          error
        );
      }
    }
  }

  // app log events registry (appLog / Scribe)
  if (orgaCode) {
    const key = `../../../Data/${orgaCode}/appLogEvents.js`;
    const loader = APP_LOG_EVENTS_LOADERS[key];

    if (loader) {
      try {
        const module = await loader();
        newAppConfig.appLogEvents = module.default;
      } catch (error) {
        console.error(
          `[resolveAppConfig] Error loading appLogEvents for "${orgaCode}":`,
          error
        );
      }
    }
  }

  // documentation - per-org Markdown docs (Docusaurus-style).
  // Opt-in: enabled only if a sidebar.json exists for this org.
  if (orgaCode) {
    const sidebarKey = `../../../Data/${orgaCode}/documentation/sidebar.json`;
    const sidebarLoader = DOCUMENTATION_SIDEBAR_LOADERS[sidebarKey];

    if (sidebarLoader) {
      try {
        const sidebarModule = await sidebarLoader();
        const sidebar = sidebarModule.default ?? sidebarModule;

        const docPrefix = `../../../Data/${orgaCode}/documentation/`;

        const pageLoaders = {};
        for (const [path, loader] of Object.entries(DOCUMENTATION_MD_LOADERS)) {
          if (!path.startsWith(docPrefix)) continue;
          // Per-page scheme: `pages/<slug>/index.md` -> page id `<slug>`.
          // Legacy flat/category files (e.g. `intro.md`) keep their path-based id.
          const id = path
            .slice(docPrefix.length)
            .replace(/\.md$/, "")
            .replace(/^pages\//, "")
            .replace(/\/index$/, "");
          pageLoaders[id] = loader;
        }

        const imageLoaders = {};
        for (const [path, loader] of Object.entries(
          DOCUMENTATION_IMAGE_LOADERS
        )) {
          if (!path.startsWith(docPrefix)) continue;
          // Per-page scheme: `pages/<slug>/images/x.gif` -> key `<slug>/images/x.gif`,
          // so it resolves against the page id `<slug>` (see resolveDocImageSrc).
          const relPath = path.slice(docPrefix.length).replace(/^pages\//, "");
          imageLoaders[relPath] = loader;
        }

        let customCss = null;
        const customCssKey = `${docPrefix}custom.css`;
        const cssLoader = DOCUMENTATION_CSS_LOADERS[customCssKey];
        if (cssLoader) {
          try {
            customCss = await cssLoader();
          } catch (error) {
            console.error(
              `[resolveAppConfig] Error loading documentation custom.css:`,
              error
            );
          }
        }

        newAppConfig.features = newAppConfig.features ?? {};
        newAppConfig.features.documentation = {
          enabled: true,
          basePath: `Data/${orgaCode}/documentation`,
          sidebar,
          pageLoaders,
          imageLoaders,
          customCss,
        };
      } catch (error) {
        console.error(
          `[resolveAppConfig] Error resolving documentation for "${orgaCode}":`,
          error
        );
      }
    }
  }

  // object library (Banque d'objets) — expose the 3D-file (.glb) loaders so the
  // lazily-loaded panel resolves an object's `file3d` to a bundled URL. The org
  // config declares the assets folder (features.objectsLibrary.assets3dPath).
  if (orgaCode && newAppConfig.features?.objectsLibrary) {
    const config = newAppConfig.features.objectsLibrary;
    const assets3dPath = config.assets3dPath ?? "assets";
    const dirPrefix = `../../../Data/${orgaCode}/objectsLibrary/${assets3dPath}/`;
    const file3dLoaders = {};
    for (const [path, loader] of Object.entries(
      OBJECTS_LIBRARY_FILE3D_LOADERS
    )) {
      if (!path.startsWith(dirPrefix)) continue;
      const fileName = path.slice(dirPrefix.length); // e.g. "pelleteuse.glb"
      file3dLoaders[fileName] = loader;
    }
    newAppConfig.features.objectsLibrary = {
      ...config,
      assets3dPath,
      file3dLoaders,
    };
  }

  // hardcoded fields for debug mode

  // if (options?.debug) {
  //   newAppConfig.remoteContainer = {
  //     ...newAppConfig.remoteContainer,
  //     path: "/0. DONNEES BIMBOXA",
  //   };
  // }

  // portfolios - resolve default logo asset (relative to Data/<orga>/)
  if (orgaCode && newAppConfig.features?.portfolios?.logoDefault?.path) {
    const config = newAppConfig.features.portfolios;
    const fullPath = `../../../Data/${orgaCode}/${config.logoDefault.path}`;
    const loader =
      DATA_IMAGE_URL_LOADERS[fullPath] || DATA_SVG_URL_LOADERS[fullPath];
    if (loader) {
      try {
        config.logoDefault.url = await loader();
      } catch (error) {
        console.error(
          `[resolveAppConfig] Error loading portfolio logo:`,
          error
        );
      }
    } else {
      console.warn(
        `[resolveAppConfig] portfolio logo not found at ${fullPath}`
      );
    }
  }

  // titleBlocks - resolve manifest modules (relative to Data/<orga>/)
  if (orgaCode && newAppConfig.features?.titleBlocks?.items?.length > 0) {
    const config = newAppConfig.features.titleBlocks;
    const manifestsByKey = {};
    for (const item of config.items) {
      if (!item?.key || !item?.path) continue;
      const fullPath = `../../../Data/${orgaCode}/${item.path}`;
      const loader = TITLE_BLOCK_MANIFEST_LOADERS[fullPath];
      if (!loader) {
        console.warn(
          `[resolveAppConfig] title block manifest not found at ${fullPath}`
        );
        continue;
      }
      try {
        const module = await loader();
        if (module?.default) manifestsByKey[item.key] = module.default;
      } catch (error) {
        console.error(
          `[resolveAppConfig] Error loading title block "${item.key}":`,
          error
        );
      }
    }
    config.manifestsByKey = manifestsByKey;
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

  // pov - resolve the logo stamped on the capture frame (relative to
  // Data/<orga>/). Output: features.pov.logoUrl. Optional: without it, the POV
  // logo falls back to the portfolio one (usePovLogoUrl).
  if (orgaCode && newAppConfig.features?.pov?.logoPath) {
    const relPath = newAppConfig.features.pov.logoPath;
    const fullPath = `../../../Data/${orgaCode}/${relPath}`;
    const loader =
      DATA_IMAGE_URL_LOADERS[fullPath] || DATA_SVG_URL_LOADERS[fullPath];
    if (loader) {
      try {
        newAppConfig.features.pov.logoUrl = await loader();
      } catch (error) {
        console.error(`[resolveAppConfig] Error loading pov logo:`, error);
      }
    } else {
      console.warn(`[resolveAppConfig] pov logo not found at ${fullPath}`);
    }
  }

  // watermark - resolve per-org SVG paths to URLs (one per aspect ratio).
  // Source: features.watermark.pathsByAspectRatio (relative to Data/<orga>/).
  // Output:  features.watermark.urlsByAspectRatio (same keys, full URLs).
  if (orgaCode && newAppConfig.features?.watermark?.pathsByAspectRatio) {
    const pathsByAspect = newAppConfig.features.watermark.pathsByAspectRatio;
    const urlsByAspect = {};
    for (const [aspectKey, relPath] of Object.entries(pathsByAspect)) {
      const fullPath = `../../../Data/${orgaCode}/${relPath}`;
      const loader = DATA_SVG_URL_LOADERS[fullPath];
      if (!loader) {
        console.warn(
          `[resolveAppConfig] watermark SVG not found at ${fullPath}`
        );
        continue;
      }
      try {
        urlsByAspect[aspectKey] = await loader();
      } catch (error) {
        console.error(
          `[resolveAppConfig] Error loading watermark "${aspectKey}":`,
          error
        );
      }
    }
    newAppConfig.features.watermark.urlsByAspectRatio = urlsByAspect;
  }

  // watermark logo - SVG or raster image used as a corporate stamp on
  // captures. Source: features.watermark.logoPath (relative to
  // Data/<orga>/). Output: features.watermark.logoUrl (full URL).
  if (orgaCode && newAppConfig.features?.watermark?.logoPath) {
    const relPath = newAppConfig.features.watermark.logoPath;
    const fullPath = `../../../Data/${orgaCode}/${relPath}`;
    const loader =
      DATA_SVG_URL_LOADERS[fullPath] || DATA_IMAGE_URL_LOADERS[fullPath];
    if (loader) {
      try {
        newAppConfig.features.watermark.logoUrl = await loader();
      } catch (error) {
        console.error(
          `[resolveAppConfig] Error loading watermark logo:`,
          error
        );
      }
    } else {
      console.warn(
        `[resolveAppConfig] watermark logo not found at ${fullPath}`
      );
    }
  }

  // walk mode - RPG-style weapon image shown bottom-center of the 3D view
  // instead of the built-in concrete lance (no image = no weapon overlay).
  // Source: features.walkMode.rpgImagePath (relative to Data/<orga>/).
  // Output: features.walkMode.rpgImageUrl (full URL).
  if (orgaCode && newAppConfig.features?.walkMode?.rpgImagePath) {
    const relPath = newAppConfig.features.walkMode.rpgImagePath;
    const fullPath = `../../../Data/${orgaCode}/${relPath}`;
    const loader =
      DATA_IMAGE_URL_LOADERS[fullPath] || DATA_SVG_URL_LOADERS[fullPath];
    if (loader) {
      try {
        newAppConfig.features.walkMode.rpgImageUrl = await loader();
      } catch (error) {
        console.error(
          `[resolveAppConfig] Error loading walkMode rpgImage:`,
          error
        );
      }
    } else {
      console.warn(
        `[resolveAppConfig] walkMode rpgImage not found at ${fullPath}`
      );
    }
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
