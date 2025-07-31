import { useState, useMemo } from "react";

import { useDispatch } from "react-redux";

import { setSelectedListTypeKey } from "../listPanelSlice";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Box } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import HeaderListPanel from "./HeaderListPanel";
import SearchBar from "Features/search/components/SearchBar";
import ListItemsGenericV2 from "Features/layout/components/ListItemsGenericV2";
import IconButtonClose from "Features/layout/components/IconButtonClose";

import getFoundItems from "Features/search/getFoundItems";

export default function ListPanelGeneric({
  title,
  onClose,
  searchKeys,
  items,
  selection,
  onItemClick,
  onCreateClick,
  componentListItem,
}) {
  const dispatch = useDispatch();

  // state

  const [searchText, setSetText] = useState();
  const [openCreate, setOpenCreate] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  // helpers

  const filteredItems = useMemo(() => {
    return getFoundItems({ items, searchText, searchKeys });
  }, [items, searchText, searchKeys]);

  // handlers

  function handleClose() {
    dispatch(setSelectedListTypeKey(null));
  }

  function handleClick(item) {
    onItemClick(item);
  }

  return (
    <BoxFlexVStretch>
      <HeaderListPanel
        title={title}
        actionComponent={<IconButtonClose onClose={handleClose} />}
      />
      <Box sx={{ p: 1, width: 1 }}>
        <SearchBar
          value={searchText}
          onChange={setSetText}
          onCreateClick={onCreateClick}
        />
      </Box>

      <BoxFlexVStretch>
        <ListItemsGenericV2
          items={filteredItems}
          selection={selection}
          onClick={handleClick}
          keyString="id"
          componentListItem={componentListItem}
        />
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
