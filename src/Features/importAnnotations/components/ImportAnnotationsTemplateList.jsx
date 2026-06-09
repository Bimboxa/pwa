import { Box, List, ListItem, ListItemText, Typography } from "@mui/material";

// Color swatch + label + type for each imported template. Uses fillColor for
// surfaces, strokeColor otherwise.
function swatchColor(tpl) {
  return tpl.fillColor || tpl.strokeColor || "#bdbdbd";
}

export default function ImportAnnotationsTemplateList({ templates }) {
  if (!templates?.length) return null;

  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        Templates ({templates.length})
      </Typography>
      <List dense disablePadding>
        {templates.map((tpl) => (
          <ListItem key={tpl.id} disableGutters>
            <Box
              sx={{
                width: 16,
                height: 16,
                borderRadius: 0.5,
                mr: 1,
                bgcolor: swatchColor(tpl),
                border: "1px solid",
                borderColor: "divider",
                flexShrink: 0,
              }}
            />
            <ListItemText
              primary={tpl.label ?? tpl.type}
              secondary={tpl.type}
              primaryTypographyProps={{ variant: "body2" }}
              secondaryTypographyProps={{ variant: "caption" }}
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );
}
