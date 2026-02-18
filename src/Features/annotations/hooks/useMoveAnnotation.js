import { generateKeyBetween } from 'fractional-indexing';

import db from "App/db/db";

export default function useMoveAnnotation() {

  const move = async (annotation, position) => {
    console.log("debug_0912_moveAnnotation", annotation, position);
    // Vérification de la présence du baseMapId pour le regroupement
    if (!annotation?.id || !annotation.baseMapId) return;

    // 1. Récupérer toutes les annotations partageant le même baseMapId
    const allAnnotations = await db.annotations
      .where("baseMapId")
      .equals(annotation.baseMapId)
      .toArray();

    // 2. Extraire et trier les index existants (non null / non undefined)
    const existingIndexes = allAnnotations
      .map(a => a.orderIndex)
      .filter(idx => idx !== null && idx !== undefined)
      .sort();

    let newOrderIndex = null;

    if (position === "top") {
      // On récupère le plus grand index actuel parmi les annotations de cette carte
      const highestIndex = existingIndexes.length > 0
        ? existingIndexes[existingIndexes.length - 1]
        : null;

      // Génère un index supérieur au maximum actuel (ex: "a0", "a1"...)
      newOrderIndex = generateKeyBetween(highestIndex, null);
    }
    else if (position === "bottom") {
      /**
       * Comme les éléments avec index sont considérés "au-dessus" des nulls,
       * repasser l'index à null place l'objet tout en bas du plan.
       */
      newOrderIndex = null;
    }

    // 3. Mise à jour de l'annotation spécifique dans IndexedDB
    await db.annotations.update(annotation.id, {
      orderIndex: newOrderIndex
    });

    console.log(`debug_moveAnnotation: ${annotation.id} sur baseMap ${annotation.baseMapId} déplacé vers ${position}`, { newOrderIndex });
  };

  return move;
}