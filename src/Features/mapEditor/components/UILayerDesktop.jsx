import { useState } from "react";
import { useSelector } from "react-redux";

import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import { useInteraction } from "../context/InteractionContext";

import { Box, Button } from "@mui/material";
import { GpsFixed } from "@mui/icons-material";

import ButtonEditScaleVariantFirst from "./ButtonEditScaleVariantFirst";
import ButtonAutoLayoutLabels from "Features/tools/components/ButtonAutoLayoutLabels";
import SectionShowedFWC from "Features/fwc/components/SectionShowedFWC";
import ButtonRunningTransform from "Features/baseMapTransforms/components/ButtonRunningTransform";
import SelectorMapEditorMode from "./SelectorMapEditorMode";
import SelectorDrawingPanel from "./SelectorDrawingPanel";
import DialogCalibration2D from "./DialogCalibration2D";


export default function UILayerDesktop({ mapController, onResetCamera, viewport }) {

    // data

    const { value: listing } = useSelectedListing();
    const openedPanel = useSelector(s => s.listings.openedPanel);
    const viewerKey = useSelector(s => s.viewers.selectedViewerKey);
    const showCalibration = useSelector(s => s.baseMapEditor.showCalibration);

    const { basePose } = useInteraction();

    const isBaseMapsViewer = viewerKey === "BASE_MAPS";

    // state

    const [openCalibrationDialog, setOpenCalibrationDialog] = useState(false);

    // helpers

    const emType = listing?.entityModel?.type;

    // helpers - show

    const showEditScale = true;

    return (
        <>
            {/* BaseMapSelector moved to TopBarDesktop for both MAP and BASE_MAPS viewers */}

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

            {/* <Box
                sx={{
                    position: "absolute",
                    left: "50%",
                    top: "8px",
                    transform: "translateX(-50%)",
                    zIndex: 1,
                }}
            >
                <BaseMapSelectorInMapEditorV2 viewportWidth={viewport?.w} />
            </Box> */}




            {/* ToolbarMapEditorV3 removed — harmonize icon buttons (#67) */}

            {showEditScale && <Box
                sx={{
                    position: "absolute",
                    left: "16px",
                    bottom: "16px",
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


            <Box sx={{
                position: "absolute",
                right: "16px",
                bottom: "16px",
                zIndex: 1,
                display: "flex",
                alignItems: "center",
            }}>
                <SelectorMapEditorMode />
            </Box>

        </>
    );
}