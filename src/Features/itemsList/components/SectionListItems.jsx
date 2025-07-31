import useIsMobile from "Features/layout/hooks/useIsMobile";
import { List, ListItem, ListItemText, ListItemButton } from "@mui/material";

export default function SectionListItems({ items, onClick, selection }) {
  // data

  const isMobile = useIsMobile();

  console.log("[ListItems] items", items);

  return (
    <List>
      {items?.map((item) => {
        return (
          <ListItem key={item.id ?? item.key} disablePadding dense={!isMobile}>
            <ListItemButton
              divider
              selected={selection?.includes(item.id)}
              onClick={() => onClick(item)}
              sx={{ ...(item.isNew && { borderLeft: "1px solid black" }) }}
            >
              <ListItemText
                primary={item.primaryText}
                secondary={item.secondaryText}
              />
            </ListItemButton>
          </ListItem>
        );
      })}
    </List>
  );
}
