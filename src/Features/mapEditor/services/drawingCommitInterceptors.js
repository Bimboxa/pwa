import findDetailBaseMap from "Features/baseMaps/services/findDetailBaseMap";
import DialogCreateDetailBaseMapOnCommit from "Features/baseMaps/components/DialogCreateDetailBaseMapOnCommit";

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
//   { projectId, createdBy, dispatch }. Async on purpose: Dexie queries are
//   allowed.
// - DialogComponent: rendered by DeferredCommitDialogOutlet with
//   { pending, onResume, onCancel }; onResume(extraOptions) resumes the
//   parked commit, onCancel drops it (nothing was written).
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
};

export function getDrawingCommitInterceptor(key) {
  return key ? (registry[key] ?? null) : null;
}
