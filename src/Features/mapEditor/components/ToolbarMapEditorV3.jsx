
import { useSelector } from "react-redux";

import useMainBaseMap from "../hooks/useMainBaseMap";

import { Paper, Box } from "@mui/material";

import FieldNewAnnotationLabel from "./FieldNewAnnotationLabel";
import FieldNewAnnotationColor from "./FieldNewAnnotationColor";


import ButtonDrawMarker from "./ButtonDrawMarker";
import ButtonDrawPolygon from "./ButtonDrawPolygon";
import ButtonDrawPolyline from "./ButtonDrawPolyline";
import ButtonDrawLabel from "./ButtonDrawLabel";
import ButtonEditScale from "./ButtonEditScale";

import ToolbarEnabledDrawingMode from "./ToolbarEnabledDrawingMode";
import ToolbarNewAnnotation from "Features/annotations/components/ToolbarNewAnnotation";


export default function ToolbarMapEditorV3() {


    // data

    const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
    const baseMap = useMainBaseMap();
    const meterByPx = baseMap?.meterByPx;
    const newAnnotation = useSelector((s) => s.annotations.newAnnotation);

    // helpers

    const tools = [
        <ButtonDrawMarker key={1} disabled={!newAnnotation?.label} />,
        <ButtonDrawPolyline key={2} disabled={!newAnnotation?.label} />,
        <ButtonDrawPolygon key={3} disabled={!newAnnotation?.label} />,
    ]


    // render

    if (enabledDrawingMode) {
        return <Box sx={{ display: "flex", gap: 1 }}>
            <ToolbarNewAnnotation />
            <ToolbarEnabledDrawingMode />

        </Box>
    }

    return <Box sx={{ display: "flex", gap: 1 }}>
        <Paper sx={{ display: "flex", alignItems: "center", p: 0.5, pr: 1, borderRadius: 2 }}>
            <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>


                <FieldNewAnnotationLabel />
                <FieldNewAnnotationColor />
            </Box>

            <Box sx={{ display: "flex", gap: 0.5, ml: 2 }}>
                {tools.map(tool => tool)}
            </Box>

        </Paper >

        <Paper sx={{ display: "flex", alignItems: "center", p: 0.5, px: 1, borderRadius: 2 }}>
            <ButtonDrawLabel />

        </Paper>

        {meterByPx && < Paper sx={{ display: "flex", alignItems: "center", p: 0.5, px: 1, borderRadius: 2 }}>
            <ButtonEditScale />
        </Paper>

        }
    </Box >
}