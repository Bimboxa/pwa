import { useSelector } from "react-redux";

import useOpenListPanel from "Features/listPanel/hooks/useOpenListPanel";

import { Box } from "@mui/material";
import MenuListTypes from "Features/listPanel/components/MenuListTypes";
import TopBarProjectAndScope from "./TopBarProjectAndScope";
import SelectorViewer from "Features/viewers/components/SelectorViewer";
import ListPanelsContainer from "Features/listPanel/components/ListPanelsContainer";
import BlockBaseMapViewInEditor from "Features/baseMapViews/components/BlockBaseMapViewInEditor";

export default function LayerDesktop() {
  // data

  const width = useSelector((s) => s.listPanel.width);
  const windowHeight = useSelector((s) => s.layout.windowHeight);
  const openListPanel = useOpenListPanel();

  // helpers

  const panelHeight = windowHeight - 150;

  return (
    <>
      <Box
        sx={{
          position: "absolute",
          top: "8px",
          left: "8px",
          zIndex: 2,
        }}
      >
        <TopBarProjectAndScope />
      </Box>

      <Box
        sx={{
          position: "absolute",
          top: "8px",
          right: "8px",
          zIndex: 2,
        }}
      >
        <SelectorViewer />
      </Box>

      <Box
        sx={{
          position: "absolute",
          top: "8px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 2,
        }}
      >
        <BlockBaseMapViewInEditor />
      </Box>

      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "8px",
          transform: "translateY(-50%)",
          zIndex: 2,
        }}
      >
        <MenuListTypes />
      </Box>

      {openListPanel && (
        <Box
          sx={{
            position: "absolute",
            top: "64px",
            left: "70px",
            zIndex: 2,
            width,
            maxHeight: panelHeight,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <ListPanelsContainer />
        </Box>
      )}
    </>
  );
}
