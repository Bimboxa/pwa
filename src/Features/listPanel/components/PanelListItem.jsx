import {useRef, useState, useEffect} from "react";
import {useSelector, useDispatch} from "react-redux";

import useIsMobile from "Features/layout/hooks/useIsMobile";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useListingEntityModel from "Features/entities/hooks/useListingEntityModel";

import {setOpenPanelListItem} from "../listPanelSlice";

import {Box, Paper} from "@mui/material";

import SectionEntity from "Features/entities/components/SectionEntity";
import BlockEntityInListPanel from "Features/entities/components/BlockEntityInListPanel";
import BlockBottomActionsInPanel from "Features/entityProps/components/BlockBottomActionsInPanel";
import BoxFlexV from "Features/layout/components/BoxFlexV";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

export default function PanelListItem() {
  const dispatch = useDispatch();
  const selectorContainerRef = useRef(null);

  // state

  const [listItemContainerHeight, setListItemContainerHeight] = useState(50);

  // data

  const listPanelWidth = useSelector((s) => s.listPanel.width);
  const topBarHeight = useSelector((s) => s.layout.topBarHeight);
  const openPanelListItem = useSelector((s) => s.listPanel.openPanelListItem);

  const {value: listing} = useSelectedListing();
  const entityModel = useListingEntityModel(listing);

  const isMobile = useIsMobile();

  // helpers

  const width = isMobile ? 1 : listPanelWidth;
  const top = isMobile ? 0 : topBarHeight;
  const bottom = 0;

  // helper - header
  const componentByEntityModel = {
    ENTITY_PROPS: <BlockBottomActionsInPanel />,
  };
  const header = componentByEntityModel[entityModel?.type] ?? (
    <BlockEntityInListPanel />
  );

  // handlers

  function handleClick() {
    dispatch(setOpenPanelListItem(!openPanelListItem));
  }

  return (
    <BoxFlexVStretch>
      {header}
      <BoxFlexVStretch>
        <SectionEntity />
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
