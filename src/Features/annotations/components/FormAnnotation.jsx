import { useDispatch, useSelector } from "react-redux";

import { setTempAnnotationTemplateLabel } from "../annotationsSlice";

import useAnnotationTemplate from "../hooks/useAnnotationTemplate";
import useAnnotationTemplatesByProject from "../hooks/useAnnotationTemplatesByProject";

import FormGenericV2 from "Features/form/components/FormGenericV2";
import getAnnotationTemplateIdFromAnnotation from "../utils/getAnnotationTemplateIdFromAnnotation";
import getNewAnnotationFromFormItem from "../utils/getNewAnnotationFromFormItem";
import getFormItemFromAnnotation from "../utils/getFormItemFromAnnotation";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useAnnotationTemplates from "../hooks/useAnnotationTemplates";

export default function FormAnnotation({ annotation, onChange }) {
  const dispatch = useDispatch();

  // data

  const template = useAnnotationTemplate(annotation, {
    annotationType: annotation?.type,
  });
  const { value: listing } = useSelectedListing();

  const annotationTemplates = useAnnotationTemplatesByProject();

  // helpers - item

  const item = getFormItemFromAnnotation({
    annotation,
    annotationTemplates,
    listing,
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

    let label = "";
    if (!newAnnotation?.annotationTemplateId) label = newItem.legendLabel;
    if (
      newAnnotation.annotationTemplateId &&
      newItem.legendLabel !== template?.label
    )
      label = newItem.legendLabel;
    dispatch(setTempAnnotationTemplateLabel(label));
  }
  // return

  return (
    <FormGenericV2
      template={template}
      item={item}
      onItemChange={handleItemChange}
    />
  );
}
