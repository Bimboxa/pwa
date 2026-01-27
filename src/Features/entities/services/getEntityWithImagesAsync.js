import db from "App/db/db";
import testIsImage from "Features/files/utils/testIsImage";
import getImageSizeAsync from "Features/images/utils/getImageSizeAsync";

export default async function getEntityWithImagesAsync(entity) {
  if (!entity) return {};

  let hasImages = false;
  const entityWithImages = { ...entity };

  // --- INTERNAL HELPER ---
  // Charge le fichier depuis la DB et génère l'URL pour un item donné
  const hydrateImage = async (item) => {
    if (!item || !item.fileName) return item;

    const file = await db.files.get(item.fileName);

    if (file && file.fileArrayBuffer) {
      const blob = new Blob([file.fileArrayBuffer], { type: file.fileMime });
      const url = URL.createObjectURL(blob);

      hasImages = true; // Side effect : on note qu'on a trouvé au moins une image

      const enrichedItem = {
        ...item,
        file,
        imageUrlClient: url,
      };

      // Si la taille n'est pas déjà dans les métadonnées (compatibilité ou fallback)
      if (!enrichedItem.imageSize && testIsImage(blob)) {
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