import db from "App/db/db";

import { setToaster } from "Features/layout/layoutSlice";
import {
  triggerBusinessObjectsUpdate,
  triggerRelsBusinessObjectAnnotationUpdate,
} from "../businessObjectsSlice";

import toggleAnnotationBusinessObjectLinkService from "./toggleAnnotationBusinessObjectLinkService";
import toggleAnnotationBusinessObjectExclusionService from "./toggleAnnotationBusinessObjectExclusionService";

// Picking mode click on an annotation (2D InteractionLayer and 3D
// MainThreedEditor share it): toggles the annotation's N-N link to the armed
// business object — or, in the EXCLUDE flavour, its exclusion from the
// object's "Lien par modèle" —, refreshes the Dexie mirrors and toasts the
// outcome. The caller stays in the mode (only Escape exits it).
export default async function pickAnnotationForBusinessObjectLinkService({
  annotationId,
  linkingBusinessObjectId,
  linkingMode,
  dispatch,
}) {
  if (!annotationId || !linkingBusinessObjectId) return;
  const businessObject = await db.businessObjects.get(linkingBusinessObjectId);
  if (!businessObject || businessObject.deletedAt) return;

  if (linkingMode === "EXCLUDE") {
    const result = await toggleAnnotationBusinessObjectExclusionService({
      businessObject,
      annotationId,
    });
    if (result !== "skipped") {
      dispatch(triggerBusinessObjectsUpdate());
      dispatch(triggerRelsBusinessObjectAnnotationUpdate());
    }
    dispatch(
      setToaster(
        result === "skipped"
          ? {
              message: `Le modèle de cette annotation n'est pas lié par modèle à "${businessObject.label}"`,
              severity: "warning",
            }
          : result === "excluded"
            ? {
                message: `Annotation exclue de "${businessObject.label}"`,
                severity: "info",
              }
            : {
                message: `Annotation réintégrée dans "${businessObject.label}"`,
                severity: "success",
              }
      )
    );
    return;
  }

  const result = await toggleAnnotationBusinessObjectLinkService({
    businessObject,
    annotationId,
  });
  dispatch(triggerRelsBusinessObjectAnnotationUpdate());
  // linking may have lifted an exclusion on the object row
  if (result === "linked") dispatch(triggerBusinessObjectsUpdate());
  dispatch(
    setToaster(
      result === "skipped"
        ? {
            message:
              "Cette annotation délimite déjà un autre objet de la liste",
            severity: "warning",
          }
        : result === "linked"
          ? {
              message: `Annotation liée à "${businessObject.label}"`,
              severity: "success",
            }
          : {
              message: `Annotation déliée de "${businessObject.label}"`,
              severity: "info",
            }
    )
  );
}
