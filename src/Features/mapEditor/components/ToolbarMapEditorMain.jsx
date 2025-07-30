import Toolbar from "Features/layout/components/Toolbar";
import ButtonRefreshMap from "./ButtonRefreshMap";
import ButtonDrawPolygon from "./ButtonDrawPolygon";
import ButtonEditScale from "./ButtonEditScale";
import ButtonDrawPolyline from "./ButtonDrawPolyline";
import ButtonAutoSegmentation from "./ButtonAutoSegmentation";
import ButtonDrawFreeline from "./ButtonDrawFreeline";
import ButtonDrawMarker from "./ButtonDrawMarker";
import ButtonDownloadBaseMapView from "./ButtonDownloadBaseMapView";

export default function ToolbarMapEditorMain() {
  return (
    <Toolbar>
      <ButtonRefreshMap />
      <ButtonEditScale />
      <ButtonDrawMarker />
      <ButtonDrawPolyline />
      <ButtonDrawPolygon />
      <ButtonDrawFreeline />
      <ButtonDownloadBaseMapView />
      {/*<ButtonAutoSegmentation />*/}
    </Toolbar>
  );
}
