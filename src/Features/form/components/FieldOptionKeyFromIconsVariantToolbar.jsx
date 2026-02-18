import { useState, useRef } from "react";

import { Menu, MenuItem, Box, Typography, Button } from "@mui/material";
import { ArrowDropDown as Down } from "@mui/icons-material";
import ToggleSingleSelectorGeneric from "Features/layout/components/ToggleSingleSelectorGeneric";
import WhiteSectionGeneric from "./WhiteSectionGeneric";

export default function FieldOptionKeyFromIconsVariantToolbar({
  value,
  label,
  onChange,
  valueOptions,
  options

}) {
  // options

  const showAsSection = options?.showAsSection
  const inline = options?.inline

  // handlers

  function handleChange(optionKey) {
    onChange(optionKey);
  }

  if (showAsSection && !inline) {
    return <WhiteSectionGeneric>

      <Typography variant="body2" sx={{ fontWeight: "bold", mb: 2 }}>
        {label}
      </Typography>
      <ToggleSingleSelectorGeneric
        selectedKey={value}
        options={valueOptions ?? []}
        onChange={handleChange}
      />

    </WhiteSectionGeneric>
  }

  if (showAsSection && inline) {
    return <WhiteSectionGeneric>
      <Box sx={{ display: "flex", alignItems: "center", width: 1, justifyContent: "space-between" }}>
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          {label}
        </Typography>
        <ToggleSingleSelectorGeneric
          selectedKey={value}
          options={valueOptions ?? []}
          onChange={handleChange}
        />
      </Box>

    </WhiteSectionGeneric>
  }

  return (
    <ToggleSingleSelectorGeneric
      selectedKey={value}
      options={valueOptions ?? []}
      onChange={handleChange}
    />
  );
}
