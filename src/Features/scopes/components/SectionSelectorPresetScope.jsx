import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Box } from "@mui/material";

import SelectorVariantChips from "Features/layout/components/SelectorVariantChips";

export default function SectionSelectorPresetScope({
  presetScopeKey,
  onChange,
}) {
  // data

  const appConfig = useAppConfig();

  // helpers

  const items = appConfig?.presetScopesSortedKeys
    ?.map((key) => appConfig?.presetScopesObject[key])
    ?.map((item) => ({ ...item, label: item?.name }));

  console.log("items", items);

  const selection = presetScopeKey ? [presetScopeKey] : [];

  // handlers

  function handleClick(selection) {
    onChange(selection?.[0]);
  }

  // return

  return (
    <SelectorVariantChips
      options={items}
      selection={selection}
      onChange={handleClick}
    />
  );
}
