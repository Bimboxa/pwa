import {useSelector} from "react-redux";

import BoxCenter from "./BoxCenter";

import MainMapEditor from "Features/mapEditor/components/MainMapEditor";
import MainThreedEditor from "Features/threedEditor/components/MainThreedEditor";
import PanelShowable from "./PanelShowable";

export default function SectionViewer() {
  const viewerKey = useSelector((s) => s.viewers.selectedViewerKey);

  // helpers

  const showMap = viewerKey === "MAP";
  const showThreed = viewerKey === "THREED";

  return (
    <BoxCenter sx={{position: "relative"}}>
      <PanelShowable show={showMap} sx={{position: "absolute", zIndex: 0}}>
        <MainMapEditor />
      </PanelShowable>
      <PanelShowable show={showThreed} sx={{position: "absolute", zIndex: 0}}>
        <MainThreedEditor />
      </PanelShowable>
    </BoxCenter>
  );
}
