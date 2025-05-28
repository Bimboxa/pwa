import {useSelector} from "react-redux";

import BoxCenter from "./BoxCenter";

import PanelShowable from "./PanelShowable";
import MainMapEditor from "Features/mapEditor/components/MainMapEditor";
import MainThreedEditor from "Features/threedEditor/components/MainThreedEditor";
import MainLeafletEditor from "Features/leafletEditor/components/MainLeafletEditor";

export default function SectionViewer() {
  const viewerKey = useSelector((s) => s.viewers.selectedViewerKey);

  // helpers

  const showMap = viewerKey === "MAP";
  const showThreed = viewerKey === "THREED";
  const showLeaflet = viewerKey === "LEAFLET";

  return (
    <BoxCenter sx={{position: "relative"}}>
      <PanelShowable show={showMap} sx={{position: "absolute", zIndex: 0}}>
        <MainMapEditor />
      </PanelShowable>
      <PanelShowable show={showThreed} sx={{position: "absolute", zIndex: 0}}>
        <MainThreedEditor />
      </PanelShowable>
      <PanelShowable show={showLeaflet} sx={{position: "absolute", zIndex: 0}}>
        <MainLeafletEditor />
      </PanelShowable>
    </BoxCenter>
  );
}
