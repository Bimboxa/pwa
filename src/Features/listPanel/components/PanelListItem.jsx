import {useRef, useState, useEffect} from "react";
import {useSelector, useDispatch} from "react-redux";

import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useListingEntityModel from "Features/listings/hooks/useListingEntityModel";

import {setOpenPanelListItem} from "../listPanelSlice";

import {Box, Paper} from "@mui/material";

import SectionEntity from "Features/entities/components/SectionEntity";
import BlockEntityInListPanel from "Features/entities/components/BlockEntityInListPanel";
import BlockBottomActionsInPanel from "Features/entityProps/components/BlockBottomActionsInPanel";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

export default function PanelListItem() {
  const dispatch = useDispatch();

  // data

  const openPanelListItem = useSelector((s) => s.listPanel.openPanelListItem);

  const {value: listing} = useSelectedListing();
  const entityModel = useListingEntityModel(listing);

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
