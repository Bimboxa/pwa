
import { Paper } from "@mui/material";

import FieldNewAnnotationColor from "Features/mapEditor/components/FieldNewAnnotationColor";
import FieldNewAnnotationLabel from "Features/mapEditor/components/FieldNewAnnotationLabel";

export default function ToolbarNewLabel() {


    return <Paper sx={{ display: "flex", alignItems: "center", gap: 1, p: 1 }}>
        <FieldNewAnnotationColor />
        <FieldNewAnnotationLabel labelS="Etiquette" />
    </Paper>
}