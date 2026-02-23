import { useRef, useCallback } from "react";
import { useSelector } from "react-redux";

/**
 * Hook central de vérification des permissions d'annotation.
 *
 * Utilise le pattern ref + signal pour éviter les re-renders :
 * - `annotations` est stocké dans une ref (pas dans un deps array)
 * - Les callbacks retournés sont stables (seul dep : currentUserId)
 * - Les fonctions sont appelées on-demand (mousedown, keydown), pas dans le cycle de render
 *
 * @param {{ annotations: Array }} params
 * @returns {{ currentUserId: string, canEditAnnotation: Function, checkPointPermission: Function }}
 */
export default function useAnnotationPermissions({ annotations }) {
  const currentUserId = useSelector(
    (state) => state.auth.userProfile?.userIdMaster
  );

  // Ref toujours fraîche — PAS dans un deps array
  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations; // sync à chaque render (O(1))

  /**
   * Vérifie si l'utilisateur courant peut modifier une annotation.
   * Coût : O(n) lookup — appelé uniquement sur événement utilisateur.
   *
   * @param {string} annotationId
   * @returns {boolean}
   */
  const canEditAnnotation = useCallback(
    (annotationId) => {
      const ann = annotationsRef.current?.find((a) => a.id === annotationId);
      if (ann?.createdByUserIdMaster === "anonymous") return true;
      return ann?.createdByUserIdMaster === currentUserId;
    },
    [currentUserId]
  );

  /**
   * Vérifie les permissions pour un point partagé entre annotations.
   * Classifie les annotations en "miennes" vs "étrangères".
   *
   * @param {string} pointId
   * @returns {{
   *   allowed: boolean,          // Au moins une annotation est à moi
   *   mustFork: boolean,         // Annotations mixtes → duplication nécessaire
   *   blocked: boolean,          // Aucune annotation n'est à moi
   *   myAnnotationIds: string[], // IDs des annotations que je possède
   *   foreignAnnotationIds: string[] // IDs des annotations des autres
   * }}
   */
  const checkPointPermission = useCallback(
    (pointId) => {
      const anns = annotationsRef.current ?? [];
      const myIds = [];
      const foreignIds = [];

      for (const ann of anns) {
        const inMain = ann.points?.some((pt) => pt.id === pointId);
        const inCuts = ann.cuts?.some((cut) =>
          cut.points?.some((pt) => pt.id === pointId)
        );
        if (inMain || inCuts) {
          if (
            ann.createdByUserIdMaster === currentUserId ||
            ann.createdByUserIdMaster === "anonymous"
          ) {
            myIds.push(ann.id);
          } else {
            foreignIds.push(ann.id);
          }
        }
      }

      return {
        allowed: myIds.length > 0,
        mustFork: myIds.length > 0 && foreignIds.length > 0,
        blocked: myIds.length === 0,
        myAnnotationIds: myIds,
        foreignAnnotationIds: foreignIds,
      };
    },
    [currentUserId]
  );

  return { currentUserId, canEditAnnotation, checkPointPermission };
}
