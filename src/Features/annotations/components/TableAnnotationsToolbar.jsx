import { Box } from "@mui/material";

import ButtonCreateExcelAnnotations from "Features/excel/components/ButtonCreateExcelAnnotations";

export default function TableAnnotationsToolbar({ annotations }) {

    return <Box sx={{ p: 1, display: "flex", alignItems: "center" }}>
        <ButtonCreateExcelAnnotations annotations={annotations} />
    </Box>
}