import { useDispatch, useSelector } from "react-redux";

import { setSelectedAnnotationTemplateId } from "Features/mapEditor/mapEditorSlice";
import { setTempAnnotationTemplateLabel } from "../annotationsSlice";
import { setNewAnnotation, setEditedAnnotation } from "../annotationsSlice";

import useAnnotationTemplates from "../hooks/useAnnotationTemplates";
import useAnnotationSpriteImage from "../hooks/useAnnotationSpriteImage";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import SelectorAnnotationTemplateVariantList from "./SelectorAnnotationTemplateVariantList";

export default function SectionSelectorAnnotationTemplate() {
  const dispatch = useDispatch();

  // data

  const annotationTemplates = useAnnotationTemplates();
  const spriteImage = useAnnotationSpriteImage();
  const templateId = useSelector(
    (s) => s.mapEditor.selectedAnnotationTemplateId
  );
  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);
  const editedAnnotation = useSelector((s) => s.annotations.editedAnnotation);

  // handlers

  function handleChange(annotationTemplateId) {
    dispatch(setSelectedAnnotationTemplateId(annotationTemplateId));
    const annotationTemplate = annotationTemplates?.find(
      (t) => t.id === annotationTemplateId
    );
    dispatch(
      setNewAnnotation({
        ...newAnnotation,
        annotationTemplateId: annotationTemplateId,
        fillColor: annotationTemplate?.fillColor,
        iconKey: annotationTemplate?.iconKey,
      })
    );
    dispatch(
      setEditedAnnotation({
        ...editedAnnotation,
        annotationTemplateId: annotationTemplateId,
        fillColor: annotationTemplate?.fillColor,
        iconKey: annotationTemplate?.iconKey,
      })
    );
    dispatch(setTempAnnotationTemplateLabel(annotationTemplate?.label));
  }

  // render

  return (
    <BoxFlexVStretch>
      <SelectorAnnotationTemplateVariantList
        selectedAnnotationTemplateId={templateId}
        annotationTemplates={annotationTemplates}
        onChange={handleChange}
        spriteImage={spriteImage}
      />
    </BoxFlexVStretch>
  );
}
