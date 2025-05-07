import useIsMobile from "Features/layout/hooks/useIsMobile";
import {List, ListItem, ListItemText, ListItemButton} from "@mui/material";

export default function SectionListItems({items, onClick, selection}) {
  // data

  const isMobile = useIsMobile();

  return (
    <List>
      {items?.map((item) => {
        return (
          <ListItem key={item.id} disablePadding dense={!isMobile}>
            <ListItemButton
              divider
              selected={selection?.includes(item.id)}
              onClick={() => onClick(item)}
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
