import useAnnotationSpriteImage from "../hooks/useAnnotationSpriteImage";

import {
  LocationPin as Marker,
  Polyline,
  Pentagon,
  Rectangle,
  HorizontalRule,
} from "@mui/icons-material";
import FormGenericV2 from "Features/form/components/FormGenericV2";

export default function FormAnnotationTemplate({
  annotationTemplate,
  onChange,
}) {
  const spriteImage = useAnnotationSpriteImage();

  const annotationTypes = [
    { key: "MARKER", icon: <Marker /> },
    { key: "POLYLINE", icon: <Polyline /> },
    { key: "POLYGON", icon: <Pentagon /> },
    { key: "RECTANGLE", icon: <Rectangle /> },
  ];

  // helpers -template

  const template = {
    fields: [
      {
        key: "type",
        type: "optionKeyFromIcons",
        valueOptions: annotationTypes,
      },
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
