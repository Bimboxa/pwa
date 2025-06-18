import {useState} from "react";

import useIsMobile from "Features/layout/hooks/useIsMobile";

import {List, Box} from "@mui/material";

import ListItemEntityVariantDefault from "./ListItemEntityVariantDefault";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SearchBar from "Features/search/components/SearchBar";
import getFoundItems from "Features/search/getFoundItems";

export default function ListEntities({entities, onClick, selection}) {
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
      <Box sx={{width: 1, p: 1}}>
        <SearchBar value={searchText} onChange={handleSearchTextChange} />
      </Box>
      <BoxFlexVStretch>
        <List dense={!isMobile} disablePadding>
          {filteredEntities?.map((entity) => (
            <ListItemEntityVariantDefault
              key={entity.id}
              entity={entity}
              onClick={handleEntityClick}
              selection={selection}
            />
          ))}
        </List>
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
