import FormGeneric from "Features/form/components/FormGeneric";

export default function FormScope({scope, onChange}) {
  // const

  const template = {
    fields: [
      {
        key: "name",
        label: "Nom",
        type: "text",
      },
      {
        key: "clientRef",
        label: "Réf.",
        type: "text",
      },
    ],
  };

  // handlers

  function handleItemChange(item) {
    onChange(item);
  }

  return (
    <FormGeneric
      template={template}
      item={scope}
      onItemChange={handleItemChange}
      forceVariantGrid={true}
    />
  );
}
