import { useState } from "react";

import useIsMobile from "Features/layout/hooks/useIsMobile";

import { List, Box } from "@mui/material";

import ListItemEntityVariantDefault from "./ListItemEntityVariantDefault";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SearchBar from "Features/search/components/SearchBar";

import getFoundItems from "Features/search/getFoundItems";

export default function ListEntities({
  listing,
  entities,
  onClick,
  selection,
  onCreateClick,
}) {
  // state

  const [searchText, setSearchText] = useState("");

  // data

  const isMobile = useIsMobile();

  // helpers

  const filteredEntities = getFoundItems({
    items: entities,
    searchText,
    searchKeys: ["label"],
  });

  const color = listing?.color;

  // handlers

  function handleSearchTextChange(text) {
    console.log("debug_1806 text", text);
    setSearchText(text);
  }
  function handleEntityClick(entity) {
    if (onClick) onClick(entity);
  }

  return (
    <BoxFlexVStretch>
      <Box sx={{ width: 1, p: 1, py: 2 }}>
        <SearchBar
          value={searchText}
          onChange={handleSearchTextChange}
          onCreateClick={onCreateClick}
          color={color}
        />
      </Box>
      <BoxFlexVStretch sx={{ overflow: "auto" }}>
        <List dense={!isMobile} disablePadding sx={{ bgcolor: "white" }}>
          {filteredEntities?.map((entity) => (
            <ListItemEntityVariantDefault
              key={entity.id}
              entity={entity}
              onClick={handleEntityClick}
              selection={selection}
              listingColor={color}
            />
          ))}
        </List>
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
