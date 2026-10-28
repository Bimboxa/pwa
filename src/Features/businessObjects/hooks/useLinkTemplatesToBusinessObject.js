import { useDispatch } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";

import useUpdateBusinessObject from "./useUpdateBusinessObject";

import {
  addLinkedTemplateIds,
  removeLinkedTemplateId,
} from "../utils/linkedTemplateIds";
import {
  getExcludedAnnotationIds,
  removeExcludedAnnotationIds,
} from "../utils/excludedAnnotationIds";

// "Lien par modèle": links / unlinks a business object to whole annotation
// templates (businessObject.linkedTemplateIds, see utils/linkedTemplateIds).
// Writes through useUpdateBusinessObject (which triggers the business
// objects update: the rollups re-read the objects) and toasts the result.
export default function useLinkTemplatesToBusinessObject() {
  const dispatch = useDispatch();

  // data

  const updateBusinessObject = useUpdateBusinessObject();

  // main

  // labelById (optional): template labels, for the toaster
  async function linkTemplates({
    businessObject,
    annotationTemplateIds,
    labelById,
  }) {
    const ids = (annotationTemplateIds ?? []).filter(Boolean);
    if (!businessObject?.id || ids.length === 0) return;
    const next = addLinkedTemplateIds(businessObject, ids);
    try {
      await updateBusinessObject(businessObject.id, {
        linkedTemplateIds: next,
      });
      const message =
        ids.length === 1
          ? `Modèle "${labelById?.[ids[0]] ?? "?"}" lié à "${businessObject.label}"`
          : `${ids.length} modèles liés à "${businessObject.label}"`;
      dispatch(setToaster({ message }));
    } catch (error) {
      console.error("[businessObjects] link templates", error);
      dispatch(
        setToaster({ message: error?.message ?? `${error}`, isError: true })
      );
    }
  }

  // annotationIdsToForget (optional): the template's annotation ids, whose
  // exclusions become moot once the template link is gone (dropped from
  // excludedAnnotationIds in the same write)
  async function unlinkTemplate({
    businessObject,
    annotationTemplateId,
    annotationIdsToForget,
  }) {
    if (!businessObject?.id || !annotationTemplateId) return;
    try {
      const updates = {
        linkedTemplateIds: removeLinkedTemplateId(
          businessObject,
          annotationTemplateId
        ),
      };
      const forget = new Set(annotationIdsToForget ?? []);
      if (
        forget.size > 0 &&
        getExcludedAnnotationIds(businessObject).some((id) => forget.has(id))
      ) {
        updates.excludedAnnotationIds = removeExcludedAnnotationIds(
          businessObject,
          [...forget]
        );
      }
      await updateBusinessObject(businessObject.id, updates);
      dispatch(
        setToaster({
          message: `Lien par modèle retiré de "${businessObject.label}"`,
        })
      );
    } catch (error) {
      console.error("[businessObjects] unlink template", error);
      dispatch(
        setToaster({ message: error?.message ?? `${error}`, isError: true })
      );
    }
  }

  return { linkTemplates, unlinkTemplate };
}
