import {useRef} from "react";
import {useSelector, useDispatch} from "react-redux";

import {setOpenPanelListItem} from "../listPanelSlice";

import {Box, Paper} from "@mui/material";

import SectionEntity from "Features/entities/components/SectionEntity";
import BlockEntityInListPanel from "Features/entities/components/BlockEntityInListPanel";

export default function PanelListItem() {
  const dispatch = useDispatch();
  const selectorContainerRef = useRef(null);

  // data

  const listPanelWidth = useSelector((s) => s.listPanel.width);
  const openPanelListItem = useSelector((s) => s.listPanel.openPanelListItem);

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
        height: openPanelListItem ? 1 : "50px",
        transform: openPanelListItem
          ? "translateY(0)"
          : "translateY(calc(100% - 50px))",
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
        <BlockEntityInListPanel />
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
