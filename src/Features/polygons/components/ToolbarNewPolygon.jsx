
import { Paper, Typography } from "@mui/material";

import FieldNewEntityLabel from "Features/annotations/components/FieldNewEntityLabel";

export default function ToolbarNewPolygon() {


    return <Paper sx={{ display: "flex", alignItems: "center", gap: 1, p: 1 }}>
        <FieldNewEntityLabel />
    </Paper>
}