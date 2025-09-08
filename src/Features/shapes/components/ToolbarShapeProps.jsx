import { useSelector } from "react-redux";
import useShapeInForm from "../hooks/useShapeInForm";
import useUpdateShapeInForm from "../hooks/useUpdateShapeInForm";
import useShapes from "../hooks/useShapes";

import FormVariantToolbar from "Features/form/components/FormVariantToolbar";

export default function ToolbarShapeProps() {
  // data

  const shape = useShapeInForm();
  const updateShapeInForm = useUpdateShapeInForm();
  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);

  const shapes = useShapes({ filterByMapId: baseMapId });

  // helpers

  const options = shapes.map((shape) => shape.label);

  // helper

  const template = {
    fields: [
      { type: "color", key: "color" },
      { type: "number", key: "height", label: "Hauteur (m)", width: 100 },
      {
        type: "text",
        key: "label",
        label: "Libellé",
        width: 150,
        options,
      },
    ],
  };

  // handlers

  function handleItemChange(newItem) {
    console.log(newItem);
    updateShapeInForm(newItem);
  }

  return (
    <FormVariantToolbar
      template={template}
      item={shape}
      onItemChange={handleItemChange}
      gap={1}
      p={1}
    />
  );
}
