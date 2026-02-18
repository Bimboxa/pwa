import { useState } from "react";

import useAnnotationSpriteImage from "../hooks/useAnnotationSpriteImage";
import {
  Box,
  TextField,
  Typography,
  List,
  ListItemButton,
  Divider,
} from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SearchBar from "Features/search/components/SearchBar";
import AnnotationIcon from "Features/annotations/components/AnnotationIcon";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import BoxAlignToRight from "Features/layout/components/BoxAlignToRight";

import getFoundItems from "Features/search/getFoundItems";


export default function SectionSelectAnnotationTemplates({
  annotationTemplates,
  selection,
  onChange,
}) {
  // data

  const spriteImage = useAnnotationSpriteImage();

  // state

  const [search, setSearch] = useState("");

  // found items

  const foundItems = getFoundItems({
    items: annotationTemplates,
    searchText: search,
    searchKeys: ["label", "group"],
  });

  // handlers

  function handleChangeSearch(e) {
    setSearch(e);
  }

  function handleChangeSelection(item) {
    if (selection.includes(item.id)) {
      onChange((selection ?? []).filter((s) => s !== item.id));
    } else {
      onChange([...(selection ?? []), item.id]);
    }
  }

  function handleSelectAll() {
    onChange(foundItems.map(item => item.id))
  }

  // return

  return (
    <BoxFlexVStretch sx={{ width: 1 }}>
      <Box sx={{ p: 1, width: 1 }}>
        <SearchBar value={search} onChange={handleChangeSearch} />
      </Box>

      <BoxAlignToRight>
        <ButtonGeneric label="Tout sélectionner" onClick={handleSelectAll} />
      </BoxAlignToRight>

      <BoxFlexVStretch sx={{ overflow: "auto" }}>
        <List>
          {foundItems?.map((item, idx) => {
            if (item.isGroup) {
              return (
                <ListItemButton key={item.label} >
                  <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                    {item.label}
                  </Typography>
                </ListItemButton>
              );
            }
            return (
              <ListItemButton
                key={item.label}
                onClick={() => handleChangeSelection(item)}
                selected={selection?.includes(item.id)}
                divider
              >
                <AnnotationIcon spriteImage={spriteImage} annotation={item} />
                <Typography variant="body2" sx={{ ml: 1 }}>
                  {item.label}
                </Typography>
              </ListItemButton>
            );
          })}
        </List>
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
