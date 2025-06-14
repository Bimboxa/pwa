import {useState, useMemo, useEffect} from "react";

import useDebouncedValue from "Features/misc/hooks/useDebounceValue";
import useIsMobile from "Features/layout/hooks/useIsMobile";

import {Box, LinearProgress} from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SectionSearch from "Features/itemsList/components/SectionSearch";
import SectionListItems from "Features/itemsList/components/SectionListItems";
import SectionNoItem from "./SectionNoItem";

import getFoundItems from "Features/search/getFoundItems";
import getSortedItems from "Features/misc/utils/getSortedItems";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";
import {createPortal} from "react-dom";

export default function ItemsList({
  items,
  selection,
  onClick,
  searchKeys,
  sortBy,
  noItemLabel,
  containerEl,
  createComponent,
  createLabel,
  clickOnCreation,
  loading,
  disableCreation,
}) {
  //

  const isMobile = useIsMobile();

  // state

  const [searchText, setSearchText] = useState();
  const [openCreate, setOpenCreate] = useState(false);

  const debouncedSearchText = useDebouncedValue(searchText, 300);

  // effect

  useEffect(() => {
    if (containerEl) {
      containerEl.style.position = containerEl.style.position || "relative";
    }
  }, [containerEl]);

  // helpers - search

  const foundItems = useMemo(() => {
    // search
    let _items = getFoundItems({
      items,
      searchText: debouncedSearchText,
      searchKeys,
    });

    // sortBy
    if (sortBy) _items = getSortedItems(_items, sortBy);

    return _items;
  }, [debouncedSearchText, items, searchKeys, sortBy]);

  console.log("foundItems", foundItems);

  // helpers - noItems

  const noItems = !foundItems?.length > 0;

  // handlers

  function handleSearchTextChange(text) {
    setSearchText(text);
  }

  function handleItemClick(item) {
    console.log("Item clicked:", item);
    onClick(item);
  }

  function handleCreateClick() {
    setOpenCreate(true);
  }

  function handleItemCreated(item) {
    console.log("[item] created", item);
    setOpenCreate(false);
    if (clickOnCreation) onClick(item, {fromCreation: true});
  }

  return (
    <>
      <BoxFlexVStretch
        sx={{
          visibility: openCreate ? "hidden" : "visible",
        }}
      >
        <SectionSearch
          searchText={searchText}
          onChange={handleSearchTextChange}
        />
        <Box sx={{visibility: loading ? "visible" : "hidden"}}>
          <LinearProgress />
        </Box>
        <BoxFlexVStretch sx={{overflow: "auto"}}>
          {!noItems ? (
            <SectionListItems
              items={foundItems}
              selection={selection}
              onClick={handleItemClick}
            />
          ) : (
            <SectionNoItem noItemLabel={noItemLabel} />
          )}
        </BoxFlexVStretch>
        <ButtonInPanel
          label={createLabel}
          onClick={handleCreateClick}
          disabled={disableCreation}
        />
      </BoxFlexVStretch>
      {openCreate &&
        containerEl &&
        createPortal(
          <Box
            sx={{
              position: "absolute",
              bgcolor: "white",
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 1,
              display: "flex",
              flexDirection: "column",
              pb: isMobile ? 2 : 0,
            }}
          >
            {createComponent({
              onClose: () => setOpenCreate(false),
              onCreated: (item) => handleItemCreated(item),
            })}
          </Box>,
          containerEl
        )}
    </>
  );
}
