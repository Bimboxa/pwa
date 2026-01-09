import { useSelector } from "react-redux";

import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import { useInteraction } from "../context/InteractionContext";

import { Box } from "@mui/material";

import ButtonSelectorBaseMapInMapEditor from "Features/baseMaps/components/ButtonSelectorBaseMapInMapEditor";
import ToolbarMapEditorV3 from "./ToolbarMapEditorV3";
import ButtonEditScaleVariantFirst from "./ButtonEditScaleVariantFirst";
import ButtonAutoLayoutLabels from "Features/tools/components/ButtonAutoLayoutLabels";
import SectionShowedFWC from "Features/fwc/components/SectionShowedFWC";
import BaseMapSelectorInMapEditorV2 from "Features/baseMaps/components/BaseMapSelectorInMapEditorV2";
import ButtonRunningTransform from "Features/baseMapTransforms/components/ButtonRunningTransform";


export default function UILayerDesktop({ mapController, onResetCamera, viewport }) {

    // data

    const { value: listing } = useSelectedListing();
    const openedPanel = useSelector(s => s.listings.openedPanel)

    const { basePose } = useInteraction();

    // helpers

    const emType = listing?.entityModel?.type;

    // helpers - show

    const showDrawingTools = emType === "LOCATED_ENTITY" || listing?.entityModel?.annotationEnabled || openedPanel === "BASE_MAP_DETAIL";
    const showEditScale = true;


    return (
        <>
            {/* <Box
                sx={{
                    position: "absolute",
                    left: "50%",
                    top: "8px",
                    transform: "translateX(-50%)",
                    zIndex: 1,
                }}
            >
                <ButtonSelectorBaseMapInMapEditor onResetCamera={onResetCamera} />
            </Box> */}

            <Box
                sx={{
                    position: "absolute",
                    left: "8px",
                    top: "8px",
                    zIndex: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                }}
            >
                <ButtonRunningTransform />
            </Box>
            <Box
                sx={{
                    position: "absolute",
                    left: "50%",
                    top: "8px",
                    transform: "translateX(-50%)",
                    zIndex: 1,
                }}
            >
                <BaseMapSelectorInMapEditorV2 viewportWidth={viewport?.w} />
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

            {/* <Box
                sx={{
                    position: "absolute",
                    right: "4px",
                    top: "4px",
                    zIndex: 1,
                    display: "flex",
                    alignItems: "center",
                }}
            >
                <ButtonAutoLayoutLabels basePose={basePose} />
            </Box> */}

            <Box sx={{
                position: "absolute",
                left: "8px",
                top: "8px",
                zIndex: 1,
                display: "flex",
                alignItems: "center",
            }}>
                <SectionShowedFWC />
            </Box>
        </>
    );
}