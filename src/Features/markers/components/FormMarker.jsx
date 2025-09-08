import FormGenericV2 from "Features/form/components/FormGenericV2";

export default function FormMarker({ marker, onChange, spriteImage }) {
  // template

  const template = {
    fields: [
      {
        key: "iconColor",
        label: "Couleur",
        type: "color",
      },
      {
        key: "iconKey",
        label: "Icône",
        type: "icon",
        options: {
          spriteImage,
          iconColor: marker.iconColor,
        },
      },
    ],
  };

  // handler

  function handleItemChange(item) {
    onChange(item);
  }

  // render

  return (
    <FormGenericV2
      template={template}
      item={marker}
      onItemChange={handleItemChange}
    />
  );
}
