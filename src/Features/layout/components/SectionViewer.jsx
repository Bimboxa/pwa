import {useSelector} from "react-redux";

import BoxCenter from "./BoxCenter";

import MainMapEditor from "Features/mapEditor/components/MainMapEditor";
import MainThreedEditor from "Features/threedEditor/components/MainThreedEditor";

export default function SectionViewer() {
  const viewerKey = useSelector((s) => s.viewers.selectedViewerKey);

  return (
    <BoxCenter>
      {viewerKey === "MAP" && <MainMapEditor />}
      {viewerKey === "THREED" && <MainThreedEditor />}
    </BoxCenter>
  );
}
