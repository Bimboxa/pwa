import { List, ListItemButton, ListItemText, Typography } from "@mui/material";

// Clickable / hoverable list of the diagram sections (concepts, app
// components). Hover previews the highlight, click pins it, clicking the
// pinned item again clears it. `children` of an item are rendered indented
// right below it. `vocabulary` resolves the label / description functions.
export default function ListHighlightable({
  items,
  vocabulary,
  selectedKey,
  onSelect,
  onHover,
}) {
  // handlers

  function handleClick(key) {
    onSelect(key === selectedKey ? null : key);
  }

  // render

  function renderItem(item, depth) {
    const label = item.label(vocabulary);
    return (
      <ListItemButton
        key={item.key}
        selected={item.key === selectedKey}
        onClick={() => handleClick(item.key)}
        onMouseEnter={() => onHover(item.key)}
        onMouseLeave={() => onHover(null)}
        sx={{ pl: 2 + depth * 2, py: depth ? 0.25 : 0.75 }}
      >
        <ListItemText
          primary={
            <Typography
              variant={depth ? "body2" : "body1"}
              sx={{ fontWeight: depth ? 500 : 600 }}
            >
              {label}
            </Typography>
          }
        />
      </ListItemButton>
    );
  }

  return (
    <List dense disablePadding>
      {items.flatMap((item) => [
        renderItem(item, 0),
        ...(item.children ?? []).map((child) => renderItem(child, 1)),
      ])}
    </List>
  );
}
