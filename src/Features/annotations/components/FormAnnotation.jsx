import { useDispatch, useSelector } from "react-redux";

import { setTempAnnotationTemplateLabel } from "../annotationsSlice";

import useAnnotationFormTemplate from "../hooks/useAnnotationFormTemplate";
import useAnnotationTemplatesByProject from "../hooks/useAnnotationTemplatesByProject";

import FormGenericV2 from "Features/form/components/FormGenericV2";
import getAnnotationTemplateIdFromAnnotation from "../utils/getAnnotationTemplateIdFromAnnotation";
import getNewAnnotationFromFormItem from "../utils/getNewAnnotationFromFormItem";
import getFormItemFromAnnotation from "../utils/getFormItemFromAnnotation";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useAnnotationTemplates from "../hooks/useAnnotationTemplates";
import { setSelectedAnnotationTemplateId } from "Features/mapEditor/mapEditorSlice";

export default function FormAnnotation({ annotation, onChange }) {
  const dispatch = useDispatch();

  // data

  const formTemplate = useAnnotationFormTemplate(annotation, {
    annotationType: annotation?.type,
  });
  const { value: listing } = useSelectedListing();

  const annotationTemplates = useAnnotationTemplatesByProject();
  const tempAnnotationTemplateLabel = useSelector(
    (s) => s.annotations.tempAnnotationTemplateLabel
  );

  // helpers - item

  const item = getFormItemFromAnnotation({
    annotation,
    annotationTemplates,
    tempAnnotationTemplateLabel,
  });

  // handlers

  function handleItemChange(newItem) {
    const newAnnotation = getNewAnnotationFromFormItem({
      oldAnnotation: annotation,
      listing,
      newItem,
      annotationTemplates,
    });

    onChange(newAnnotation);

    // update selected annotation template

    dispatch(
      setSelectedAnnotationTemplateId(newAnnotation?.annotationTemplateId)
    );

    // update temp label if needed
    const template = annotationTemplates?.find(
      (t) => t.id === newAnnotation?.annotationTemplateId
    );
    let label = "";

    if (
      annotation.annotationTemplateId &&
      !newAnnotation?.annotationTemplateId
    ) {
      console.log("debug_3009_case1");
      label = "";
    } else if (!newAnnotation?.annotationTemplateId) {
      label = newItem.legendLabel;
    } else if (
      newAnnotation.annotationTemplateId &&
      newItem.legendLabel !== template?.label
    ) {
      label = newItem.legendLabel;
    }
    dispatch(setTempAnnotationTemplateLabel(label));
  }
  // return

  return (
    <FormGenericV2
      template={formTemplate}
      item={item}
      onItemChange={handleItemChange}
    />
  );
}
