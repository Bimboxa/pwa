
import { Paper } from "@mui/material";

import ButtonDrawPolygon from "./ButtonDrawPolygon";
import ButtonDrawPolyline from "./ButtonDrawPolyline";

export default function ToolbarMapEditorV3() {
    return <Paper sx={{ display: "flex", alignItems: "center" }}>
        <ButtonDrawPolyline />
        <ButtonDrawPolygon />
    </Paper>
}