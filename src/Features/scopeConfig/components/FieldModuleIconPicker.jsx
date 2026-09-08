import { Box, ToggleButton, Tooltip } from "@mui/material";

import moduleIconsMap, {
  MODULE_ICON_KEYS,
} from "Features/viewers/data/moduleIconsMap";

// Grid of the curated module icons (viewers/data/moduleIconsMap.js). `value`
// is the per-scope override (null = the type's default icon, displayed as
// selected); picking the default icon again clears the override.
export default function FieldModuleIconPicker({
  value,
  defaultIconKey,
  onChange,
}) {
  // helpers

  const effectiveKey = value ?? defaultIconKey;

  // handlers

  function handleClick(iconKey) {
    if (iconKey === effectiveKey) return;
    onChange?.(iconKey === defaultIconKey ? null : iconKey);
  }

  // render

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(8, 1fr)",
        gap: 0.5,
      }}
    >
      {MODULE_ICON_KEYS.map((iconKey) => {
        const Icon = moduleIconsMap.get(iconKey);
        const selected = iconKey === effectiveKey;
        const isDefault = iconKey === defaultIconKey;
        return (
          <Tooltip
            key={iconKey}
            title={isDefault ? `${iconKey} (par défaut)` : iconKey}
          >
            <ToggleButton
              value={iconKey}
              selected={selected}
              size="small"
              onClick={() => handleClick(iconKey)}
              sx={{ p: 0.75, minWidth: 0 }}
            >
              <Icon fontSize="small" />
            </ToggleButton>
          </Tooltip>
        );
      })}
    </Box>
  );
}
