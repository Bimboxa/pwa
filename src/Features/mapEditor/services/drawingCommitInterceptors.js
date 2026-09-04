import findDetailBaseMap from "Features/baseMaps/services/findDetailBaseMap";
import DialogCreateDetailBaseMapOnCommit from "Features/baseMaps/components/DialogCreateDetailBaseMapOnCommit";

import db from "App/db/db";
import { setNewAnnotation } from "Features/annotations/annotationsSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";
import { setToaster } from "Features/layout/layoutSlice";
import { triggerRelsBusinessObjectAnnotationUpdate } from "Features/businessObjects/businessObjectsSlice";
import { LOCATE_BUSINESS_OBJECT_INTERCEPTOR_KEY } from "Features/businessObjects/constants/locateBusinessObjectInterceptor";
import setMainAnnotationForBusinessObjectService from "Features/businessObjects/services/setMainAnnotationForBusinessObjectService";

// ---------------------------------------------------------------------------
// drawingCommitInterceptors — declarative registry for the deferred drawing
// commit mechanism (useDeferredDrawingCommit): a drawing flow armed with
// newAnnotation.commitInterceptor = { key, context } gets its commit routed
// through registry[key] instead of being written directly.
//
// Entry contract:
// - intercept: async ({ points, options, newAnnotation, context, deps }) =>
//     { proceed: { extraOptions } }  → commit now, extraOptions merged over
//                                      the commit options (newAnnotation
//                                      override rides the existing
//                                      options.newAnnotation channel of
//                                      useHandleCommitDrawing);
//     { openDialog: true }           → park the commit and open the entry's
//                                      DialogComponent.
//   newAnnotation is already stripped of commitInterceptor; deps =
//   { projectId, createdBy, dispatch, deleteAnnotations }. Async on purpose:
//   Dexie queries are allowed.
// - DialogComponent: rendered by DeferredCommitDialogOutlet with
//   { pending, onResume, onCancel }; onResume(extraOptions) resumes the
//   parked commit, onCancel drops it (nothing was written).
// - afterCommit (optional): async ({ result, newAnnotation, context, deps })
//   run once the commit was written (direct or resumed); result =
//   { annotation, updatedAnnotation } from useHandleCommitDrawing.
// ---------------------------------------------------------------------------

const registry = {
  // "Ajouter au fond de plan" from the resources PDF viewer (BASE_MAPS
  // module): a DETAIL placement click links the annotation to the detail
  // baseMap of the armed PDF page. Page already materialized → direct commit;
  // first placement → dialog to name the detail baseMap + set its detailRef.
  PDF_PAGE_DETAIL: {
    intercept: async ({ newAnnotation, context, deps }) => {
      const existing = await findDetailBaseMap({
        resourceId: context?.resourceId,
        pageNumber: context?.pageNumber,
        projectId: deps?.projectId,
      });
      if (existing) {
        return {
          proceed: {
            extraOptions: {
              newAnnotation: { ...newAnnotation, detailBaseMapId: existing.id },
            },
          },
        };
      }
      return { openDialog: true };
    },
    DialogComponent: DialogCreateDetailBaseMapOnCommit,
  },

  // "Localiser" an object (BUSINESS_OBJECTS module): the drawn annotation
  // becomes the object's MAIN annotation on its base map (rel isMain). The
  // previous main annotation of the object on that base map is deleted, and
  // the tool disarms (one-shot placement): a second click would otherwise
  // create a second main annotation.
  [LOCATE_BUSINESS_OBJECT_INTERCEPTOR_KEY]: {
    intercept: async () => ({ proceed: {} }),
    afterCommit: async ({ result, newAnnotation, context, deps }) => {
      const { dispatch, deleteAnnotations } = deps ?? {};
      const annotation = result?.annotation;
      if (!annotation?.id || !context?.businessObjectId) return;

      const businessObject = await db.businessObjects.get(
        context.businessObjectId
      );
      if (!businessObject || businessObject.deletedAt) return;

      try {
        const { replacedMainAnnotationIds } =
          (await setMainAnnotationForBusinessObjectService({
            businessObject,
            annotation,
          })) ?? {};
        if (replacedMainAnnotationIds?.length && deleteAnnotations) {
          await deleteAnnotations(replacedMainAnnotationIds);
        }
        // Row label = object label (best effort; the displayed label is
        // derived at read time from the main rel anyway).
        if (businessObject.label && annotation.label !== businessObject.label) {
          await db.annotations.update(annotation.id, {
            label: businessObject.label,
          });
        }
        dispatch?.(triggerRelsBusinessObjectAnnotationUpdate());
        dispatch?.(
          setToaster({ message: `Ouvrage "${businessObject.label}" localisé` })
        );
      } catch (e) {
        console.error("[drawingCommitInterceptors] LOCATE_BUSINESS_OBJECT", e);
        dispatch?.(
          setToaster({
            message: "Impossible de localiser l'ouvrage.",
            isError: true,
          })
        );
      } finally {
        // one-shot: disarm the tool and drop the interceptor from the draft
        dispatch?.(setEnabledDrawingMode(null));
        dispatch?.(setNewAnnotation(newAnnotation));
      }
    },
  },
};

export function getDrawingCommitInterceptor(key) {
  return key ? (registry[key] ?? null) : null;
}
