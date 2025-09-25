import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Box, Typography } from "@mui/material";

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

  const selection = presetScopeKey ? [presetScopeKey] : [];

  // helper - presetScope

  const presetScope = presetScopeKey
    ? appConfig?.presetScopesObject?.[presetScopeKey]
    : null;

  // handlers

  function handleClick(selection) {
    onChange(selection?.[0]);
  }

  // return

  return (
    <Box sx={{ width: 1 }}>
      <SelectorVariantChips
        options={items}
        selection={selection}
        onChange={handleClick}
      />
      <Typography sx={{ mt: 1 }} variant="body2" color="text.secondary">
        {presetScope?.description}
      </Typography>
    </Box>
  );
}
