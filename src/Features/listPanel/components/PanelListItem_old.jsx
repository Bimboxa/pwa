import { useRef, useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";

import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useListingEntityModel from "Features/entities/hooks/useListingEntityModel";

import { setOpenPanelListItem } from "../listPanelSlice";

import { Box, Paper } from "@mui/material";

import SectionEntity from "Features/entities/components/SectionEntity";
import BlockEntityInPanel from "Features/entities/components/BlockEntityInPanel";
import BlockBottomActionsInPanel from "Features/entityProps/components/BlockBottomActionsInPanel";

export default function PanelListItem() {
  const dispatch = useDispatch();
  const selectorContainerRef = useRef(null);
  const listItemContainerRef = useRef(null);

  // state

  const [listItemContainerHeight, setListItemContainerHeight] = useState(50);

  // data

  const listPanelWidth = useSelector((s) => s.listPanel.width);
  const openPanelListItem = useSelector((s) => s.listPanel.openPanelListItem);

  const { value: listing } = useSelectedListing();
  const entityModel = useListingEntityModel(listing);

  // effect - init height

  useEffect(() => {
    setListItemContainerHeight(listItemContainerRef.current.clientHeight);
  }, [
    listItemContainerRef.current?.clientHeight,
    openPanelListItem,
    listing?.id,
  ]);

  // helpers

  const componentByEntityModel = {
    ENTITY_PROPS: <BlockBottomActionsInPanel />,
  };
  const component = componentByEntityModel[entityModel?.type] ?? (
    <BlockEntityInPanel />
  );

  // handlers

  function handleClick() {
    dispatch(setOpenPanelListItem(!openPanelListItem));
  }

  return (
    <Box
      sx={{
        position: "absolute",
        bottom: 0,
        zIndex: 1000,
        transition: "transform 0.2s ease-in-out",
        height: openPanelListItem ? 1 : `${listItemContainerHeight}px`,
        transform: openPanelListItem
          ? "translateY(0)"
          : `translateY(calc(100% - ${listItemContainerHeight}px))`,
      }}
    >
      <Paper
        ref={selectorContainerRef}
        sx={{
          width: listPanelWidth,
          bgcolor: "common.white",
          height: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: openPanelListItem ? "flex-start" : "flex-end",
        }}
      >
        <Box sx={{ width: 1 }} ref={listItemContainerRef}>
          {component}
        </Box>
        {openPanelListItem && (
          <Box
            sx={{
              flex: 1,
              overflow: "auto",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <SectionEntity selectorContainerRef={selectorContainerRef} />
          </Box>
        )}
      </Paper>
    </Box>
  );
}
