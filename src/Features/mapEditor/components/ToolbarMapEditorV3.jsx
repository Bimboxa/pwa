
import { useSelector } from "react-redux";

import useMainBaseMap from "../hooks/useMainBaseMap";

import { Paper, Box } from "@mui/material";

import FieldNewAnnotationLabel from "./FieldNewAnnotationLabel";
import FieldNewAnnotationColor from "./FieldNewAnnotationColor";


import ButtonDrawMarker from "./ButtonDrawMarker";
import ButtonDrawPolygon from "./ButtonDrawPolygon";
import ButtonDrawPolyline from "./ButtonDrawPolyline";
import ToolbarEnabledDrawingMode from "./ToolbarEnabledDrawingMode";
import ButtonEditScale from "./ButtonEditScale";


export default function ToolbarMapEditorV3() {


    // data

    const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
    const baseMap = useMainBaseMap();
    const meterByPx = baseMap?.meterByPx;
    const newAnnotation = useSelector((s) => s.annotations.newAnnotation);

    // helpers

    const tools = [
        <ButtonDrawMarker disabled={!newAnnotation?.label} />,
        <ButtonDrawPolyline disabled={!newAnnotation?.label} />,
        <ButtonDrawPolygon disabled={!newAnnotation?.label} />,
    ]


    // render

    if (enabledDrawingMode) {
        return <ToolbarEnabledDrawingMode />
    }

    return <Paper sx={{ display: "flex", alignItems: "center", p: 0.5, pr: 1, borderRadius: 2 }}>
        <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>


            <FieldNewAnnotationLabel />
            <FieldNewAnnotationColor />
        </Box>

        <Box sx={{ display: "flex", gap: 0.5, ml: 2 }}>
            {tools.map(tool => tool)}
        </Box>
        {meterByPx && <Box sx={{ ml: 1 }}>
            <ButtonEditScale />
        </Box>}
    </Paper >
}