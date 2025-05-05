import useIsMobile from "Features/layout/hooks/useIsMobile";

import {List} from "@mui/material";

import ListItemEntityVariantDefault from "./ListItemEntityVariantDefault";

export default function ListEntities({entities, onClick, selection}) {
  // data

  const isMobile = useIsMobile();

  // handlers

  function handleEntityClick(entity) {
    if (onClick) onClick(entity);
  }

  return (
    <List dense={!isMobile} disablePadding>
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
