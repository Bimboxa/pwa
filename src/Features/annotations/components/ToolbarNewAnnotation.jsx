
import { useSelector } from "react-redux";

import ToolbarNewLabel from "Features/labels/components/ToolbarNewLabel";
import ToolbarNewPolyline from "Features/polylines/components/ToolbarNewPolyline";
import ToolbarNewPolygon from "Features/polygons/components/ToolbarNewPolygon";

export default function ToolbarNewAnnotation() {

    const newAnnotation = useSelector(s => s.annotations.newAnnotation);
    const type = newAnnotation?.type;

    return <>
        {type === "LABEL" && <ToolbarNewLabel />}
        {type === "POLYLINE" && <ToolbarNewPolyline />}
        {type === "POLYGON" && <ToolbarNewPolygon />}
    </>
}