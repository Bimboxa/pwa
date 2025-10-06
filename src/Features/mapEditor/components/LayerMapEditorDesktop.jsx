import { useSelector } from "react-redux";

import { Box } from "@mui/material";

import ButtonOpenListPanel from "Features/listPanel/components/ButtonOpenListPanel";
import ToolbarMapEditorContainer from "./ToolbarMapEditorContainer";
//import SelectorMapInMapEditor from "Features/baseMaps/components/SelectorMapInMapEditor";
//import BlockPrintMode from "./BlockPrintMode";
//import BlockSaveBaseMapViewInEditor from "Features/baseMapViews/components/BlockSaveBaseMapViewInEditor";
import ButtonSelectorBaseMapInMapEditor from "Features/baseMaps/components/ButtonSelectorBaseMapInMapEditor";
//import LayerCreateLocatedEntity from "./LayerCreateLocatedEntity";
import LeftPanelOverviewInEditor from "Features/leftPanel/components/LeftPanelOverviewInEditor";
import ButtonCreateBlueprint from "Features/blueprints/components/ButtonCreateBlueprint";
import ButtonBlueprintInMapEditor from "Features/blueprints/components/ButtonBlueprintInMapEditor";
import ButtonDownloadMapEditorInPdf from "./ButtonDownloadMapEditorInPdf";

export default function LayerMapEditorDesktop({ svgElement }) {
  // data

  const openRightPanel = useSelector((s) => s.rightPanel.selectedMenuItemKey);
  const width = useSelector((s) => s.rightPanel.width);

  return (
    <>
      {/* <LayerCreateLocatedEntity /> */}
      <Box
        sx={{
          position: "absolute",
          left: "0px",
          top: "0px",
          zIndex: 10000,
        }}
      >
        <LeftPanelOverviewInEditor />
      </Box>

      <Box
        sx={{
          position: "absolute",
          left: "50%",
          top: "16px",
          transform: "translateX(-50%)",
          zIndex: 10000,
        }}
      >
        <ButtonSelectorBaseMapInMapEditor />
      </Box>

      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "8px",
          transform: "translateY(-50%)",
          zIndex: 10000,
        }}
      >
        <ButtonOpenListPanel />
      </Box>

      {/* <Box
        sx={{
          position: "absolute",
          //top: "64px",
          bottom: "8px",
          right: "8px",
          //left: "50%",
          //transform: "translateX(-50%)",
          zIndex: 2,
        }}
      >
        <BlockSaveBaseMapViewInEditor />
      </Box> */}

      <Box
        sx={{
          position: "absolute",
          bottom: "8px",
          left: "8px",
          zIndex: 10000,
        }}
      >
        <ButtonBlueprintInMapEditor />
      </Box>

      <Box
        sx={{
          position: "absolute",
          bottom: "8px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10000,
        }}
      >
        <ToolbarMapEditorContainer svgElement={svgElement} />
      </Box>

      <Box
        sx={{
          position: "absolute",
          bottom: "8px",
          //right: openRightPanel ? `${width + 8}px` : "8px",
          right: "8px",
          zIndex: 10000,
        }}
      >
        <ButtonDownloadMapEditorInPdf svgElement={svgElement} />
      </Box>
    </>
  );
}
