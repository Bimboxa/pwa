import {
  Box,
  Chip,
  List,
  ListItem,
  ListItemText,
  Switch,
  Typography,
} from "@mui/material";

// Color swatch + label + type for each imported template, with a switch to
// include/exclude it (and its annotations) from the import. `reusedIds` marks
// the templates already present in the target project (dump format), which the
// import links to instead of duplicating.
function swatchColor(tpl) {
  return tpl.fillColor || tpl.strokeColor || "#bdbdbd";
}

export default function ImportAnnotationsTemplateList({
  templates,
  excludedTemplateIds,
  reusedIds,
  onToggle,
}) {
  if (!templates?.length) return null;

  const excluded = new Set(excludedTemplateIds ?? []);
  const reused =
    reusedIds instanceof Set ? reusedIds : new Set(reusedIds ?? []);
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
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  {reusedIds && (
                    <Chip
                      size="small"
                      variant="outlined"
                      label={reused.has(tpl.id) ? "existant" : "à créer"}
                      sx={{ height: 18, fontSize: 10 }}
                    />
                  )}
                  <Switch
                    edge="end"
                    size="small"
                    checked={isIncluded}
                    onChange={() => onToggle?.(tpl.id)}
                  />
                </Box>
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
