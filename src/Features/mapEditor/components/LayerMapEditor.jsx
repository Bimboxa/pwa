import {useSelector} from "react-redux";

import LayerMapEditorDesktop from "./LayerMapEditorDesktop";

export default function LayerMapEditor() {
  // data

  const deviceType = useSelector((s) => s.layout.deviceType);

  return <>{deviceType === "DESKTOP" && <LayerMapEditorDesktop />}</>;
}
