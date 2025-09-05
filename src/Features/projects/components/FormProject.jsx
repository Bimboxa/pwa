import FormGenericV2 from "Features/form/components/FormGenericV2";

import useIsMobile from "Features/layout/hooks/useIsMobile";

export default function FormProject({ project, onChange }) {
  // const

  const template = {
    fields: [
      {
        key: "name",
        label: "Nom",
        type: "text",
        options: {
          showLabel: true,
          fullWidth: true,
        },
      },
      {
        key: "clientRef",
        label: "Réf.",
        type: "text",
        options: {
          showLabel: true,
          fullWidth: true,
        },
      },
    ],
  };

  // handlers

  function handleItemChange(item) {
    onChange(item);
  }

  return (
    <FormGenericV2
      template={template}
      item={project}
      onItemChange={handleItemChange}
    />
  );
}
