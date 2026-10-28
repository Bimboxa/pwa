import { useDispatch } from "react-redux";

import {
  triggerBusinessObjectsUpdate,
  triggerRelsBusinessObjectAnnotationUpdate,
} from "../businessObjectsSlice";
import { setToaster } from "Features/layout/layoutSlice";

import setBusinessObjectAnnotationExclusionsService from "../services/setBusinessObjectAnnotationExclusionsService";

// Excludes / re-includes annotations from a business object's "Lien par
// modèle" (see services/setBusinessObjectAnnotationExclusionsService),
// refreshes the readers and toasts the result.
export default function useSetBusinessObjectAnnotationExclusions() {
  const dispatch = useDispatch();

  const setExclusions = async ({ businessObject, annotationIds, excluded }) => {
    try {
      const { changedIds, deletedRelIds } =
        await setBusinessObjectAnnotationExclusionsService({
          businessObject,
          annotationIds,
          excluded,
        });
      dispatch(triggerBusinessObjectsUpdate());
      if (deletedRelIds.length > 0)
        dispatch(triggerRelsBusinessObjectAnnotationUpdate());

      const n = changedIds.length;
      const plural = n > 1 ? "s" : "";
      const message =
        n === 0
          ? excluded
            ? `Déjà exclue${plural} de "${businessObject.label}"`
            : `Déjà comptée${plural} dans "${businessObject.label}"`
          : excluded
            ? `${n} annotation${plural} exclue${plural} de "${businessObject.label}"`
            : `${n} annotation${plural} réintégrée${plural} dans "${businessObject.label}"`;
      dispatch(setToaster({ message }));
      return changedIds;
    } catch (error) {
      console.error("[businessObjects] set exclusions", error);
      dispatch(
        setToaster({ message: error?.message ?? `${error}`, isError: true })
      );
      return [];
    }
  };

  return setExclusions;
}
