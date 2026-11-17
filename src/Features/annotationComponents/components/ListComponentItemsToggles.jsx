import { Box, Checkbox, Typography } from "@mui/material";

import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";

// Rows of the items of a component (see hooks/useComponentItems): a checkbox,
// the icon and the label of the template each item generates. Shared by the
// drawing helper and the edit toolbar.
export default function ListComponentItemsToggles({
  items,
  onToggle,
  disabled = false,
}) {
  // render

  return (
    <Box sx={{ display: "flex", flexDirection: "column" }}>
      {items.map((item) => (
        <Box
          key={item.annotationTemplateId}
          component="label"
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            cursor: disabled ? "default" : "pointer",
            minWidth: 0,
          }}
        >
          <Checkbox
            size="small"
            checked={item.enabled}
            disabled={disabled}
            onChange={(e) =>
              onToggle(item.annotationTemplateId, e.target.checked)
            }
            sx={{ p: 0.25 }}
          />
          <AnnotationTemplateIcon template={item.template} size={16} />
          <Typography
            variant="body2"
            noWrap
            sx={{
              fontSize: 12,
              minWidth: 0,
              color: item.enabled ? "text.primary" : "text.disabled",
            }}
          >
            {item.template.label}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
