import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import FormGenericV2 from "Features/form/components/FormGenericV2";

export default function FormScope({ scope, onChange }) {
  // data

  const appConfig = useAppConfig();

  // helpers

  const presetScopesObject = appConfig?.presetScopesObject ?? {};
  const configOptions = Object.values(presetScopesObject).map((scope) => {
    return {
      key: scope.key,
      label: scope.name,
    };
  });

  // const

  const template = {
    fields: [
      {
        key: "name",
        label: "Nom",
        type: "text",
        options: {
          fullWidth: true,
          showLabel: true,
        },
      },
      // {
      //   key: "clientRef",
      //   label: "Réf.",
      //   type: "text",
      // },
      {
        key: "presetConfig",
        label: appConfig?.strings?.presetConfig?.title,
        type: "optionKey",
        valueOptions: configOptions,
        options: {
          showAsSection: true,
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
      item={scope}
      onItemChange={handleItemChange}
    />
  );
}
