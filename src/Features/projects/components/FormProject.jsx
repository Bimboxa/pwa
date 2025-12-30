import FormGenericV2 from "Features/form/components/FormGenericV2";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

export default function FormProject({ project, onChange }) {
  // data

  const appConfig = useAppConfig();

  // helpers

  const nameS = appConfig?.strings?.project.name ?? "Nom";
  const clientRefS = appConfig?.strings?.project.clientRef ?? "Numéro";

  // const

  const template = {
    fields: [
      {
        key: "name",
        label: nameS,
        type: "text",
        options: {
          showLabel: true,
          fullWidth: true,

        },
      },
      {
        key: "clientRef",
        label: clientRefS,
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
