import {useState} from "react";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import {Box} from "@mui/material";
import FormGeneric from "Features/form/components/FormGeneric";

export default function PanelSelectScopePreset() {
  // data

  const appConfig = useAppConfig();

  // state

  const [presetConfig, setPresetConfig] = useState(null);

  // helpers

  const presetScopesObject = appConfig?.presetScopesObject ?? {};
  const configOptions = Object.values(presetScopesObject).map((scope) => {
    return {
      key: scope.key,
      label: scope.name,
    };
  });

  // helper - item

  const item = {presetConfig};

  // const

  const template = {
    fields: [
      {
        key: "presetConfig",
        label: appConfig?.strings?.presetConfig?.title,
        type: "option",
        valueOptions: configOptions,
      },
    ],
  };

  // handlers

  function handleItemChange(item) {
    setPresetConfig(item?.presetConfig);
  }

  return (
    <Box sx={{bgcolor: "white"}}>
      <FormGeneric
        template={template}
        item={item}
        onItemChange={handleItemChange}
      />
    </Box>
  );
}
