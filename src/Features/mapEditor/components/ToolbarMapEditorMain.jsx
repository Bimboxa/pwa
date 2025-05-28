import Toolbar from "Features/layout/components/Toolbar";
import ButtonRefreshMap from "./ButtonRefreshMap";
import ButtonDrawPolygon from "./ButtonDrawPolygon";
import ButtonEditScale from "./ButtonEditScale";
import ButtonDrawPolyline from "./ButtonDrawPolyline";
import ButtonAutoSegmentation from "./ButtonAutoSegmentation";
import ButtonDrawFreeline from "./ButtonDrawFreeline";

export default function ToolbarMapEditorMain() {
  return (
    <Toolbar>
      <ButtonRefreshMap />
      <ButtonEditScale />
      <ButtonDrawPolyline />
      <ButtonDrawPolygon />
      <ButtonDrawFreeline />
      <ButtonAutoSegmentation />
    </Toolbar>
  );
}
