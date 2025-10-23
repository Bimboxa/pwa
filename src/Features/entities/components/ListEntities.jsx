import { useState } from "react";

import useIsMobile from "Features/layout/hooks/useIsMobile";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";

import { List, Box } from "@mui/material";

import ListItemEntityVariantDefault from "./ListItemEntityVariantDefault";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SearchBar from "Features/search/components/SearchBar";
import SectionActions from "./SectionActions";

import getFoundItems from "Features/search/getFoundItems";
import ListItemEntityVariantAnnotationTemplate from "Features/annotations/components/ListItemEntityVariantAnnotationTemplate";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import SectionFilterEntitiesByMainBaseMap from "./SectionFilterEntitiesByMainBaseMap";

export default function ListEntities({
  listing,
  entities,
  onClick,
  onEditClick,
  selection,
  onCreateClick,
}) {
  // state

  const [searchText, setSearchText] = useState("");

  // data

  const isMobile = useIsMobile();
  const annotationTemplates = useAnnotationTemplates();
  const spriteImage = useAnnotationSpriteImage();

  // helpers

  const filteredEntities = getFoundItems({
    items: entities,
    searchText,
    searchKeys: ["label"],
  });

  const color = listing?.color;

  // helper - variant

  let variant = "DEFAULT";

  if (listing?.entityModel?.type === "ANNOTATION_TEMPLATE")
    variant = "ANNOTATION_TEMPLATE";

  // helper - showFilterByMainBaseMap

  const showFilterByMainBaseMap =
    listing?.entityModel?.type === "LOCATED_ENTITY";

  // handlers

  function handleSearchTextChange(text) {
    console.log("debug_1806 text", text);
    setSearchText(text);
  }
  function handleEntityClick(entity) {
    if (onClick) onClick(entity);
  }
  function handleEntityEdit(entity) {
    if (onEditClick) onEditClick(entity);
  }

  return (
    <BoxFlexVStretch>
      <Box sx={{ width: 1, p: 1, pt: 2 }}>
        <SearchBar
          value={searchText}
          onChange={handleSearchTextChange}
          onCreateClick={onCreateClick}
          color={color}
        />
      </Box>
      {/* <SectionActions /> */}
      {showFilterByMainBaseMap && <SectionFilterEntitiesByMainBaseMap />}
      <BoxFlexVStretch sx={{ overflow: "auto" }}>
        <List dense={!isMobile} disablePadding sx={{ bgcolor: "white" }}>
          {filteredEntities?.map((entity) => {
            if (variant === "DEFAULT") {
              return (
                <ListItemEntityVariantDefault
                  key={entity.id}
                  entity={entity}
                  listing={listing}
                  onClick={handleEntityClick}
                  onEditClick={handleEntityEdit}
                  selection={selection}
                  listingColor={color}
                  annotationTemplates={annotationTemplates}
                  spriteImage={spriteImage}
                />
              );
            } else if (variant === "ANNOTATION_TEMPLATE") {
              return (
                <ListItemEntityVariantAnnotationTemplate
                  key={entity.id}
                  entity={entity}
                  onClick={handleEntityClick}
                  selection={selection}
                  listing={listing}
                />
              );
            }
          })}
        </List>
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
