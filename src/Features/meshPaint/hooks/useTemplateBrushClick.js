import { useCallback } from "react";
import { useDispatch, useStore } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";

import useChangeAnnotationTemplate from "Features/annotations/hooks/useChangeAnnotationTemplate";
import useCloneAnnotationAndEntity from "Features/mapEditor/hooks/useCloneAnnotationAndEntity";

import getAnnotationTemplateProps from "Features/annotations/utils/getAnnotationTemplateProps";
import getAnnotationTypeOnTemplateChange from "Features/annotations/utils/getAnnotationTypeOnTemplateChange";
import getEffectiveAnnotationType from "Features/annotations/utils/getEffectiveAnnotationType";
import { resolveDrawingShape } from "Features/annotations/constants/drawingShapeConfig";
import getTemplateBrushRefusal, {
  TEMPLATE_BRUSH_REFUSAL,
  getTemplateBrushRefusalLabel,
} from "../utils/getTemplateBrushRefusal";

import db from "App/db/db";

// « Pinceau » armed in the 2D editor (template brush): the action of a click
// on an annotation. Wired by MainMapEditorV3 into InteractionLayer's
// `onTemplateBrushClick` (MESH_BRUSH branch of handleWorldClick).
//
//   - convert (default): the annotation switches to the armed template —
//     useChangeAnnotationTemplate (diff-only patch, type kept within the
//     geometry family: a STRIP stays a STRIP under a Ligne template);
//   - duplicate (mapEditor.templateBrushDuplicateTarget, switch « Dupliquer
//     l'annotation cible », hotkey D): the annotation keeps its template and
//     a copy carrying the armed template is created — same path as the
//     « Dupliquer » menu (useCloneAnnotationAndEntity with an explicit
//     `newAnnotation` built from the template, independent points).
//
// Rules (getTemplateBrushRefusal, toaster on refusal): never the annotation's
// own template (a duplicate would be undetectable; a convert is a no-op),
// only POLYGON / POLYLINE / STRIP rows, read-only pseudo rows ignored.
//
// The armed template is read at click time from the draft
// (s.annotations.newAnnotation.annotationTemplateId) and Dexie: there is no
// Redux store of the templates. `annotation` is the RESOLVED row of the
// editor (pixel points): what both write paths expect — never written back
// as is.
export default function useTemplateBrushClick() {
  const dispatch = useDispatch();
  const store = useStore();
  const changeAnnotationTemplate = useChangeAnnotationTemplate();
  const cloneAnnotationAndEntity = useCloneAnnotationAndEntity();

  return useCallback(
    async (annotation) => {
      const s = store.getState();
      const templateId = s.annotations.newAnnotation?.annotationTemplateId;
      const duplicate = Boolean(s.mapEditor.templateBrushDuplicateTarget);

      const template = templateId
        ? await db.annotationTemplates.get(templateId)
        : null;
      const templateShape = resolveDrawingShape(template);
      const annotationType = getEffectiveAnnotationType(annotation);

      const refusal = getTemplateBrushRefusal({
        annotation,
        annotationType,
        templateId: template?.id ?? null,
        templateShape,
      });
      if (refusal) {
        // A read-only pseudo row is not a target: no feedback.
        if (refusal !== TEMPLATE_BRUSH_REFUSAL.READ_ONLY) {
          dispatch(
            setToaster({
              message: getTemplateBrushRefusalLabel(refusal),
              severity: "warning",
            })
          );
        }
        return null;
      }

      try {
        if (!duplicate) {
          await changeAnnotationTemplate(annotation, template);
          return annotation.id;
        }

        // Explicit draft, like CloneAnnotationFlow: the store draft of the
        // armed brush carries shape defaults / drawingShape / toolbar edits
        // that must not land on the copy. The template-owned visibility
        // flags are re-derived at read time.
        const newAnnotation = {
          ...getAnnotationTemplateProps(template),
          annotationTemplateId: template.id,
          label: template.label,
          listingId: template.listingId,
          type:
            getAnnotationTypeOnTemplateChange(annotation, template) ??
            annotationType,
        };
        delete newAnnotation.hidden;
        delete newAnnotation.hiddenInLegend;

        const created = await cloneAnnotationAndEntity(annotation, {
          newAnnotation,
          keepOriginalPoints: false,
        });
        return created?.id ?? created?.[0]?.id ?? null;
      } catch (err) {
        console.warn("[templateBrush] click failed", err);
        dispatch(
          setToaster({
            message:
              err?.userMessage ??
              err?.message ??
              "Le pinceau n'a pas pu modifier l'annotation",
            severity: "error",
          })
        );
        return null;
      }
    },
    [store, dispatch, changeAnnotationTemplate, cloneAnnotationAndEntity]
  );
}
