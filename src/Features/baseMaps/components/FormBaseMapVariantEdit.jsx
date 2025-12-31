import FormGenericV2 from "Features/form/components/FormGenericV2";

import BaseMap from "../js/BaseMap";

export default function FormBaseMapVariantCreate({ baseMap, onChange }) {
  // template

  const template = {
    fields: [
      {
        key: "name",
        type: "text",
        label: "Nom",
        options: { showLabel: true, fullWidth: true },
      },
      {
        key: "image",
        type: "image",
        label: "Image",
      },
    ],
  };

  // item

  const item = baseMap ?? {};

  // handlers

  async function handleItemChange(newItem) {
    baseMap = await BaseMap.create(newItem);
    onChange(baseMap);
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
