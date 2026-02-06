import { useSelector } from "react-redux";

import { Box } from "@mui/material";

import BoxCenter from "./BoxCenter";
import PanelShowable from "./PanelShowable";
//import MainMapEditor from "Features/mapEditor/components/MainMapEditor";
import MainMapEditorV2 from "Features/mapEditor/components/MainMapEditorV2";
import MainMapEditorV3 from "Features/mapEditor/components/MainMapEditorV3";
import MainThreedEditor from "Features/threedEditor/components/MainThreedEditor";
import MainLeafletEditor from "Features/leafletEditor/components/MainLeafletEditor";
import MainGoogleMapEditor from "Features/gmap/components/MainGoogleMapEditor";
import TableViewer from "Features/tables/components/ViewerTable";
import ButtonToggleThreedViewer from "Features/viewers/components/ButtonToggleThreedViewer";

export default function SectionViewer() {
  // data
  const enabled = useSelector((s) => s.threedEditor.enabled);
  const viewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const legacy = useSelector((s) => s.appConfig.enableMapEditorLegacy);

  // helpers

  const showMap = viewerKey === "MAP";
  const showThreed = viewerKey === "THREED";
  const showLeaflet = viewerKey === "LEAFLET";
  const showTable = viewerKey === "TABLE";

  return (
    <BoxCenter sx={{ position: "relative" }}>
      <PanelShowable show={showMap} sx={{ position: "absolute", zIndex: 0 }}>
        {legacy ? <MainMapEditorV2 /> : <MainMapEditorV3 />}
      </PanelShowable>
      {enabled && (
        <PanelShowable
          show={showThreed}
          sx={{ position: "absolute", zIndex: 0 }}
        >
          <MainThreedEditor />
        </PanelShowable>
      )}
      <PanelShowable
        show={showLeaflet}
        sx={{ position: "absolute", zIndex: 0 }}
      >
        {/* <MainLeafletEditor /> */}
        {/* <MainGoogleMapEditor /> */}
      </PanelShowable>

      {showTable && <PanelShowable show={showTable} sx={{ position: "absolute", zIndex: 0 }}>
        <TableViewer />
      </PanelShowable>}

      <Box sx={{ position: "absolute", bottom: "8px", right: "8px" }}>
        <ButtonToggleThreedViewer />
      </Box>
    </BoxCenter>
  );
}
