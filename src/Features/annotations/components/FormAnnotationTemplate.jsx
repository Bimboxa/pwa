import useAnnotationSpriteImage from "../hooks/useAnnotationSpriteImage";

import FormGenericV2 from "Features/form/components/FormGenericV2";

export default function FormAnnotationTemplate({
  annotationTemplate,
  onChange,
}) {
  const spriteImage = useAnnotationSpriteImage();

  // helpers -template

  const template = {
    fields: [
      {
        key: "label",
        label: "Libellé",
        type: "text",
      },
      {
        key: "iconKey",
        label: "Icône",
        type: "icon",
        spriteImage,
      },
      {
        key: "fillColor",
        label: "Couleur",
        type: "color",
      },
      {
        key: "strokeColor",
        label: "Couleur de la ligne",
        type: "color",
      },
      {
        key: "fontSize",
        label: "Taille",
        type: "text",
      },
    ],
  };

  // helpers - item
  const item = { ...annotationTemplate };

  // handlers

  function handleItemChange(item) {
    onChange(item);
  }

  // render
  return (
    <FormGenericV2
      template={template}
      item={item}
      onItemChange={handleItemChange}
    />
  );
}
