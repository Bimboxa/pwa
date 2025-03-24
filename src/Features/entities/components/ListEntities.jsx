import {List} from "@mui/material";

import ListItemEntityVariantDefault from "./ListItemEntityVariantDefault";

export default function ListEntities({entities, onClick, selection}) {
  // handlers

  function handleEntityClick(entity) {
    if (onClick) onClick(entity);
  }

  return (
    <List>
      {entities?.map((entity) => (
        <ListItemEntityVariantDefault
          key={entity.id}
          entity={entity}
          onClick={handleEntityClick}
          selection={selection}
        />
      ))}
    </List>
  );
}
