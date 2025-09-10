import useAnnotationTemplate from "../hooks/useAnnotationTemplate";

import FormGenericV2 from "Features/form/components/FormGenericV2";
import getAnnotationTemplateIdFromAnnotation from "../utils/getAnnotationTemplateIdFromAnnotation";
import getNewAnnotationFromFormItem from "../utils/getNewAnnotationFromFormItem";
import getFormItemFromAnnotation from "../utils/getFormItemFromAnnotation";

export default function FormAnnotation({ annotation, onChange }) {
  // data

  const template = useAnnotationTemplate(annotation);

  // helpers - annotationTemplates

  const field = template.fields.find(
    ({ key }) => key === "annotationTemplateId"
  );
  const annotationTemplates = field?.options?.annotationTemplates;

  // helpers - item

  const item = getFormItemFromAnnotation(annotation);

  console.log("debug_0910 item", item);

  // handlers

  function handleItemChange(newItem) {
    const newAnnotation = getNewAnnotationFromFormItem({
      oldAnnotation: annotation,
      newItem,
      annotationTemplates,
    });

    onChange(newAnnotation);
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
