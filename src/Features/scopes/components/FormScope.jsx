import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import FormGeneric from "Features/form/components/FormGeneric";

export default function FormScope({scope, onChange}) {
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
      },
      {
        key: "clientRef",
        label: "Réf.",
        type: "text",
      },
      {
        key: "presetConfigKey",
        label: appConfig?.strings?.presetConfig?.title,
        type: "option",
        options: configOptions,
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
    />
  );
}
