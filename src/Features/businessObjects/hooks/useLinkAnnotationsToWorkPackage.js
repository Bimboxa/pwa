import { useDispatch } from "react-redux";

import { triggerRelsWorkPackageAnnotationUpdate } from "../businessObjectsSlice";
import { setToaster } from "Features/layout/layoutSlice";

import linkAnnotationsToWorkPackageService from "../services/linkAnnotationsToWorkPackageService";

export default function useLinkAnnotationsToWorkPackage() {
  const dispatch = useDispatch();

  const link = async ({ workPackage, annotationIds }) => {
    const { created, replaced } = await linkAnnotationsToWorkPackageService({
      workPackage,
      annotationIds,
    });
    dispatch(triggerRelsWorkPackageAnnotationUpdate());
    const n = created.length;
    const message =
      n === 0
        ? `Déjà dans "${workPackage.label}"`
        : `${n} annotation${n > 1 ? "s" : ""} liée${n > 1 ? "s" : ""} à "${
            workPackage.label
          }"` +
          (replaced > 0
            ? ` (${replaced} déplacée${replaced > 1 ? "s" : ""})`
            : "");
    dispatch(setToaster({ message }));
    return created;
  };

  return link;
}
