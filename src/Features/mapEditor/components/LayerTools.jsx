
import { Box } from "@mui/material";

import ButtonMenuMapEditorSettings from "./ButtonMenuMapEditorSettings";

export default function LayerTools() {
    return <>
        <Box
            sx={{
                position: "absolute",
                right: "8px",
                bottom: "8px",
                zIndex: 1,
            }}
        >
            <ButtonMenuMapEditorSettings />
        </Box>
    </>;
}