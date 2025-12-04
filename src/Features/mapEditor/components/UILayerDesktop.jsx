import { Box } from "@mui/material";

import ButtonSelectorBaseMapInMapEditor from "Features/baseMaps/components/ButtonSelectorBaseMapInMapEditor";
import ToolbarMapEditorV3 from "./ToolbarMapEditorV3";

export default function UILayerDesktop({ mapController, onResetCamera }) {
    return (
        <>
            <Box
                sx={{
                    position: "absolute",
                    left: "50%",
                    top: "8px",
                    transform: "translateX(-50%)",
                    zIndex: 1,
                }}
            >
                <ButtonSelectorBaseMapInMapEditor onResetCamera={onResetCamera} />
            </Box>

            <Box sx={{
                position: "absolute",
                left: "50%",
                bottom: "8px",
                transform: "translateX(-50%)",
                zIndex: 1,
            }}>
                <ToolbarMapEditorV3 />
            </Box>
        </>
    );
}