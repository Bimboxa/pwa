
import { useSelector } from "react-redux";

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

    // helpers

    const tools = [
        <ButtonDrawMarker />,
        <ButtonDrawPolyline />,
        <ButtonDrawPolygon />,
    ]


    // render

    if (enabledDrawingMode) {
        return <ToolbarEnabledDrawingMode />
    }

    return <Paper sx={{ display: "flex", alignItems: "center", p: 0.5, pr: 1, borderRadius: 2 }}>
        <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
            <Box>
                <ButtonEditScale />
            </Box>

            <FieldNewAnnotationLabel />
            <FieldNewAnnotationColor />
        </Box>

        <Box sx={{ display: "flex", gap: 0.5, ml: 2 }}>
            {tools.map(tool => tool)}
        </Box>
    </Paper >
}