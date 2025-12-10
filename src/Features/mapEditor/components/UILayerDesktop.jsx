import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import { Box } from "@mui/material";

import ButtonSelectorBaseMapInMapEditor from "Features/baseMaps/components/ButtonSelectorBaseMapInMapEditor";
import ToolbarMapEditorV3 from "./ToolbarMapEditorV3";
import ButtonEditScaleVariantFirst from "./ButtonEditScaleVariantFirst";

export default function UILayerDesktop({ mapController, onResetCamera }) {

    // data

    const { value: listing } = useSelectedListing();

    // helpers

    const emType = listing?.entityModel?.type;

    // helpers - show

    const showDrawingTools = emType === "LOCATED_ENTITY";
    const showEditScale = true;


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

            {showDrawingTools && <Box sx={{
                position: "absolute",
                left: "50%",
                bottom: "24px",
                transform: "translateX(-50%)",
                zIndex: 1,
            }}>
                <ToolbarMapEditorV3 />
            </Box>}

            {showEditScale && <Box
                sx={{
                    position: "absolute",
                    left: "4px",
                    bottom: "4px",
                    zIndex: 1,
                    display: "flex",
                    alignItems: "center",
                }}
            >
                <ButtonEditScaleVariantFirst size="small" />
            </Box>}
        </>
    );
}