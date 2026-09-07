import { useRef, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";
import { canEditRecord } from "App/db/ownership";
import getUserIdMaster from "Features/auth/utils/getUserIdMaster";
import useIsSelectedScopeEditor from "Features/scopes/hooks/useIsSelectedScopeEditor";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import getSelectScopeRequiredMessage from "Features/scopes/utils/getSelectScopeRequiredMessage";

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
const PERMISSION_MESSAGE =
  "Vous ne pouvez pas modifier une annotation dont vous n'êtes pas le créateur";

export default function useAnnotationPermissions({ annotations }) {
  const dispatch = useDispatch();
  const currentUserId = useSelector((state) =>
    getUserIdMaster(state.auth.userProfile)
  );

  // Ref toujours fraîche — PAS dans un deps array
  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations; // sync à chaque render (O(1))

  // Editor bypass (scope.editorsTrigrams) — ref pour garder les callbacks
  // stables (même contrat que annotationsRef).
  const isEditor = useIsSelectedScopeEditor();
  const isEditorRef = useRef(isEditor);
  isEditorRef.current = isEditor;

  // No-scope guard (mirrors assertScopeSelected in App/db/db.js) — refs so
  // the callbacks stay stable. Base map annotations are exempt.
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const scopeIdRef = useRef(selectedScopeId);
  scopeIdRef.current = selectedScopeId;
  const appConfig = useAppConfig();
  const scopeMessageRef = useRef();
  scopeMessageRef.current = getSelectScopeRequiredMessage(appConfig);

  /**
   * Vérifie si l'utilisateur courant peut modifier une annotation.
   * Coût : O(n) lookup — appelé uniquement sur événement utilisateur.
   *
   * @param {string} annotationId
   * @param {{ silent?: boolean }} [options] - silent: no toast on failure
   *   (batch probes, e.g. multi-selection shared-vertex matching)
   * @returns {boolean}
   */
  const canEditAnnotation = useCallback(
    (annotationId, { silent = false } = {}) => {
      const ann = annotationsRef.current?.find((a) => a.id === annotationId);
      // Before the editor bypass: an edit grant does not replace a scope.
      if (!scopeIdRef.current && !ann?.isBaseMapAnnotation) {
        if (!silent) {
          dispatch(
            setToaster({ message: scopeMessageRef.current, isError: true })
          );
        }
        return false;
      }
      if (isEditorRef.current) return true;
      if (canEditRecord(ann, currentUserId)) return true;
      if (!silent) {
        dispatch(setToaster({ message: PERMISSION_MESSAGE, isError: true }));
      }
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
      const matched = [];

      for (const ann of anns) {
        const inMain = ann.points?.some((pt) => pt.id === pointId);
        const inCuts = ann.cuts?.some((cut) =>
          cut.points?.some((pt) => pt.id === pointId)
        );
        const inInner = ann.innerPoints?.some((pt) => pt.id === pointId);
        const inGuide = ann.guideLines?.some((gl) =>
          gl?.points?.some((g) => g.pointId === pointId || g.id === pointId)
        );
        const inIso = ann.isoHeightLines?.some((l) =>
          l?.points?.some((g) => g.pointId === pointId || g.id === pointId)
        );
        const inProfile = ann.profileLines?.some((l) =>
          l?.points?.some((g) => g.pointId === pointId || g.id === pointId)
        );
        if (inMain || inCuts || inInner || inGuide || inIso || inProfile) {
          matched.push(ann);
          if (isEditorRef.current || canEditRecord(ann, currentUserId)) {
            myIds.push(ann.id);
          } else {
            foreignIds.push(ann.id);
          }
        }
      }

      // No scope selected: block outright (no fork attempt — the db guard
      // would reject it anyway). Base map annotations stay editable.
      if (!scopeIdRef.current && matched.some((a) => !a.isBaseMapAnnotation)) {
        dispatch(
          setToaster({ message: scopeMessageRef.current, isError: true })
        );
        return {
          allowed: false,
          mustFork: false,
          blocked: true,
          myAnnotationIds: [],
          foreignAnnotationIds: matched.map((a) => a.id),
        };
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
