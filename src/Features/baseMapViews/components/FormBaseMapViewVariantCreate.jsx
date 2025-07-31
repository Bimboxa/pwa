import FormGenericV2 from "Features/form/components/FormGenericV2";

import BaseMapView from "../js/BaseMapView";

export default function FormBaseMapViewVariantCreate({
  baseMapView,
  onChange,
  baseMaps,
}) {
  // template

  const template = {
    fields: [
      {
        key: "name",
        type: "text",
        label: "Nom",
      },
      {
        key: "baseMap",
        type: "baseMap",
        baseMaps,
      },
    ],
  };

  // helpers

  const item = {
    name: baseMapView.name,
    baseMap: { id: baseMapView?.baseMap?.id },
  };

  // handlers

  function handleChange(item) {
    onChange(new BaseMapView(item));
  }

  // render

  return (
    <FormGenericV2 template={template} onChange={handleChange} item={item} />
  );
}
