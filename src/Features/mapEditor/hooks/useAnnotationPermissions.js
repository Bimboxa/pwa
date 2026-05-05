import { useRef, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";

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
const PERMISSION_MESSAGE = "Vous ne pouvez pas modifier une annotation dont vous n'êtes pas le créateur";

export default function useAnnotationPermissions({ annotations }) {
  const dispatch = useDispatch();
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
      if (ann?.createdByUserIdMaster === currentUserId) return true;
      dispatch(setToaster({ message: PERMISSION_MESSAGE, isError: true }));
      return false;
    },
    [currentUserId, dispatch]
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
        const inInner = ann.innerPoints?.some((pt) => pt.id === pointId);
        if (inMain || inCuts || inInner) {
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

      const blocked = myIds.length === 0;
      if (blocked) {
        dispatch(setToaster({ message: PERMISSION_MESSAGE, isError: true }));
      }

      return {
        allowed: myIds.length > 0,
        mustFork: myIds.length > 0 && foreignIds.length > 0,
        blocked,
        myAnnotationIds: myIds,
        foreignAnnotationIds: foreignIds,
      };
    },
    [currentUserId, dispatch]
  );

  return { currentUserId, canEditAnnotation, checkPointPermission };
}
