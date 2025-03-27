import {List} from "@mui/material";

import ListItemEntityWithProps from "./ListItemEntityWithProps";

export default function ListEntitiesWithProps({items, onClick, selection}) {
  selection = selection || [];

  // handlers

  function handleClick(item) {
    onClick(item);
  }

  return (
    <List dense>
      {items?.map((item) => {
        const selected = selection.includes(item.id);
        return (
          <ListItemEntityWithProps
            key={item.id}
            entityWithProps={item}
            selected={selected}
            onClick={handleClick}
          />
        );
      })}
    </List>
  );
}
