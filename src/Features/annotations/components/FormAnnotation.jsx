import useAnnotationTemplate from "../hooks/useAnnotationTemplate";

import FormGenericV2 from "Features/form/components/FormGenericV2";

export default function FormAnnotation({ annotation, onChange }) {
  // data

  const template = useAnnotationTemplate(annotation);

  // helpers - item

  const item = annotation ?? {};

  // handlers

  function handleItemChange(item) {
    onChange(item);
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
