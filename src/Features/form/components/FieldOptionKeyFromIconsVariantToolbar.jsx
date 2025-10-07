import { useState, useRef } from "react";

import { Menu, MenuItem, Box, Typography, Button } from "@mui/material";
import { ArrowDropDown as Down } from "@mui/icons-material";
import ToggleSingleSelectorGeneric from "Features/layout/components/ToggleSingleSelectorGeneric";

export default function FieldOptionKeyFromIconsVariantToolbar({
  value,
  label,
  onChange,
  valueOptions,
}) {
  const options = valueOptions ?? [];

  // handlers

  function handleChange(optionKey) {
    onChange(optionKey);
  }

  return (
    <ToggleSingleSelectorGeneric
      selectedKey={value}
      options={options}
      onChange={handleChange}
    />
  );
}
