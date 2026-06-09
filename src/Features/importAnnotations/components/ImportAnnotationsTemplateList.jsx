import {
  Box,
  List,
  ListItem,
  ListItemText,
  Switch,
  Typography,
} from "@mui/material";

// Color swatch + label + type for each imported template, with a switch to
// include/exclude it (and its annotations) from the import.
function swatchColor(tpl) {
  return tpl.fillColor || tpl.strokeColor || "#bdbdbd";
}

export default function ImportAnnotationsTemplateList({
  templates,
  excludedTemplateIds,
  onToggle,
}) {
  if (!templates?.length) return null;

  const excluded = new Set(excludedTemplateIds ?? []);
  const includedCount = templates.filter((t) => !excluded.has(t.id)).length;

  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        Templates ({includedCount}/{templates.length})
      </Typography>
      <List dense disablePadding>
        {templates.map((tpl) => {
          const isIncluded = !excluded.has(tpl.id);
          return (
            <ListItem
              key={tpl.id}
              disableGutters
              secondaryAction={
                <Switch
                  edge="end"
                  size="small"
                  checked={isIncluded}
                  onChange={() => onToggle?.(tpl.id)}
                />
              }
            >
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
                  opacity: isIncluded ? 1 : 0.35,
                }}
              />
              <ListItemText
                primary={tpl.label ?? tpl.type}
                secondary={tpl.type}
                primaryTypographyProps={{ variant: "body2" }}
                secondaryTypographyProps={{ variant: "caption" }}
                sx={{ opacity: isIncluded ? 1 : 0.5 }}
              />
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
}
