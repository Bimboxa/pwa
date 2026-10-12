import { useDispatch } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";

import useUpdateBusinessObject from "./useUpdateBusinessObject";

import {
  addLinkedTemplateIds,
  removeLinkedTemplateId,
} from "../utils/linkedTemplateIds";

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

  async function unlinkTemplate({ businessObject, annotationTemplateId }) {
    if (!businessObject?.id || !annotationTemplateId) return;
    try {
      await updateBusinessObject(businessObject.id, {
        linkedTemplateIds: removeLinkedTemplateId(
          businessObject,
          annotationTemplateId
        ),
      });
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
