import { useSelector } from "react-redux";

import BoxCenter from "./BoxCenter";

import PanelShowable from "./PanelShowable";
import MainMapEditor from "Features/mapEditor/components/MainMapEditor";
import MainMapEditorV2 from "Features/mapEditor/components/MainMapEditorV2";
import MainThreedEditor from "Features/threedEditor/components/MainThreedEditor";
import MainLeafletEditor from "Features/leafletEditor/components/MainLeafletEditor";
import MainGoogleMapEditor from "Features/gmap/components/MainGoogleMapEditor";
import TableViewer from "Features/tables/components/ViewerTable";

export default function SectionViewer() {
  const viewerKey = useSelector((s) => s.viewers.selectedViewerKey);

  // helpers

  const showMap = viewerKey === "MAP";
  const showThreed = viewerKey === "THREED";
  const showLeaflet = viewerKey === "LEAFLET";
  const showTable = viewerKey === "TABLE";

  return (
    <BoxCenter sx={{ position: "relative" }}>
      <PanelShowable show={showMap} sx={{ position: "absolute", zIndex: 0 }}>
        <MainMapEditorV2 />
      </PanelShowable>
      <PanelShowable show={showThreed} sx={{ position: "absolute", zIndex: 0 }}>
        <MainThreedEditor />
      </PanelShowable>
      <PanelShowable
        show={showLeaflet}
        sx={{ position: "absolute", zIndex: 0 }}
      >
        {/* <MainLeafletEditor /> */}
        {/* <MainGoogleMapEditor /> */}
      </PanelShowable>
      <PanelShowable show={showTable} sx={{ position: "absolute", zIndex: 0 }}>
        <TableViewer />
      </PanelShowable>
    </BoxCenter>
  );
}
