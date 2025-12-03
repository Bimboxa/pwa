import { Box } from "@mui/material";

import ButtonSelectorBaseMapInMapEditor from "Features/baseMaps/components/ButtonSelectorBaseMapInMapEditor";

export default function UILayerDesktop() {
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
                <ButtonSelectorBaseMapInMapEditor />
            </Box>
        </>
    );
}