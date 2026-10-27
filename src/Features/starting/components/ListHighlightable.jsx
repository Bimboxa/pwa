import { List, ListItemButton, ListItemText } from "@mui/material";

// Dense clickable / hoverable list of the diagram sections (concepts, app
// components). Hover previews the highlight, click pins it, clicking the
// pinned item again clears it. `children` of an item are rendered indented
// right below it. `vocabulary` resolves the label functions.
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
    return (
      <ListItemButton
        key={item.key}
        selected={item.key === selectedKey}
        onClick={() => handleClick(item.key)}
        onMouseEnter={() => onHover(item.key)}
        onMouseLeave={() => onHover(null)}
        sx={{ pl: 1.5 + depth * 2, pr: 1.5, py: 0.25, minHeight: 28 }}
      >
        <ListItemText
          primary={item.label(vocabulary)}
          slotProps={{
            primary: {
              variant: "body2",
              noWrap: true,
              sx: { fontWeight: depth ? 400 : 600 },
            },
          }}
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
