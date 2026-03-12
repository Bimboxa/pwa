
import { Box } from "@mui/material";

//import ButtonMenuMapEditorSettings from "./ButtonMenuMapEditorSettings";
import SectionPdfReportInMapEditor from "Features/pdfReport/components/SectionPdfReportInMapEditor";

export default function LayerTools() {
    return <>
        <Box
            sx={{
                position: "absolute",
                right: "16px",
                top: "16px",
                zIndex: 1,
            }}
        >

            <SectionPdfReportInMapEditor />
        </Box>
    </>;
}