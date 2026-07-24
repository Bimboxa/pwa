import { useEffect, useState } from "react";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

// Lazy loaders for the per-org object library. Nothing loads until this hook
// mounts (i.e. until the "Banque d'objets" panel is opened). The glob is
// wildcarded on the org segment and only ever looked up by a
// `Data/${configCode}/...` runtime key — never a literal static import into an
// org folder (that invariant is what broke CI before).
const MANIFEST_LOADERS = import.meta.glob(
  "../../../Data/*/objectsLibrary/manifest.json",
  { eager: false }
);
const IMAGE_LOADERS = import.meta.glob(
  "../../../Data/*/objectsLibrary/assets/**/*.{png,jpg,jpeg,webp,svg}",
  { query: "?url", import: "default", eager: false }
);
const VIDEO_LOADERS = import.meta.glob(
  "../../../Data/*/objectsLibrary/assets/**/*.{mp4,webm}",
  { query: "?url", import: "default", eager: false }
);

// Resolve an asset path relative to the org's objectsLibrary folder to a bundled
// URL (or undefined when the asset is missing).
async function resolveAssetUrl(loaders, configCode, relPath) {
  if (!relPath) return undefined;
  const key = `../../../Data/${configCode}/objectsLibrary/${relPath}`;
  const loader = loaders[key];
  if (!loader) return undefined;
  try {
    return await loader();
  } catch {
    return undefined;
  }
}

// Resolve a 3D file (.glb) name to a bundled URL, via the loaders built by
// resolveAppConfig from the org config (features.objectsLibrary.assets3dPath).
async function resolveFile3dUrl(file3dLoaders, fileName) {
  if (!fileName) return undefined;
  const loader = file3dLoaders?.[fileName];
  if (!loader) return undefined;
  try {
    return await loader();
  } catch {
    return undefined;
  }
}

export default function useObjectsLibrary() {
  const [objects, setObjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const configCode = import.meta.env.VITE_CONFIG_CODE;

  const appConfig = useAppConfig();
  // Stable across renders once resolveAppConfig has run (set once at init).
  const objectsLibraryConfig = appConfig?.features?.objectsLibrary;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const manifestPath = `../../../Data/${configCode}/objectsLibrary/manifest.json`;
        const loader = MANIFEST_LOADERS[manifestPath];
        if (!loader) {
          if (!cancelled) {
            setObjects([]);
            setLoading(false);
          }
          return;
        }

        const module = await loader();
        const manifest = module?.default ?? module;
        const items = Array.isArray(manifest)
          ? manifest
          : (manifest?.objects ?? []);

        const file3dLoaders = objectsLibraryConfig?.file3dLoaders ?? {};

        const resolved = await Promise.all(
          items.map(async (obj) => ({
            ...obj,
            thumbnailUrl: await resolveAssetUrl(
              IMAGE_LOADERS,
              configCode,
              obj.thumbnail
            ),
            videoUrl: obj.video
              ? await resolveAssetUrl(VIDEO_LOADERS, configCode, obj.video)
              : undefined,
            file3dUrl: await resolveFile3dUrl(file3dLoaders, obj.file3d),
          }))
        );

        if (!cancelled) {
          setObjects(resolved);
          setLoading(false);
        }
      } catch (error) {
        console.error("[useObjectsLibrary] load error", error);
        if (!cancelled) {
          setObjects([]);
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [configCode, objectsLibraryConfig]);

  return { objects, loading };
}
