import db from "App/db/db";
import testIsImage from "Features/files/utils/testIsImage";
import getImageSizeAsync from "Features/images/utils/getImageSizeAsync";

// One object URL per db.files row (keyed by fileName + updatedAt): the same
// image resolved on every liveQuery run keeps the same `imageUrlClient`, so
// the resolved annotation keeps its identity (stabilizeAnnotationsIdentity)
// and the 3D viewer does not rebuild IMAGE planes on each emission. Also
// stops leaking one unrevoked blob URL per run.
const objectUrlByFileKey = new Map();

function getStableObjectUrl(file) {
  const key = `${file.fileName}::${file.updatedAt ?? ""}`;
  let url = objectUrlByFileKey.get(key);
  if (!url) {
    const blob = new Blob([file.fileArrayBuffer], { type: file.fileMime });
    url = URL.createObjectURL(blob);
    objectUrlByFileKey.set(key, url);
  }
  return url;
}

export default async function getEntityWithImagesAsync(entity, filesMap) {
  if (!entity) return {};

  let hasImages = false;
  const entityWithImages = { ...entity };

  // --- INTERNAL HELPER ---
  // Charge le fichier depuis la DB et génère l'URL pour un item donné
  const hydrateImage = async (item) => {
    if (!item || !item.fileName) return item;

    // Use pre-fetched filesMap when available, fallback to individual DB query
    const file = filesMap ? filesMap[item.fileName] : await db.files.get(item.fileName);

    if (file && file.fileArrayBuffer) {
      const url = getStableObjectUrl(file);

      hasImages = true; // Side effect : on note qu'on a trouvé au moins une image

      const enrichedItem = {
        ...item,
        file,
        imageUrlClient: url,
      };

      // Si la taille n'est pas déjà dans les métadonnées (compatibilité ou fallback)
      if (
        !enrichedItem.imageSize &&
        testIsImage({ type: file.fileMime, name: file.srcFileName ?? "" })
      ) {
        enrichedItem.imageSize = await getImageSizeAsync(url);
      }

      return enrichedItem;
    } else {
      // Fichier introuvable en base ou corrompu
      return {
        ...item,
        imageUrlClient: null,
      };
    }
  };
  // -----------------------

  // 1. GESTION DU CHAMP "images" (TABLEAU)
  if (Array.isArray(entity.images)) {
    // On traite chaque image du tableau en parallèle
    entityWithImages.images = await Promise.all(
      entity.images.map((img) => hydrateImage(img))
    );
  }

  // 2. GESTION DES CHAMPS SIMPLES (ex: avatar, cover...)
  // On filtre les entrées qui sont des objets marqués isImage (et on exclut 'images' car déjà traité)
  const entriesWithImages = Object.entries(entity).filter(
    ([key, value]) => key !== "images" && value && typeof value === 'object' && value.isImage
  );

  // On utilise une boucle for...of pour traiter séquentiellement (ou Promise.all si tu préfères la vitesse)
  for (const [key, value] of entriesWithImages) {
    entityWithImages[key] = await hydrateImage(value);
  }

  return { entityWithImages, hasImages };
}