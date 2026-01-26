import { useState, useMemo, useEffect } from "react";

import useDebouncedValue from "Features/misc/hooks/useDebounceValue";
import useIsMobile from "Features/layout/hooks/useIsMobile";

import { Box, LinearProgress } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SectionSearch from "Features/itemsList/components/SectionSearch";
import SectionListItems from "Features/itemsList/components/SectionListItems";
import SectionNoItem from "./SectionNoItem";

import getFoundItems from "Features/search/getFoundItems";
import getSortedItems from "Features/misc/utils/getSortedItems";
// import ButtonInPanel from "Features/layout/components/ButtonInPanel"; // (Non utilisé dans le code fourni, mais je le laisse commenté au cas où)
import { createPortal } from "react-dom";
// import BoxFlexV from "Features/layout/components/BoxFlexV"; // (Non utilisé dans le code fourni)

export default function ItemsListVariantSimple({
  items,
  selection,
  onClick,
  searchKeys,
  sortBy,
  noItemLabel,
  containerEl,
  createComponent,
  // createLabel, // (Non utilisé)
  clickOnCreation,
  loading,
  // disableCreation, // (Non utilisé)
  maxItems,
  onCreateClick,
  onSearchTextChangeDebounced, // La prop callback du parent
}) {
  //

  const isMobile = useIsMobile();

  // state

  const [searchText, setSearchText] = useState();
  const [openCreate, setOpenCreate] = useState(false);

  // Le hook de debounce (délai de 300ms)
  const debouncedSearchText = useDebouncedValue(searchText, 300);

  // --- MODIFICATION ICI ---
  // On notifie le parent uniquement quand la valeur debouncée change
  useEffect(() => {
    // On vérifie que la prop existe pour éviter une erreur si elle n'est pas passée
    if (onSearchTextChangeDebounced) {
      // On envoie la valeur (undefined au début, ou string ensuite)
      console.log('debug_2601_onSearchTextChangeDebounced', debouncedSearchText);
      onSearchTextChangeDebounced(debouncedSearchText);
    }
  }, [debouncedSearchText]);
  // ------------------------

  // effect container

  useEffect(() => {
    if (containerEl) {
      containerEl.style.position = containerEl.style.position || "relative";
    }
  }, [containerEl]);

  // helpers - search

  let foundItems = useMemo(() => {
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

  // maxItems

  if (maxItems && foundItems) foundItems = foundItems.slice(0, maxItems);

  // console.log("foundItems", foundItems);

  // helpers - noItems

  const noItems = !foundItems?.length > 0;

  // handlers

  function handleSearchTextChange(text) {
    setSearchText(text);
  }

  function handleItemClick(item) {
    // console.log("Item clicked:", item);
    onClick(item);
  }

  function handleCreateClick() {
    if (onCreateClick) onCreateClick();
  }

  function handleItemCreated(item) {
    console.log("[item] created", item);
    setOpenCreate(false);
    if (clickOnCreation) onClick(item, { fromCreation: true });
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
          onCreateClick={handleCreateClick}
        />
        {/* On affiche le loader si loading est true (géré par le parent pendant le fetch) */}
        <Box sx={{ visibility: loading ? "visible" : "hidden", minHeight: 4 }}>
          <LinearProgress />
        </Box>
        <BoxFlexVStretch sx={{ overflowY: "auto" }}>
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
      </BoxFlexVStretch>
      {openCreate &&
        containerEl &&
        createPortal(
          <Box
            sx={{
              position: "absolute",
              bgcolor: "white",
              top: 0,
              ...(isMobile && { bottom: 0 }),
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