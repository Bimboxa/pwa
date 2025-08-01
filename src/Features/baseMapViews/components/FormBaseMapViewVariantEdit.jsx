import FormGenericV2 from "Features/form/components/FormGenericV2";

import BaseMapView from "../js/BaseMapView";

export default function FormBaseMapViewVariantEdit({
  baseMapView,
  onChange,
  baseMaps,
  createContainerEl,
}) {
  // debug

  console.log("debug_0108 baseMapView", baseMapView);

  // template

  const template = {
    fields: [
      {
        key: "name",
        type: "text",
        label: "Nom",
        options: { fullWidth: true, showLabel: true },
      },
      {
        key: "baseMap",
        type: "baseMap",
        label: "Fond de plan",
        baseMaps,
      },
    ],
  };

  // helpers

  const item = {
    name: baseMapView?.name,
    baseMap: { id: baseMapView?.baseMap?.id },
  };

  console.log("[FormBaseMapViewVariantCreate] item", item);

  // handlers

  function handleChange(item) {
    // onChange(new BaseMapView(item));
    onChange({ ...item, id: baseMapView.id });
  }

  // render

  return (
    <FormGenericV2
      template={template}
      onItemChange={handleChange}
      item={item}
      createContainerEl={createContainerEl}
    />
  );
}
